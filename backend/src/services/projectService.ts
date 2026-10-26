import { Types } from 'mongoose';
import { Project, IProject } from '../models/Project';
import { ProjectCredential, IProjectCredential } from '../models/ProjectCredential';
import {
  generateProjectPublicKey,
  generateProjectPrivateSecret,
  hashProjectSecret,
} from '../utils/crypto';
import { recordAuditEvent, AuditEvents } from './auditService';

export class NotFoundError extends Error {
  statusCode = 404;
  code = 'NOT_FOUND';

  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  code = 'FORBIDDEN';

  constructor(message = 'Access denied. You do not own this project.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  code = 'CONFLICT';

  constructor(message = 'Resource with this identifier already exists.') {
    super(message);
    this.name = 'ConflictError';
  }
}

export const createProject = async (
  ownerId: string | Types.ObjectId,
  data: {
    name: string;
    slug: string;
    description?: string;
    environment?: 'development' | 'staging' | 'production';
    allowedOrigins?: string[];
  }
): Promise<{
  project: IProject;
  credential: Record<string, any>;
  oneTimeSecret: string;
}> => {
  const normalizedSlug = data.slug.toLowerCase().trim();

  // Ensure unique slug
  const existingProject = await Project.findOne({ slug: normalizedSlug });
  if (existingProject) {
    throw new ConflictError('A project with this slug already exists.');
  }

  const project = await Project.create({
    ownerId: new Types.ObjectId(ownerId.toString()),
    name: data.name.trim(),
    slug: normalizedSlug,
    description: data.description?.trim() || '',
    environment: data.environment || 'development',
    allowedOrigins: data.allowedOrigins || [],
    status: 'active',
  });

  // Generate cryptographically secure project key and secret
  const publicKey = generateProjectPublicKey();
  const rawSecret = generateProjectPrivateSecret();
  const secretHash = await hashProjectSecret(rawSecret);

  const credential = await ProjectCredential.create({
    projectId: project._id,
    publicKey,
    secretHash,
    name: 'Initial Primary Key',
    status: 'active',
  });

  // Record audit events safely
  await recordAuditEvent({
    projectId: project._id,
    actorType: 'platform',
    actorId: ownerId,
    eventType: AuditEvents.PROJECT_CREATED,
    action: 'project.create',
    outcome: 'success',
    metadata: { name: project.name, slug: project.slug, environment: project.environment },
  });

  await recordAuditEvent({
    projectId: project._id,
    actorType: 'platform',
    actorId: ownerId,
    eventType: AuditEvents.CREDENTIAL_CREATED,
    action: 'credential.create',
    outcome: 'success',
    metadata: { publicKey: credential.publicKey, name: credential.name },
  });

  return {
    project,
    credential: credential.toJSON(),
    oneTimeSecret: rawSecret, // One-time reveal only
  };
};

export const listProjects = async (
  ownerId: string | Types.ObjectId
): Promise<Array<Record<string, any>>> => {
  const projects = await Project.find({
    ownerId: new Types.ObjectId(ownerId.toString()),
    status: 'active',
  }).sort({ createdAt: -1 });

  const projectIds = projects.map((p) => p._id);
  const credentials = await ProjectCredential.find({
    projectId: { $in: projectIds },
  });

  return projects.map((project) => {
    const projectObj = project.toJSON() as any;
    projectObj.credentials = credentials
      .filter((c) => c.projectId.toString() === project._id.toString())
      .map((c) => c.toJSON());
    return projectObj;
  });
};

export const getProject = async (
  ownerId: string | Types.ObjectId,
  projectId: string
): Promise<{
  project: IProject;
  credentials: Record<string, any>[];
}> => {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new NotFoundError('Project not found.');
  }

  const project = await Project.findById(projectId);
  if (!project || project.status === 'archived') {
    throw new NotFoundError('Project not found.');
  }

  // Strict server-side ownership enforcement
  if (project.ownerId.toString() !== ownerId.toString()) {
    throw new ForbiddenError('Access denied. You do not own this project.');
  }

  const credentials = await ProjectCredential.find({
    projectId: project._id,
  }).sort({ createdAt: -1 });

  return {
    project,
    credentials: credentials.map((c) => c.toJSON()),
  };
};

