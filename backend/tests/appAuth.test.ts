import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../src/app';
import { Project } from '../src/models/Project';
import { ProjectCredential } from '../src/models/ProjectCredential';
import { AppUser } from '../src/models/AppUser';
import { Session } from '../src/models/Session';
import { hashPassword, hashToken } from '../src/utils/crypto';
import { signAppAccessToken } from '../src/services/tokenService';

describe('Application-User Authentication API (/api/v1/auth/:projectPublicKey)', () => {
  const projectAId = new Types.ObjectId();
  const projectBId = new Types.ObjectId();

  const publicProjectAKey = 'alsh_pub_project_alpha_key_1111';
  const publicProjectBKey = 'alsh_pub_project_beta_key_2222';

  const mockProjectA = {
    _id: projectAId,
    id: projectAId.toString(),
    name: 'Project Alpha',
    slug: 'project-alpha',
    status: 'active',
  };

  const mockProjectB = {
    _id: projectBId,
    id: projectBId.toString(),
    name: 'Project Beta',
    slug: 'project-beta',
    status: 'active',
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock ProjectCredential and Project resolution
    vi.spyOn(ProjectCredential, 'findOne').mockImplementation((query: any) => {
      if (query.publicKey === publicProjectAKey && query.status === 'active') {
        return Promise.resolve({
          _id: new Types.ObjectId(),
          projectId: projectAId,
          publicKey: publicProjectAKey,
          status: 'active',
        }) as any;
      }
      if (query.publicKey === publicProjectBKey && query.status === 'active') {
        return Promise.resolve({
          _id: new Types.ObjectId(),
          projectId: projectBId,
          publicKey: publicProjectBKey,
          status: 'active',
        }) as any;
      }
      return Promise.resolve(null);
    });

    vi.spyOn(Project, 'findOne').mockImplementation((query: any) => {
      const qId = query._id?.toString();
      if (qId === projectAId.toString() && query.status === 'active') {
        return Promise.resolve(mockProjectA) as any;
      }
      if (qId === projectBId.toString() && query.status === 'active') {
        return Promise.resolve(mockProjectB) as any;
      }
      return Promise.resolve(null);
    });
  });

  describe('POST /:projectPublicKey/register (End-User Registration)', () => {
    it('should register end user in Project A and return access & refresh tokens in JSON', async () => {
      vi.spyOn(AppUser, 'findOne').mockResolvedValue(null);

      const userId = new Types.ObjectId();
      vi.spyOn(AppUser, 'create').mockImplementation(async (data: any) => ({
        _id: userId,
        id: userId.toString(),
        projectId: projectAId,
        email: data.email,
        profile: data.profile,
        status: 'active',
        createdAt: new Date(),
        toJSON() {
          return {
            id: userId.toString(),
            projectId: projectAId.toString(),
            email: data.email,
            profile: data.profile,
            status: 'active',
          };
        },
      }) as any);

      vi.spyOn(Session, 'create').mockResolvedValue({
        _id: 'session_app_1',
        tokenFamily: 'fam_1',
      } as any);

      const response = await request(app)
        .post(`/api/v1/auth/${publicProjectAKey}/register`)
        .send({
          email: 'enduser@example.com',
          password: 'Password123!',
          name: 'Alice Customer',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('enduser@example.com');
      expect(response.body.data.user.passwordHash).toBeUndefined();
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.expiresIn).toBe('15m');
    });

    it('should reject registration if project key is invalid or revoked', async () => {
      const response = await request(app)
        .post('/api/v1/auth/invalid_or_revoked_key/register')
        .send({
          email: 'user@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject duplicate registration with 409 within the SAME project', async () => {
      vi.spyOn(AppUser, 'findOne').mockResolvedValue({
        _id: new Types.ObjectId(),
        email: 'duplicate@example.com',
        projectId: projectAId,
      } as any);

      const response = await request(app)
        .post(`/api/v1/auth/${publicProjectAKey}/register`)
        .send({
          email: 'duplicate@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('should allow the SAME email to be registered in DIFFERENT projects independently', async () => {
      const sharedEmail = 'shared.user@example.com';

      // Mock: user does NOT exist in Project A, nor in Project B
      vi.spyOn(AppUser, 'findOne').mockResolvedValue(null);

      vi.spyOn(AppUser, 'create').mockImplementation(async (data: any) => ({
        _id: new Types.ObjectId(),
        projectId: data.projectId,
        email: data.email,
        profile: data.profile,
        status: 'active',
        toJSON() {
          return { id: 'u_created', projectId: data.projectId.toString(), email: data.email };
        },
      }) as any);

      vi.spyOn(Session, 'create').mockResolvedValue({ _id: 'sess' } as any);

      // Register in Project A
      const resA = await request(app)
        .post(`/api/v1/auth/${publicProjectAKey}/register`)
        .send({ email: sharedEmail, password: 'PasswordA123!' });

      expect(resA.status).toBe(201);
      expect(resA.body.data.user.email).toBe(sharedEmail);

      // Register SAME email in Project B
      const resB = await request(app)
        .post(`/api/v1/auth/${publicProjectBKey}/register`)
        .send({ email: sharedEmail, password: 'PasswordB123!' });

      expect(resB.status).toBe(201);
      expect(resB.body.data.user.email).toBe(sharedEmail);
    });
  });

  describe('POST /:projectPublicKey/login (End-User Login)', () => {
    it('should authenticate end user and return tokens in JSON', async () => {
      const password = 'CorrectPassword123!';
      const passwordHash = await hashPassword(password);
      const userId = new Types.ObjectId();

      const mockUser = {
        _id: userId,
        projectId: projectAId,
        email: 'alice@example.com',
        status: 'active',
        passwordHash,
        profile: { name: 'Alice' },
        toJSON() {
          return { id: userId.toString(), email: 'alice@example.com', name: 'Alice' };
        },
      };

      vi.spyOn(AppUser, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      } as any);

      vi.spyOn(Session, 'create').mockResolvedValue({ _id: 'session_app_2' } as any);

      const response = await request(app)
        .post(`/api/v1/auth/${publicProjectAKey}/login`)
        .send({
          email: 'alice@example.com',
          password,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('alice@example.com');
    });

    it('should return 401 with generic message for invalid password', async () => {
      const passwordHash = await hashPassword('CorrectPassword123!');
      const mockUser = {
        _id: new Types.ObjectId(),
        projectId: projectAId,
        email: 'alice@example.com',
        status: 'active',
        passwordHash,
      };

      vi.spyOn(AppUser, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      } as any);

      const response = await request(app)
        .post(`/api/v1/auth/${publicProjectAKey}/login`)
        .send({
          email: 'alice@example.com',
          password: 'WrongPassword999!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toBe('Invalid email or password.');
    });
  });

  describe('POST /:projectPublicKey/refresh & Reuse Detection', () => {
    it('should rotate app refresh token and return new token pair', async () => {
      const rawToken = 'app_raw_refresh_token_value_32chars!';
      const userId = new Types.ObjectId();
      const expiresAt = new Date(Date.now() + 1000000);

      const existingSession = {
        _id: 'session_app_old',
        tokenHash: hashToken(rawToken),
        tokenFamily: 'family_app_123',
        userType: 'app',
        userId,
        projectId: projectAId,
        expiresAt,
        isRevoked: false,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Session, 'findOne').mockResolvedValue(existingSession as any);
      vi.spyOn(Session, 'create').mockResolvedValue({
        _id: 'session_app_new',
        tokenFamily: 'family_app_123',
      } as any);

      vi.spyOn(AppUser, 'findOne').mockResolvedValue({
        _id: userId,
        email: 'refreshed@example.com',
        projectId: projectAId,
        status: 'active',
        profile: { name: 'Refreshed' },
      } as any);

      const response = await request(app)
        .post(`/api/v1/auth/${publicProjectAKey}/refresh`)
        .send({ refreshToken: rawToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(existingSession.isRevoked).toBe(true);
    });

    it('should detect token reuse and invalidate the entire token family', async () => {
      const reusedToken = 'compromised_already_rotated_token';
      const revokedSession = {
        _id: 'session_compromised',
        tokenHash: hashToken(reusedToken),
        tokenFamily: 'family_threat_999',
        userType: 'app',
        projectId: projectAId,
        isRevoked: true, // Already rotated!
      };

      vi.spyOn(Session, 'findOne').mockResolvedValue(revokedSession as any);
      const updateManySpy = vi.spyOn(Session, 'updateMany').mockResolvedValue({} as any);

      const response = await request(app)
        .post(`/api/v1/auth/${publicProjectAKey}/refresh`)
        .send({ refreshToken: reusedToken });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_REUSE_DETECTED');

      expect(updateManySpy).toHaveBeenCalledWith(
        { tokenFamily: 'family_threat_999', projectId: projectAId },
        expect.objectContaining({ $set: expect.objectContaining({ isRevoked: true }) })
      );
    });
  });

  describe('Cross-Project Isolation & Protected /me', () => {
    it('should allow user of Project A to access Project A profile', async () => {
      const userAId = new Types.ObjectId();
      const tokenA = signAppAccessToken({
        sub: userAId.toString(),
        email: 'alice@alpha.com',
        projectId: projectAId.toString(),
      });

      vi.spyOn(AppUser, 'findOne').mockResolvedValue({
        _id: userAId,
        email: 'alice@alpha.com',
        projectId: projectAId,
        status: 'active',
        toJSON() {
          return { id: userAId.toString(), email: 'alice@alpha.com' };
        },
      } as any);

      const response = await request(app)
        .get(`/api/v1/auth/${publicProjectAKey}/me`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.project.name).toBe('Project Alpha');
    });

    it('should DENY Project A access token when calling Project B endpoint (Cross-Project Isolation)', async () => {
      const userAId = new Types.ObjectId();
      const tokenA = signAppAccessToken({
        sub: userAId.toString(),
        email: 'alice@alpha.com',
        projectId: projectAId.toString(), // Belongs to Project A!
      });

      // Calling Project B with Project A token!
      const response = await request(app)
        .get(`/api/v1/auth/${publicProjectBKey}/me`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CROSS_PROJECT_TOKEN_DENIED');
      expect(response.body.error.message).toContain('not authorized for this project');
    });
  });

  describe('POST /:projectPublicKey/logout', () => {
    it('should revoke app user session upon logout', async () => {
      const rawToken = 'token_logout_app';
      const session = {
        tokenHash: hashToken(rawToken),
        isRevoked: false,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Session, 'findOne').mockResolvedValue(session as any);

      const response = await request(app)
        .post(`/api/v1/auth/${publicProjectAKey}/logout`)
        .send({ refreshToken: rawToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(session.isRevoked).toBe(true);
    });
  });
});
