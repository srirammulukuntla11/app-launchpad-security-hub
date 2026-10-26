import { Request, Response, NextFunction } from 'express';
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
  createCustomPermission,
  assignRoleToUser,
  revokeRoleFromUser,
  getUserRolesAndPermissions,
  checkUserPermission,
} from '../services/rbacService';
import { recordAuditEvent, AuditEvents } from '../services/auditService';

export const handleListRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);

    const roles = await listRoles(ownerId, projectId);

    res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    next(error);
  }
};

export const handleCreateRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);

    const role = await createRole(ownerId, projectId, req.body);

    res.status(201).json({
      success: true,
      data: role,
    });
  } catch (error) {
    next(error);
  }
};

export const handleUpdateRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);
    const roleId = String(req.params.roleId);

    const updatedRole = await updateRole(ownerId, projectId, roleId, req.body);

    res.status(200).json({
      success: true,
      data: updatedRole,
    });
  } catch (error) {
    next(error);
  }
};

export const handleDeleteRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);
    const roleId = String(req.params.roleId);

    await deleteRole(ownerId, projectId, roleId);

    res.status(200).json({
      success: true,
      message: 'Role deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

export const handleListPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);

    const permissions = await listPermissions(ownerId, projectId);

    res.status(200).json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    next(error);
  }
};

export const handleCreatePermission = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);

    const permission = await createCustomPermission(ownerId, projectId, req.body);

    res.status(201).json({
      success: true,
      data: permission,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetUserRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);
    const appUserId = String(req.params.appUserId);

    const data = await getUserRolesAndPermissions(ownerId, projectId, appUserId);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const handleAssignRoleToUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);
    const appUserId = String(req.params.appUserId);
    const { roleId } = req.body;

    const assignment = await assignRoleToUser(ownerId, projectId, appUserId, roleId);

    res.status(200).json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
};

export const handleRevokeRoleFromUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);
    const appUserId = String(req.params.appUserId);
    const roleId = String(req.params.roleId);

    await revokeRoleFromUser(ownerId, projectId, appUserId, roleId);

    res.status(200).json({
      success: true,
      message: 'Role revoked from user successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * End-user authorization check (deny-by-default)
 */
export const handleAuthorizeCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { permission } = req.body;
    const project = req.project!;
    const user = req.appUser!;

    const result = await checkUserPermission(project._id, user._id, permission);

    if (!result.permitted) {
      await recordAuditEvent({
        projectId: project._id,
        actorType: 'app',
        actorId: user._id,
        actorEmail: user.email,
        eventType: AuditEvents.AUTHORIZATION_DENIED,
        action: 'auth.check',
        outcome: 'failure',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        metadata: { permission },
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Missing required permission: ${permission}.`,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        permitted: true,
        permission,
        effectivePermissions: result.effectivePermissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Example protected endpoint requiring 'data:read'
 */
export const handleGetProtectedResource = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Access granted to sensitive project resource.',
      project: req.project?.name,
      user: req.appUser?.email,
    },
  });
};
