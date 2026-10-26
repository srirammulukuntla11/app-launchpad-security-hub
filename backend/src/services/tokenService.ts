import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { generateRandomToken, hashToken } from '../utils/crypto';
import { Session, ISession } from '../models/Session';

export interface PlatformJwtPayload {
  sub: string;
  type: 'platform';
  email: string;
  name: string;
}

export class AuthenticationError extends Error {
  statusCode: number;
  code: string;

  constructor(message = 'Authentication failed', code = 'UNAUTHORIZED', statusCode = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Sign a short-lived access token for a platform owner
 */
export const signAccessToken = (payload: Omit<PlatformJwtPayload, 'type'>): string => {
  return jwt.sign(
    {
      ...payload,
      type: 'platform',
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    }
  );
};

/**
 * Verify and decode an access token
 */
export const verifyAccessToken = (token: string): PlatformJwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as PlatformJwtPayload;
    if (decoded.type !== 'platform') {
      throw new AuthenticationError('Invalid token type', 'INVALID_TOKEN', 401);
    }
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Access token has expired', 'TOKEN_EXPIRED', 401);
    }
    throw new AuthenticationError('Invalid access token', 'INVALID_TOKEN', 401);
  }
};

/**
 * Create a new session with a hashed refresh token and token family
 */
export const createPlatformSession = async (
  userId: string | Types.ObjectId,
  tokenFamily?: string,
  meta?: { userAgent?: string; ipAddress?: string }
): Promise<{ rawRefreshToken: string; session: ISession }> => {
  const rawRefreshToken = generateRandomToken(32);
  const tokenHash = hashToken(rawRefreshToken);
  const family = tokenFamily || generateRandomToken(16);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

  const session = await Session.create({
    tokenHash,
    tokenFamily: family,
    userType: 'platform',
    userId: new Types.ObjectId(userId.toString()),
    expiresAt,
    isRevoked: false,
    userAgent: meta?.userAgent,
    ipAddress: meta?.ipAddress,
  });

  return { rawRefreshToken, session };
};

/**
 * Rotate a refresh token with strict reuse detection and application-level expiry checks
 */
export const rotatePlatformSession = async (
  rawRefreshToken: string,
  meta?: { userAgent?: string; ipAddress?: string }
): Promise<{ newRawRefreshToken: string; session: ISession }> => {
  const tokenHash = hashToken(rawRefreshToken);

  // Find session by hashed token
  const existingSession = await Session.findOne({ tokenHash, userType: 'platform' });

  if (!existingSession) {
    throw new AuthenticationError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);
  }

  // Token reuse detection:
  // If the session was already revoked or rotated, an attacker may have replayed an old token.
  // Invalidate the entire token family immediately!
  if (existingSession.isRevoked) {
    await Session.updateMany(
      { tokenFamily: existingSession.tokenFamily },
      { $set: { isRevoked: true, revokedAt: new Date() } }
    );
    throw new AuthenticationError('Token reuse detected. All sessions in this family have been invalidated.', 'TOKEN_REUSE_DETECTED', 401);
  }

  // Application-level expiry verification
  if (new Date() > existingSession.expiresAt) {
    existingSession.isRevoked = true;
    existingSession.revokedAt = new Date();
    await existingSession.save();
    throw new AuthenticationError('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED', 401);
  }

  // Mark current session as rotated/revoked
  existingSession.isRevoked = true;
  existingSession.rotatedAt = new Date();
  await existingSession.save();

  // Create a new session in the SAME token family (rotation)
  const newSessionData = await createPlatformSession(
    existingSession.userId,
    existingSession.tokenFamily,
    meta
  );

  return {
    newRawRefreshToken: newSessionData.rawRefreshToken,
    session: newSessionData.session,
  };
};

/**
 * Revoke a session (logout)
 */
export const revokePlatformSession = async (rawRefreshToken: string): Promise<boolean> => {
  const tokenHash = hashToken(rawRefreshToken);
  const session = await Session.findOne({ tokenHash, userType: 'platform' });

  if (session && !session.isRevoked) {
    session.isRevoked = true;
    session.revokedAt = new Date();
    await session.save();
    return true;
  }

  return false;
};

/* =========================================================================
   APPLICATION END-USER TOKEN & SESSION LIFECYCLE (STAGE 5)
   ========================================================================= */

