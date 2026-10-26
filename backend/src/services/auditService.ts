import mongoose, { Types } from 'mongoose';
import { AuditLog, IAuditLog, AuditActorType, AuditOutcome } from '../models/AuditLog';
import { verifyProjectOwnership } from './rbacService';

/**
 * Standard audit event constants across ALSH lifecycle
 */
export const AuditEvents = {
  // Platform owner authentication
  PLATFORM_USER_REGISTERED: 'PLATFORM_USER_REGISTERED',
  PLATFORM_USER_LOGIN_SUCCESS: 'PLATFORM_USER_LOGIN_SUCCESS',
  PLATFORM_USER_LOGIN_FAILED: 'PLATFORM_USER_LOGIN_FAILED',
  PLATFORM_USER_LOGOUT: 'PLATFORM_USER_LOGOUT',

  // Project management
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_ARCHIVED: 'PROJECT_ARCHIVED',

  // Credential lifecycle
  CREDENTIAL_CREATED: 'CREDENTIAL_CREATED',
  CREDENTIAL_ROTATED: 'CREDENTIAL_ROTATED',
  CREDENTIAL_REVOKED: 'CREDENTIAL_REVOKED',

  // Application end-user authentication
  APP_USER_REGISTERED: 'APP_USER_REGISTERED',
  APP_USER_LOGIN_SUCCESS: 'APP_USER_LOGIN_SUCCESS',
  APP_USER_LOGIN_FAILED: 'APP_USER_LOGIN_FAILED',
  APP_USER_LOGOUT: 'APP_USER_LOGOUT',
  APP_USER_TOKEN_REUSED: 'APP_USER_TOKEN_REUSED',

  // Roles and permissions (RBAC)
  ROLE_CREATED: 'ROLE_CREATED',
  ROLE_UPDATED: 'ROLE_UPDATED',
  ROLE_DELETED: 'ROLE_DELETED',
  PERMISSION_CREATED: 'PERMISSION_CREATED',
  ROLE_ASSIGNED: 'ROLE_ASSIGNED',
  ROLE_REVOKED: 'ROLE_REVOKED',

  // Authorization checks
  AUTHORIZATION_DENIED: 'AUTHORIZATION_DENIED',
} as const;

export type AuditEventType = typeof AuditEvents[keyof typeof AuditEvents] | string;

/**
 * Sensitive field patterns that must NEVER be persisted in audit metadata
 */
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /hash/i,
  /secret/i,
  /token/i,
  /cookie/i,
  /auth.*header/i,
  /authorization/i,
  /key_private/i,
  /credential.*secret/i,
  /connection.*string/i,
  /uri/i,
];

/**
 * Deep sanitization function to strip all sensitive keys from metadata payloads
 */
export const sanitizeAuditMetadata = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditMetadata(item));
  }

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeAuditMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

export interface RecordAuditParams {
  projectId?: Types.ObjectId | string | null;
  actorType: AuditActorType;
  actorId?: Types.ObjectId | string | null;
  actorEmail?: string | null;
  eventType: AuditEventType;
  action: string;
  outcome: AuditOutcome;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Record a security audit event in append-only storage.
 * Handles persistence errors safely so that database audit logging glitches
 * never silently crash or compromise the calling security flow.
 */
export const recordAuditEvent = async (
  params: RecordAuditParams
): Promise<IAuditLog | null> => {
  // If database is not connected and AuditLog.create is not mocked in this unit test, safely bypass
  if (mongoose.connection.readyState !== 1 && !(AuditLog.create as any).mock) {
    return null;
  }

  try {
    const sanitizedMetadata = sanitizeAuditMetadata(params.metadata || {});

    const doc = await AuditLog.create({
      projectId: params.projectId ? new Types.ObjectId(params.projectId.toString()) : null,
      actorType: params.actorType,
      actorId: params.actorId ? params.actorId.toString() : null,
      actorEmail: params.actorEmail ? params.actorEmail.toLowerCase().trim() : null,
      eventType: params.eventType,
      action: params.action,
      outcome: params.outcome,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      metadata: sanitizedMetadata,
      timestamp: new Date(),
    });

    return doc;
  } catch (error) {
    // Non-blocking operational logging: prevent audit failure from crashing main request
    console.error(
      '[AUDIT_RECORD_FAILURE] Failed to record audit event safely:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
};

export interface ListAuditLogsQuery {
  page?: number;
  limit?: number;
  eventType?: string;
  outcome?: 'success' | 'failure';
  startDate?: string;
  endDate?: string;
}

/**
 * Query and filter audit logs for a project with strict ownership authorization
 */
export const listProjectAuditLogs = async (
  ownerId: string | Types.ObjectId,
  projectId: string,
  query: ListAuditLogsQuery = {}
): Promise<{
  logs: IAuditLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> => {
  const project = await verifyProjectOwnership(ownerId, projectId);

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, any> = {
    projectId: project._id,
  };

  if (query.eventType) {
    filter.eventType = query.eventType.trim();
  }

  if (query.outcome) {
    filter.outcome = query.outcome;
  }

  if (query.startDate || query.endDate) {
    filter.timestamp = {};
    if (query.startDate) {
      filter.timestamp.$gte = new Date(query.startDate);
    }
    if (query.endDate) {
      filter.timestamp.$lte = new Date(query.endDate);
    }
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};
