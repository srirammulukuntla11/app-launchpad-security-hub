import { Types } from 'mongoose';
import { Project, IProject } from '../models/Project';
import { Role, IRole } from '../models/Role';
import { Permission, IPermission } from '../models/Permission';
import { AppUser, IAppUser } from '../models/AppUser';
import { AppUserRole, IAppUserRole } from '../models/AppUserRole';
import { NotFoundError, ForbiddenError, ConflictError } from './projectService';
import { recordAuditEvent, AuditEvents } from './auditService';

export class ValidationError extends Error {
  statusCode = 400;
  code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Standard baseline permissions catalog (system defaults)
 */
export const DEFAULT_PERMISSIONS = [
  { key: 'users:read', description: 'Read user profiles and lists' },
  { key: 'users:write', description: 'Create, update, and manage user accounts' },
  { key: 'roles:read', description: 'Read project roles and permissions' },
  { key: 'roles:write', description: 'Create and manage project roles' },
  { key: 'data:read', description: 'Read application data' },
  { key: 'data:write', description: 'Create and modify application data' },
];

/**
 * Starter system roles automatically provisioned for every project
 */
export const DEFAULT_SYSTEM_ROLES = [
  {
    name: 'admin',
    description: 'Full administrative access within the project',
    isSystem: true,
    permissions: [
      'users:read',
      'users:write',
      'roles:read',
      'roles:write',
      'data:read',
      'data:write',
    ],
  },
  {
    name: 'member',
    description: 'Standard team member with data read/write and user read permissions',
    isSystem: true,
    permissions: ['data:read', 'data:write', 'users:read'],
  },
  {
    name: 'viewer',
    description: 'Read-only access to application data',
    isSystem: true,
    permissions: ['data:read'],
  },
];

/**
 * Verify project existence and platform owner ownership
 */
export const verifyProjectOwnership = async (
  ownerId: string | Types.ObjectId,
  projectId: string | Types.ObjectId
): Promise<IProject> => {
  const pIdStr = projectId.toString();
  if (!Types.ObjectId.isValid(pIdStr)) {
    throw new NotFoundError('Project not found.');
  }

  const project = await Project.findById(pIdStr);
  if (!project || project.status === 'archived') {
    throw new NotFoundError('Project not found.');
  }

  if (project.ownerId.toString() !== ownerId.toString()) {
    throw new ForbiddenError('Access denied. You do not own this project.');
  }

  return project;
};

/**
 * Auto-seed default system roles if no roles exist yet for the project
 */
export const seedDefaultRolesIfEmpty = async (projectId: Types.ObjectId): Promise<void> => {
  const existingCount = await Role.countDocuments({ projectId });
  if (existingCount === 0) {
    const rolesToCreate = DEFAULT_SYSTEM_ROLES.map((r) => ({
      ...r,
      projectId,
    }));
    await Role.insertMany(rolesToCreate);
  }
};

/**
 * List all roles for a project
 */
export const listRoles = async (
  ownerId: string | Types.ObjectId,
  projectId: string
): Promise<IRole[]> => {
  const project = await verifyProjectOwnership(ownerId, projectId);

  await seedDefaultRolesIfEmpty(project._id);

  const roles = await Role.find({ projectId: project._id }).sort({ isSystem: -1, name: 1 });
  return roles;
};

/**
 * Create a new custom role in a project
 */
export const createRole = async (
  ownerId: string | Types.ObjectId,
  projectId: string,
  data: {
    name: string;
    description?: string;
    permissions?: string[];
  }
): Promise<IRole> => {
  const project = await verifyProjectOwnership(ownerId, projectId);
  const normalizedName = data.name.trim();

  // Check for duplicate role name within project
  const existingRole = await Role.findOne({
    projectId: project._id,
    name: { $regex: new RegExp(`^${normalizedName}$`, 'i') },
  });

  if (existingRole) {
    throw new ConflictError(`A role named '${normalizedName}' already exists in this project.`);
  }

  const role = await Role.create({
    projectId: project._id,
    name: normalizedName,
    description: data.description?.trim() || '',
    isSystem: false,
    permissions: Array.from(new Set(data.permissions || [])),
  });

  await recordAuditEvent({
    projectId: project._id,
    actorType: 'platform',
    actorId: ownerId,
    eventType: AuditEvents.ROLE_CREATED,
    action: 'role.create',
    outcome: 'success',
    metadata: { roleName: role.name, permissionsCount: role.permissions.length },
  });

  return role;
};

/**
 * Update an existing role in a project
 */
export const updateRole = async (
  ownerId: string | Types.ObjectId,
  projectId: string,
  roleId: string,
  data: {
    name?: string;
    description?: string;
    permissions?: string[];
  }
): Promise<IRole> => {
  const project = await verifyProjectOwnership(ownerId, projectId);

  if (!Types.ObjectId.isValid(roleId)) {
    throw new NotFoundError('Role not found.');
  }

  const role = await Role.findOne({
    _id: new Types.ObjectId(roleId),
    projectId: project._id,
  });

  if (!role) {
    throw new NotFoundError('Role not found in this project.');
  }

  // Protect system roles from name modification
  if (role.isSystem && data.name && data.name.trim().toLowerCase() !== role.name.toLowerCase()) {
    throw new ValidationError('System role names cannot be modified.');
  }

  if (data.name) {
    const normalizedName = data.name.trim();
    const duplicate = await Role.findOne({
      _id: { $ne: role._id },
      projectId: project._id,
      name: { $regex: new RegExp(`^${normalizedName}$`, 'i') },
    });
    if (duplicate) {
      throw new ConflictError(`A role named '${normalizedName}' already exists in this project.`);
    }
    role.name = normalizedName;
  }

  if (data.description !== undefined) {
    role.description = data.description.trim();
  }

  if (data.permissions !== undefined) {
    role.permissions = Array.from(new Set(data.permissions));
  }

  await role.save();

  await recordAuditEvent({
    projectId: project._id,
    actorType: 'platform',
    actorId: ownerId,
    eventType: AuditEvents.ROLE_UPDATED,
    action: 'role.update',
    outcome: 'success',
    metadata: { roleId, roleName: role.name },
  });

  return role;
};

/**
 * Delete a custom role from a project
 */
export const deleteRole = async (
  ownerId: string | Types.ObjectId,
  projectId: string,
  roleId: string
): Promise<void> => {
  const project = await verifyProjectOwnership(ownerId, projectId);

  if (!Types.ObjectId.isValid(roleId)) {
    throw new NotFoundError('Role not found.');
  }

  const role = await Role.findOne({
    _id: new Types.ObjectId(roleId),
    projectId: project._id,
  });

  if (!role) {
    throw new NotFoundError('Role not found in this project.');
  }

  // System roles cannot be deleted
  if (role.isSystem) {
    throw new ValidationError('System roles are protected and cannot be deleted.');
  }

  // Cascade delete assignments for this role within the project
  await AppUserRole.deleteMany({
    projectId: project._id,
    roleId: role._id,
  });

  await Role.deleteOne({ _id: role._id, projectId: project._id });

  await recordAuditEvent({
    projectId: project._id,
    actorType: 'platform',
    actorId: ownerId,
    eventType: AuditEvents.ROLE_DELETED,
    action: 'role.delete',
    outcome: 'success',
    metadata: { roleId, roleName: role.name },
  });
};

/**
 * List all available permissions for a project (defaults + custom)
 */
export const listPermissions = async (
  ownerId: string | Types.ObjectId,
  projectId: string
): Promise<Array<{ key: string; description: string; isSystem: boolean }>> => {
  const project = await verifyProjectOwnership(ownerId, projectId);

  const customPermissions = await Permission.find({ projectId: project._id }).sort({ key: 1 });

  const catalog = DEFAULT_PERMISSIONS.map((p) => ({
    key: p.key,
    description: p.description,
    isSystem: true,
  }));

  const customs = customPermissions.map((p) => ({
    key: p.key,
    description: p.description,
    isSystem: false,
  }));

  return [...catalog, ...customs];
};

/**
 * Create a custom permission for a project
 */
export const createCustomPermission = async (
  ownerId: string | Types.ObjectId,
  projectId: string,
  data: { key: string; description?: string }
): Promise<IPermission> => {
  const project = await verifyProjectOwnership(ownerId, projectId);
  const normalizedKey = data.key.trim().toLowerCase();

  // Check if exists in default catalog
  const inDefaults = DEFAULT_PERMISSIONS.some((p) => p.key === normalizedKey);
  if (inDefaults) {
    throw new ConflictError(`Permission '${normalizedKey}' already exists in the system catalog.`);
  }

  // Check if already in custom permissions for this project
  const existing = await Permission.findOne({
    projectId: project._id,
    key: normalizedKey,
  });

  if (existing) {
    throw new ConflictError(`Permission '${normalizedKey}' already exists in this project.`);
  }

  const permission = await Permission.create({
    projectId: project._id,
    key: normalizedKey,
    description: data.description?.trim() || '',
  });

  await recordAuditEvent({
    projectId: project._id,
    actorType: 'platform',
    actorId: ownerId,
    eventType: AuditEvents.PERMISSION_CREATED,
    action: 'permission.create',
    outcome: 'success',
    metadata: { key: permission.key },
  });

  return permission;
};

/**
 * Assign a role to an application user within the project scope
 */
export const assignRoleToUser = async (
  ownerId: string | Types.ObjectId,
  projectId: string,
  appUserId: string,
  roleId: string
): Promise<IAppUserRole> => {
  const project = await verifyProjectOwnership(ownerId, projectId);

  if (!Types.ObjectId.isValid(appUserId) || !Types.ObjectId.isValid(roleId)) {
    throw new NotFoundError('Invalid user ID or role ID format.');
  }

  // Strict verification: user must belong to this exact project
  const user = await AppUser.findOne({
    _id: new Types.ObjectId(appUserId),
    projectId: project._id,
  });

  if (!user) {
    throw new NotFoundError('User not found in this project.');
  }

  // Strict verification: role must belong to this exact project
  const role = await Role.findOne({
    _id: new Types.ObjectId(roleId),
    projectId: project._id,
  });

  if (!role) {
    throw new NotFoundError('Role not found in this project.');
  }

  // Check if already assigned (idempotent / unique)
  const existingAssignment = await AppUserRole.findOne({
    projectId: project._id,
    appUserId: user._id,
    roleId: role._id,
  });

  if (existingAssignment) {
    return existingAssignment;
  }

  const assignment = await AppUserRole.create({
    projectId: project._id,
    appUserId: user._id,
    roleId: role._id,
    assignedAt: new Date(),
  });

  await recordAuditEvent({
    projectId: project._id,
    actorType: 'platform',
    actorId: ownerId,
    eventType: AuditEvents.ROLE_ASSIGNED,
    action: 'role.assign',
    outcome: 'success',
    metadata: { appUserId, roleId, roleName: role.name },
  });

  return assignment;
};

/**
 * Revoke a role from an application user within the project scope
 */
export const revokeRoleFromUser = async (
  ownerId: string | Types.ObjectId,
  projectId: string,
  appUserId: string,
  roleId: string
): Promise<void> => {
  const project = await verifyProjectOwnership(ownerId, projectId);

  if (!Types.ObjectId.isValid(appUserId) || !Types.ObjectId.isValid(roleId)) {
    throw new NotFoundError('Invalid user ID or role ID format.');
  }

  // Strict verification: user must belong to this project
  const user = await AppUser.findOne({
    _id: new Types.ObjectId(appUserId),
    projectId: project._id,
  });

  if (!user) {
    throw new NotFoundError('User not found in this project.');
  }

  const deleted = await AppUserRole.findOneAndDelete({
    projectId: project._id,
    appUserId: user._id,
    roleId: new Types.ObjectId(roleId),
  });

  if (!deleted) {
    throw new NotFoundError('Role assignment not found for this user in this project.');
  }

  await recordAuditEvent({
    projectId: project._id,
    actorType: 'platform',
    actorId: ownerId,
    eventType: AuditEvents.ROLE_REVOKED,
    action: 'role.revoke',
    outcome: 'success',
    metadata: { appUserId, roleId },
  });
};

/**
 * Retrieve roles and effective permissions assigned to a user in a project
 */
export const getUserRolesAndPermissions = async (
  ownerId: string | Types.ObjectId,
  projectId: string,
  appUserId: string
): Promise<{
  user: Record<string, any>;
  roles: Array<Record<string, any>>;
  permissions: string[];
}> => {
  const project = await verifyProjectOwnership(ownerId, projectId);

  if (!Types.ObjectId.isValid(appUserId)) {
    throw new NotFoundError('User not found.');
  }

  const user = await AppUser.findOne({
    _id: new Types.ObjectId(appUserId),
    projectId: project._id,
  });

  if (!user) {
    throw new NotFoundError('User not found in this project.');
  }

  const assignments = await AppUserRole.find({
    projectId: project._id,
    appUserId: user._id,
  });

  const roleIds = assignments.map((a) => a.roleId);
  const roles = await Role.find({
    _id: { $in: roleIds },
    projectId: project._id,
  });

  const permissionSet = new Set<string>();
  for (const role of roles) {
    for (const perm of role.permissions) {
      permissionSet.add(perm);
    }
  }

  return {
    user: user.toJSON(),
    roles: roles.map((r) => r.toJSON()),
    permissions: Array.from(permissionSet),
  };
};

/**
 * Pure internal resolution of effective permissions for an app user
 * Used by authorization middleware and API checks (Deny-by-default)
 */
export const resolveUserPermissions = async (
  projectId: Types.ObjectId | string,
  appUserId: Types.ObjectId | string
): Promise<string[]> => {
  const pId = new Types.ObjectId(projectId.toString());
  const uId = new Types.ObjectId(appUserId.toString());

  const assignments = await AppUserRole.find({
    projectId: pId,
    appUserId: uId,
  });

  if (assignments.length === 0) {
    return []; // Deny by default: no assigned roles
  }

  const roleIds = assignments.map((a) => a.roleId);
  const roles = await Role.find({
    _id: { $in: roleIds },
    projectId: pId,
  });

  const permissionSet = new Set<string>();
  for (const role of roles) {
    for (const perm of role.permissions) {
      permissionSet.add(perm);
    }
  }

  return Array.from(permissionSet);
};

/**
 * Direct check if an app user has a specific permission in their project
 */
export const checkUserPermission = async (
  projectId: Types.ObjectId | string,
  appUserId: Types.ObjectId | string,
  requiredPermission: string
): Promise<{
  permitted: boolean;
  effectivePermissions: string[];
}> => {
  const permissions = await resolveUserPermissions(projectId, appUserId);
  const permitted = permissions.includes(requiredPermission) || permissions.includes('*');

  return {
    permitted,
    effectivePermissions: permissions,
  };
};