export interface AppJwtPayload {
  sub: string;
  type: 'app';
  email: string;
  projectId: string;
  name?: string;
}

/**
 * Sign a short-lived access token for an application end user
 */
export const signAppAccessToken = (payload: Omit<AppJwtPayload, 'type'>): string => {
  return jwt.sign(
    {
      ...payload,
      type: 'app',
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    }
  );
};

/**
 * Verify and decode an application user access token, enforcing project scope
 */
export const verifyAppAccessToken = (token: string, expectedProjectId?: string): AppJwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AppJwtPayload;
    if (decoded.type !== 'app') {
      throw new AuthenticationError('Invalid token type for application user', 'INVALID_TOKEN', 401);
    }
    if (expectedProjectId && decoded.projectId !== expectedProjectId) {
      throw new AuthenticationError('Token not authorized for this project', 'CROSS_PROJECT_TOKEN_DENIED', 403);
    }
    return decoded;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Access token has expired', 'TOKEN_EXPIRED', 401);
    }
    throw new AuthenticationError('Invalid access token', 'INVALID_TOKEN', 401);
  }
};

/**
 * Create a new application user session with token hash and family
 */
export const createAppSession = async (
  userId: string | Types.ObjectId,
  projectId: string | Types.ObjectId,
  tokenFamily?: string,
  meta?: { userAgent?: string; ipAddress?: string }
): Promise<{ rawRefreshToken: string; session: ISession }> => {
  const rawRefreshToken = generateRandomToken(32);
  const tokenHash = hashToken(rawRefreshToken);
  const family = tokenFamily || generateRandomToken(16);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

  const session = await Session.create({
    tokenHash,
    tokenFamily: family,
    userType: 'app',
    userId: new Types.ObjectId(userId.toString()),
    projectId: new Types.ObjectId(projectId.toString()),
    expiresAt,
    isRevoked: false,
    userAgent: meta?.userAgent,
    ipAddress: meta?.ipAddress,
  });

  return { rawRefreshToken, session };
};

/**
 * Rotate an application user refresh token with reuse detection scoped to project
 */
export const rotateAppSession = async (
  rawRefreshToken: string,
  expectedProjectId: string | Types.ObjectId,
  meta?: { userAgent?: string; ipAddress?: string }
): Promise<{ newRawRefreshToken: string; session: ISession }> => {
  const tokenHash = hashToken(rawRefreshToken);
  const projId = new Types.ObjectId(expectedProjectId.toString());

  const existingSession = await Session.findOne({
    tokenHash,
    userType: 'app',
    projectId: projId,
  });

  if (!existingSession) {
    throw new AuthenticationError('Invalid refresh token for this project', 'INVALID_REFRESH_TOKEN', 401);
  }

  // Token reuse detection: invalidate entire family within project
  if (existingSession.isRevoked) {
    await Session.updateMany(
      { tokenFamily: existingSession.tokenFamily, projectId: projId },
      { $set: { isRevoked: true, revokedAt: new Date() } }
    );
    throw new AuthenticationError('Token reuse detected. All sessions in this family have been invalidated.', 'TOKEN_REUSE_DETECTED', 401);
  }

  // Application-level expiry verification
  if (new Date() > existingSession.expiresAt) {
    existingSession.isRevoked = true;
    existingSession.revokedAt = new Date();
    await existingSession.save();
    throw new AuthenticationError('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED', 401);
  }

  // Mark current session as rotated
  existingSession.isRevoked = true;
  existingSession.rotatedAt = new Date();
  await existingSession.save();

  // Create new session in SAME family
  const newSessionData = await createAppSession(
    existingSession.userId,
    existingSession.projectId!,
    existingSession.tokenFamily,
    meta
  );

  return {
    newRawRefreshToken: newSessionData.rawRefreshToken,
    session: newSessionData.session,
  };
};

/**
 * Revoke an application user session (logout)
 */
export const revokeAppSession = async (
  rawRefreshToken: string,
  expectedProjectId: string | Types.ObjectId
): Promise<boolean> => {
  const tokenHash = hashToken(rawRefreshToken);
  const projId = new Types.ObjectId(expectedProjectId.toString());

  const session = await Session.findOne({
    tokenHash,
    userType: 'app',
    projectId: projId,
  });

  if (session && !session.isRevoked) {
    session.isRevoked = true;
    session.revokedAt = new Date();
    await session.save();
    return true;
  }

  return false;
};
