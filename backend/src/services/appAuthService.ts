import { Types } from 'mongoose';
import { Project, IProject } from '../models/Project';
import { ProjectCredential, IProjectCredential } from '../models/ProjectCredential';
import { AppUser, IAppUser } from '../models/AppUser';
import { hashPassword, verifyPassword } from '../utils/crypto';
import {
  signAppAccessToken,
  createAppSession,
  rotateAppSession,
  revokeAppSession,
  AuthenticationError,
} from './tokenService';
import { ConflictError, NotFoundError } from './projectService';
import { recordAuditEvent, AuditEvents } from './auditService';

/**
 * Validate and resolve an active project by its public client key
 */
export const resolveProjectByPublicKey = async (
  publicKey: string
): Promise<{ project: IProject; credential: IProjectCredential }> => {
  if (!publicKey || typeof publicKey !== 'string') {
    throw new NotFoundError('Invalid public project key.');
  }

  const credential = await ProjectCredential.findOne({
    publicKey: publicKey.trim(),
    status: 'active',
  });

  if (!credential) {
    throw new NotFoundError('Project credential not found or revoked.');
  }

  const project = await Project.findOne({
    _id: credential.projectId,
    status: 'active',
  });

  if (!project) {
    throw new NotFoundError('Project is inactive or not found.');
  }

  return { project, credential };
};

export const registerAppUser = async (
  projectPublicKey: string,
  data: {
    email: string;
    password: string;
    name?: string;
    metadata?: Record<string, any>;
  }
): Promise<{
  user: Record<string, any>;
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}> => {
  const { project } = await resolveProjectByPublicKey(projectPublicKey);
  const normalizedEmail = data.email.toLowerCase().trim();

  // Enforce project-scoped email uniqueness
  const existingUser = await AppUser.findOne({
    projectId: project._id,
    email: normalizedEmail,
  });

  if (existingUser) {
    throw new ConflictError('A user with this email address already exists in this project.');
  }

  const passwordHash = await hashPassword(data.password);

  const newUser = await AppUser.create({
    projectId: project._id,
    email: normalizedEmail,
    passwordHash,
    profile: {
      name: data.name?.trim() || '',
      metadata: data.metadata || {},
    },
    status: 'active',
  });

  const accessToken = signAppAccessToken({
    sub: newUser._id.toString(),
    email: newUser.email,
    projectId: project._id.toString(),
    name: newUser.profile.name,
  });

  const { rawRefreshToken } = await createAppSession(newUser._id, project._id);

  await recordAuditEvent({
    projectId: project._id,
    actorType: 'app',
    actorId: newUser._id,
    actorEmail: newUser.email,
    eventType: AuditEvents.APP_USER_REGISTERED,
    action: 'user.register',
    outcome: 'success',
    metadata: { name: newUser.profile.name },
  });

  return {
    user: newUser.toJSON(),
    accessToken,
    refreshToken: rawRefreshToken,
    expiresIn: '15m',
  };
};

export const loginAppUser = async (
  projectPublicKey: string,
  data: { email: string; password: string },
  meta?: { userAgent?: string; ipAddress?: string }
): Promise<{
  user: Record<string, any>;
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}> => {
  const { project } = await resolveProjectByPublicKey(projectPublicKey);
  const normalizedEmail = data.email.toLowerCase().trim();

  const user = await AppUser.findOne({
    projectId: project._id,
    email: normalizedEmail,
  }).select('+passwordHash');

  if (!user || user.status !== 'active') {
    await recordAuditEvent({
      projectId: project._id,
      actorType: 'app',
      actorEmail: normalizedEmail,
      eventType: AuditEvents.APP_USER_LOGIN_FAILED,
      action: 'user.login',
      outcome: 'failure',
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      metadata: { reason: 'User not found or suspended' },
    });
    // Generic error to prevent email enumeration
    throw new AuthenticationError('Invalid email or password.', 'INVALID_CREDENTIALS', 401);
  }

  const isValidPassword = await verifyPassword(data.password, user.passwordHash);
  if (!isValidPassword) {
    await recordAuditEvent({
      projectId: project._id,
      actorType: 'app',
      actorId: user._id,
      actorEmail: user.email,
      eventType: AuditEvents.APP_USER_LOGIN_FAILED,
      action: 'user.login',
      outcome: 'failure',
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      metadata: { reason: 'Invalid password' },
    });
    throw new AuthenticationError('Invalid email or password.', 'INVALID_CREDENTIALS', 401);
  }

  const accessToken = signAppAccessToken({
    sub: user._id.toString(),
    email: user.email,
    projectId: project._id.toString(),
    name: user.profile.name,
  });

  const { rawRefreshToken } = await createAppSession(user._id, project._id, undefined, meta);

  await recordAuditEvent({
    projectId: project._id,
    actorType: 'app',
    actorId: user._id,
    actorEmail: user.email,
    eventType: AuditEvents.APP_USER_LOGIN_SUCCESS,
    action: 'user.login',
    outcome: 'success',
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken: rawRefreshToken,
    expiresIn: '15m',
  };
};

export const refreshAppUserSession = async (
  projectPublicKey: string,
  rawRefreshToken: string,
  meta?: { userAgent?: string; ipAddress?: string }
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}> => {
  const { project } = await resolveProjectByPublicKey(projectPublicKey);

  const { newRawRefreshToken, session } = await rotateAppSession(
    rawRefreshToken,
    project._id,
    meta
  );

  const user = await AppUser.findOne({
    _id: session.userId,
    projectId: project._id,
    status: 'active',
  });

  if (!user) {
    throw new AuthenticationError('User account not found or suspended.', 'UNAUTHORIZED', 401);
  }

  const accessToken = signAppAccessToken({
    sub: user._id.toString(),
    email: user.email,
    projectId: project._id.toString(),
    name: user.profile.name,
  });

  return {
    accessToken,
    refreshToken: newRawRefreshToken,
    expiresIn: '15m',
  };
};

export const logoutAppUser = async (
  projectPublicKey: string,
  rawRefreshToken: string
): Promise<void> => {
  const { project } = await resolveProjectByPublicKey(projectPublicKey);
  await revokeAppSession(rawRefreshToken, project._id);

  await recordAuditEvent({
    projectId: project._id,
    actorType: 'app',
    eventType: AuditEvents.APP_USER_LOGOUT,
    action: 'user.logout',
    outcome: 'success',
  });
};
