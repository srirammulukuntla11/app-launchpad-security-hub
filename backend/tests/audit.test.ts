import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../src/app';
import { PlatformUser } from '../src/models/PlatformUser';
import { Project } from '../src/models/Project';
import { AuditLog } from '../src/models/AuditLog';
import {
  recordAuditEvent,
  sanitizeAuditMetadata,
  listProjectAuditLogs,
  AuditEvents,
} from '../src/services/auditService';
import { signAccessToken, signAppAccessToken } from '../src/services/tokenService';

describe('Stage 7 — Audit Logging and Security Event Stream', () => {
  const ownerAId = new Types.ObjectId();
  const ownerBId = new Types.ObjectId();

  const projectAId = new Types.ObjectId();
  const projectBId = new Types.ObjectId();

  const tokenOwnerA = signAccessToken({
    sub: ownerAId.toString(),
    email: 'ownerA@example.com',
    name: 'Owner A',
  });

  const tokenOwnerB = signAccessToken({
    sub: ownerBId.toString(),
    email: 'ownerB@example.com',
    name: 'Owner B',
  });

  const mockProjectA = {
    _id: projectAId,
    id: projectAId.toString(),
    ownerId: ownerAId,
    name: 'Project Alpha',
    slug: 'project-alpha',
    status: 'active',
  };

  const mockProjectB = {
    _id: projectBId,
    id: projectBId.toString(),
    ownerId: ownerBId, // Belongs to Owner B!
    name: 'Project Beta',
    slug: 'project-beta',
    status: 'active',
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock platform owner lookup
    vi.spyOn(PlatformUser, 'findById').mockImplementation((id: any) => {
      const idStr = id?.toString();
      if (idStr === ownerAId.toString()) {
        return Promise.resolve({
          _id: ownerAId,
          id: ownerAId.toString(),
          name: 'Owner A',
          email: 'ownerA@example.com',
          status: 'active',
        }) as any;
      }
      if (idStr === ownerBId.toString()) {
        return Promise.resolve({
          _id: ownerBId,
          id: ownerBId.toString(),
          name: 'Owner B',
          email: 'ownerB@example.com',
          status: 'active',
        }) as any;
      }
      return Promise.resolve(null);
    });

    // Mock Project lookup
    vi.spyOn(Project, 'findById').mockImplementation((id: any) => {
      const idStr = id?.toString();
      if (idStr === projectAId.toString()) return Promise.resolve(mockProjectA as any);
      if (idStr === projectBId.toString()) return Promise.resolve(mockProjectB as any);
      return Promise.resolve(null);
    });
  });

  describe('Sensitive Data Scrubbing and Sanitization', () => {
    it('should scrub and redact passwords, secrets, tokens, and hashes from audit metadata', () => {
      const rawMetadata = {
        action: 'user_register',
        email: 'victim@example.com',
        password: 'SuperSecretPassword123!',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$abc',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        accessToken: 'access_secret_token_val',
        refreshToken: 'refresh_secret_token_val',
        privateSecret: 'alsh_sec_secret_key_value',
        credentialSecret: 'cred_secret_val',
        cookie: 'alsh_refresh_session=cookie_val',
        authorization: 'Bearer secret_jwt_token',
        connectionString: 'mongodb+srv://admin:pass@cluster.mongodb.net',
        nested: {
          clientSecret: 'secret_nested',
          safeField: 'harmless_info',
        },
        safeData: 'public_value',
      };

      const sanitized = sanitizeAuditMetadata(rawMetadata);

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.passwordHash).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.accessToken).toBe('[REDACTED]');
      expect(sanitized.refreshToken).toBe('[REDACTED]');
      expect(sanitized.privateSecret).toBe('[REDACTED]');
      expect(sanitized.credentialSecret).toBe('[REDACTED]');
      expect(sanitized.cookie).toBe('[REDACTED]');
      expect(sanitized.authorization).toBe('[REDACTED]');
      expect(sanitized.connectionString).toBe('[REDACTED]');
      expect(sanitized.nested.clientSecret).toBe('[REDACTED]');

      // Preserves non-sensitive data
      expect(sanitized.safeData).toBe('public_value');
      expect(sanitized.email).toBe('victim@example.com');
      expect(sanitized.nested.safeField).toBe('harmless_info');
    });

    it('should handle primitive types and arrays in metadata safely', () => {
      expect(sanitizeAuditMetadata(null)).toBeNull();
      expect(sanitizeAuditMetadata(undefined)).toBeUndefined();
      expect(sanitizeAuditMetadata('just a string')).toBe('just a string');
      expect(sanitizeAuditMetadata(12345)).toBe(12345);

      const arrayMeta = [
        { password: '123', safe: 'abc' },
        { token: 'secret', other: 'xyz' },
      ];
      const sanitizedArray = sanitizeAuditMetadata(arrayMeta);
      expect(sanitizedArray[0].password).toBe('[REDACTED]');
      expect(sanitizedArray[0].safe).toBe('abc');
      expect(sanitizedArray[1].token).toBe('[REDACTED]');
    });
  });

  describe('Centralized Event Recording & Resilience', () => {
    it('should record an audit event with sanitized metadata', async () => {
      const createdDoc = {
        _id: new Types.ObjectId(),
        projectId: projectAId,
        actorType: 'platform',
        actorId: ownerAId.toString(),
        actorEmail: 'ownera@example.com',
        eventType: AuditEvents.PROJECT_CREATED,
        action: 'project.create',
        outcome: 'success',
        metadata: {
          name: 'Project Alpha',
          password: '[REDACTED]',
        },
        timestamp: new Date(),
      };

      const createSpy = vi.spyOn(AuditLog, 'create').mockResolvedValue(createdDoc as any);

      const result = await recordAuditEvent({
        projectId: projectAId,
        actorType: 'platform',
        actorId: ownerAId,
        actorEmail: 'OwnerA@example.com',
        eventType: AuditEvents.PROJECT_CREATED,
        action: 'project.create',
        outcome: 'success',
        metadata: {
          name: 'Project Alpha',
          password: 'UnsafePassword123!',
        },
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: projectAId,
          actorType: 'platform',
          actorId: ownerAId.toString(),
          actorEmail: 'ownera@example.com',
          eventType: AuditEvents.PROJECT_CREATED,
          metadata: expect.objectContaining({
            name: 'Project Alpha',
            password: '[REDACTED]',
          }),
        })
      );
      expect(result).not.toBeNull();
    });

    it('should not throw or crash calling execution when AuditLog.create fails (Resilience)', async () => {
      vi.spyOn(AuditLog, 'create').mockRejectedValue(new Error('Simulated Database Down'));

      // Must not throw error!
      const result = await recordAuditEvent({
        projectId: projectAId,
        actorType: 'platform',
        actorId: ownerAId,
        eventType: AuditEvents.PROJECT_CREATED,
        action: 'project.create',
        outcome: 'success',
      });

      expect(result).toBeNull();
    });
  });

  describe('GET /api/v1/projects/:projectId/audit-logs (Audit Stream API)', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get(`/api/v1/projects/${projectAId}/audit-logs`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject application end-user token with 401 (Privilege Distinction)', async () => {
      const endUserToken = signAppAccessToken({
        sub: new Types.ObjectId().toString(),
        email: 'user@app.com',
        projectId: projectAId.toString(),
      });

      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/audit-logs`)
        .set('Authorization', `Bearer ${endUserToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should DENY Owner A from reading audit logs of Project B (Cross-Owner Isolation 403)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectBId}/audit-logs`)
        .set('Authorization', `Bearer ${tokenOwnerA}`); // Owner A calling Project B

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('You do not own this project');
    });

    it('should return paginated audit logs for project owner with pagination metadata', async () => {
      const mockLogs = [
        {
          _id: new Types.ObjectId(),
          projectId: projectAId,
          actorType: 'platform',
          actorId: ownerAId.toString(),
          eventType: AuditEvents.CREDENTIAL_ROTATED,
          action: 'credential.rotate',
          outcome: 'success',
          metadata: { publicKey: 'alsh_pub_abc123' },
          timestamp: new Date('2026-10-12T10:00:00Z'),
          toJSON() {
            return {
              id: 'log1',
              eventType: AuditEvents.CREDENTIAL_ROTATED,
              outcome: 'success',
            };
          },
        },
        {
          _id: new Types.ObjectId(),
          projectId: projectAId,
          actorType: 'platform',
          actorId: ownerAId.toString(),
          eventType: AuditEvents.PROJECT_CREATED,
          action: 'project.create',
          outcome: 'success',
          metadata: { name: 'Project Alpha' },
          timestamp: new Date('2026-10-12T09:00:00Z'),
          toJSON() {
            return {
              id: 'log2',
              eventType: AuditEvents.PROJECT_CREATED,
              outcome: 'success',
            };
          },
        },
      ];

      vi.spyOn(AuditLog, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockLogs),
          }),
        }),
      } as any);

      vi.spyOn(AuditLog, 'countDocuments').mockResolvedValue(2);

      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/audit-logs?page=1&limit=20`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs).toHaveLength(2);
      expect(res.body.data.pagination).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should support filtering by eventType and outcome', async () => {
      const findSpy = vi.spyOn(AuditLog, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      vi.spyOn(AuditLog, 'countDocuments').mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/audit-logs?eventType=${AuditEvents.AUTHORIZATION_DENIED}&outcome=failure`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: projectAId,
          eventType: AuditEvents.AUTHORIZATION_DENIED,
          outcome: 'failure',
        })
      );
    });

    it('should support date range filtering on timestamp', async () => {
      const findSpy = vi.spyOn(AuditLog, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      vi.spyOn(AuditLog, 'countDocuments').mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/audit-logs?startDate=2026-10-01T00:00:00Z&endDate=2026-10-12T23:59:59Z`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: projectAId,
          timestamp: {
            $gte: new Date('2026-10-01T00:00:00Z'),
            $lte: new Date('2026-10-12T23:59:59Z'),
          },
        })
      );
    });
  });

  describe('Append-Only Integrity (Zero Mutation Endpoints)', () => {
    it('should return 404 for any attempt to delete or edit audit records', async () => {
      const dummyId = new Types.ObjectId();

      const patchRes = await request(app)
        .patch(`/api/v1/projects/${projectAId}/audit-logs/${dummyId}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ outcome: 'tampered' });

      expect(patchRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete(`/api/v1/projects/${projectAId}/audit-logs/${dummyId}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(deleteRes.status).toBe(404);
    });
  });
});