export const updateProject = async (
  ownerId: string | Types.ObjectId,
  projectId: string,
  data: {
    name?: string;
    description?: string;
    environment?: 'development' | 'staging' | 'production';
    allowedOrigins?: string[];
  }
): Promise<IProject> => {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new NotFoundError('Project not found.');
  }

  const project = await Project.findById(projectId);
  if (!project || project.status === 'archived') {
    throw new NotFoundError('Project not found.');
  }

  // Strict server-side ownership enforcement
  if (project.ownerId.toString() !== ownerId.toString()) {
    throw new ForbiddenError('Access denied. You do not own this project.');
  }

  if (data.name !== undefined) project.name = data.name.trim();
  if (data.description !== undefined) project.description = data.description.trim();
  if (data.environment !== undefined) project.environment = data.environment;
  if (data.allowedOrigins !== undefined) project.allowedOrigins = data.allowedOrigins;

  await project.save();

  await recordAuditEvent({
    projectId: project._id,
    actorType: 'platform',
    actorId: ownerId,
    eventType: AuditEvents.PROJECT_UPDATED,
    action: 'project.update',
    outcome: 'success',
    metadata: { updatedFields: Object.keys(data) },
  });

  return project;
};

export const archiveProject = async (
  ownerId: string | Types.ObjectId,
  projectId: string
): Promise<IProject> => {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new NotFoundError('Project not found.');
  }

  const project = await Project.findById(projectId);
  if (!project || project.status === 'archived') {
    throw new NotFoundError('Project not found.');
  }

  // Strict server-side ownership enforcement
  if (project.ownerId.toString() !== ownerId.toString()) {
    throw new ForbiddenError('Access denied. You do not own this project.');
  }

  project.status = 'archived';
  await project.save();

  // Immediately revoke all active credentials for this archived project
  await ProjectCredential.updateMany(
    { projectId: project._id, status: 'active' },
    { $set: { status: 'revoked', revokedAt: new Date() } }
  );

  await recordAuditEvent({
    projectId: project._id,
    actorType: 'platform',
    actorId: ownerId,
    eventType: AuditEvents.PROJECT_ARCHIVED,
    action: 'project.archive',
    outcome: 'success',
  });

  return project;
};

export const rotateProjectCredentials = async (
  ownerId: string | Types.ObjectId,
  projectId: string,
  keyName?: string
): Promise<{
  credential: Record<string, any>;
  oneTimeSecret: string;
}> => {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new NotFoundError('Project not found.');
  }

  const project = await Project.findById(projectId);
  if (!project || project.status === 'archived') {
    throw new NotFoundError('Project not found.');
  }

  // Strict server-side ownership enforcement
  if (project.ownerId.toString() !== ownerId.toString()) {
    throw new ForbiddenError('Access denied. You do not own this project.');
  }

  // Invalidate previous active credentials immediately
  await ProjectCredential.updateMany(
    { projectId: project._id, status: 'active' },
    { $set: { status: 'revoked', revokedAt: new Date() } }
  );

  // Generate new secure key pair
  const publicKey = generateProjectPublicKey();
  const rawSecret = generateProjectPrivateSecret();
  const secretHash = await hashProjectSecret(rawSecret);

  const credential = await ProjectCredential.create({
    projectId: project._id,
    publicKey,
    secretHash,
    name: keyName?.trim() || 'Rotated Secret Key',
    status: 'active',
  });

  await recordAuditEvent({
    projectId: project._id,
    actorType: 'platform',
    actorId: ownerId,
    eventType: AuditEvents.CREDENTIAL_ROTATED,
    action: 'credential.rotate',
    outcome: 'success',
    metadata: { publicKey: credential.publicKey, name: credential.name },
  });

  return {
    credential: credential.toJSON(),
    oneTimeSecret: rawSecret, // One-time reveal only
  };
};

export const revokeProjectCredential = async (
  ownerId: string | Types.ObjectId,
  projectId: string,
  credentialId: string
): Promise<IProjectCredential> => {
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(credentialId)) {
    throw new NotFoundError('Project or credential not found.');
  }

  const project = await Project.findById(projectId);
  if (!project || project.status === 'archived') {
    throw new NotFoundError('Project not found.');
  }

  // Strict server-side ownership enforcement
  if (project.ownerId.toString() !== ownerId.toString()) {
    throw new ForbiddenError('Access denied. You do not own this project.');
  }

  const credential = await ProjectCredential.findOne({
    _id: new Types.ObjectId(credentialId),
    projectId: project._id,
  });

  if (!credential || credential.status === 'revoked') {
    throw new NotFoundError('Credential not found or already revoked.');
  }

  credential.status = 'revoked';
  credential.revokedAt = new Date();
  await credential.save();

  await recordAuditEvent({
    projectId: project._id,
    actorType: 'platform',
    actorId: ownerId,
    eventType: AuditEvents.CREDENTIAL_REVOKED,
    action: 'credential.revoke',
    outcome: 'success',
    metadata: { credentialId },
  });

  return credential;
};
