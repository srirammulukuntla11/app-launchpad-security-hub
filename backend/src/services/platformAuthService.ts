import { PlatformUser, IPlatformUser } from '../models/PlatformUser';
import { hashPassword, verifyPassword } from '../utils/crypto';
import {
  signAccessToken,
  createPlatformSession,
  rotatePlatformSession,
  revokePlatformSession,
  AuthenticationError,
} from './tokenService';
import { recordAuditEvent, AuditEvents } from './auditService';

export class ConflictError extends Error {
  statusCode = 409;
  code = 'CONFLICT';

  constructor(message = 'Resource already exists') {
    super(message);
    this.name = 'ConflictError';
  }
}

export const registerPlatformUser = async (data: {
  name: string;
  email: string;
  password: string;
}): Promise<IPlatformUser> => {
  const normalizedEmail = data.email.toLowerCase().trim();

  // Check uniqueness
  const existing = await PlatformUser.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ConflictError('An account with this email address already exists.');
  }

  // Hash password using Argon2id
  const passwordHash = await hashPassword(data.password);

  const newUser = await PlatformUser.create({
    name: data.name.trim(),
    email: normalizedEmail,
    passwordHash,
    status: 'active',
  });

  await recordAuditEvent({
    actorType: 'platform',
    actorId: newUser._id,
    actorEmail: newUser.email,
    eventType: AuditEvents.PLATFORM_USER_REGISTERED,
    action: 'platform.register',
    outcome: 'success',
  });

  return newUser;
};

export const loginPlatformUser = async (
  data: { email: string; password: string },
  meta?: { userAgent?: string; ipAddress?: string }
): Promise<{ user: IPlatformUser; accessToken: string; rawRefreshToken: string }> => {
  const normalizedEmail = data.email.toLowerCase().trim();

  // Explicitly include passwordHash since it is set to select: false
  const user = await PlatformUser.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!user || user.status !== 'active') {
    await recordAuditEvent({
      actorType: 'platform',
      actorEmail: normalizedEmail,
      eventType: AuditEvents.PLATFORM_USER_LOGIN_FAILED,
      action: 'platform.login',
      outcome: 'failure',
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      metadata: { reason: 'User not found or suspended' },
    });
    // Generic message to avoid email enumeration
    throw new AuthenticationError('Invalid email or password.', 'INVALID_CREDENTIALS', 401);
  }

  const passwordValid = await verifyPassword(data.password, user.passwordHash);
  if (!passwordValid) {
    await recordAuditEvent({
      actorType: 'platform',
      actorId: user._id,
      actorEmail: user.email,
      eventType: AuditEvents.PLATFORM_USER_LOGIN_FAILED,
      action: 'platform.login',
      outcome: 'failure',
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      metadata: { reason: 'Invalid password' },
    });
    throw new AuthenticationError('Invalid email or password.', 'INVALID_CREDENTIALS', 401);
  }

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    email: user.email,
    name: user.name,
  });

  const { rawRefreshToken } = await createPlatformSession(user._id, undefined, meta);

  await recordAuditEvent({
    actorType: 'platform',
    actorId: user._id,
    actorEmail: user.email,
    eventType: AuditEvents.PLATFORM_USER_LOGIN_SUCCESS,
    action: 'platform.login',
    outcome: 'success',
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return { user, accessToken, rawRefreshToken };
};

export const refreshPlatformSession = async (
  rawRefreshToken: string,
  meta?: { userAgent?: string; ipAddress?: string }
): Promise<{ accessToken: string; newRawRefreshToken: string }> => {
  if (!rawRefreshToken) {
    throw new AuthenticationError('Refresh token is required.', 'MISSING_REFRESH_TOKEN', 401);
  }

  const { newRawRefreshToken, session } = await rotatePlatformSession(rawRefreshToken, meta);

  const user = await PlatformUser.findById(session.userId);
  if (!user || user.status !== 'active') {
    throw new AuthenticationError('User account is suspended or no longer exists.', 'UNAUTHORIZED', 401);
  }

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    email: user.email,
    name: user.name,
  });

  return { accessToken, newRawRefreshToken };
};

export const logoutPlatformUser = async (rawRefreshToken?: string): Promise<void> => {
  if (rawRefreshToken) {
    await revokePlatformSession(rawRefreshToken);

    await recordAuditEvent({
      actorType: 'platform',
      eventType: AuditEvents.PLATFORM_USER_LOGOUT,
      action: 'platform.logout',
      outcome: 'success',
    });
  }
};
