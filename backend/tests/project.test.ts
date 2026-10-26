import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../src/app';
import { PlatformUser } from '../src/models/PlatformUser';
import { Project } from '../src/models/Project';
import { ProjectCredential } from '../src/models/ProjectCredential';
import { signAccessToken } from '../src/services/tokenService';

describe('Project Management & Credentials API (/api/v1/projects)', () => {
  const ownerAId = new Types.ObjectId().toString();
  const ownerBId = new Types.ObjectId().toString();

  const tokenOwnerA = signAccessToken({
    sub: ownerAId,
    email: 'ownerA@example.com',
    name: 'Owner A',
  });

  const tokenOwnerB = signAccessToken({
    sub: ownerBId,
    email: 'ownerB@example.com',
    name: 'Owner B',
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock authenticatePlatform middleware looking up user
    vi.spyOn(PlatformUser, 'findById').mockImplementation((id: any) => {
      const idStr = id.toString();
      if (idStr === ownerAId) {
        return Promise.resolve({
          _id: new Types.ObjectId(ownerAId),
          id: ownerAId,
          name: 'Owner A',
          email: 'ownerA@example.com',
          status: 'active',
        }) as any;
      }
      if (idStr === ownerBId) {
        return Promise.resolve({
          _id: new Types.ObjectId(ownerBId),
          id: ownerBId,
          name: 'Owner B',
          email: 'ownerB@example.com',
          status: 'active',
        }) as any;
      }
      return Promise.resolve(null);
    });
  });

  describe('POST /api/v1/projects (Project Creation & One-Time Secret)', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const response = await request(app).post('/api/v1/projects').send({
        name: 'My New App',
        slug: 'my-new-app',
      });
      expect(response.status).toBe(401);
    });

    it('should create a project and return one-time secret in response', async () => {
      vi.spyOn(Project, 'findOne').mockResolvedValue(null);
      const projectId = new Types.ObjectId();

      vi.spyOn(Project, 'create').mockImplementation(async (data: any) => ({
        _id: projectId,
        id: projectId.toString(),
        ownerId: new Types.ObjectId(ownerAId),
        name: data.name,
        slug: data.slug,
        environment: data.environment,
        allowedOrigins: data.allowedOrigins,
        status: 'active',
        createdAt: new Date(),
        toJSON() {
          return {
            id: projectId.toString(),
            ownerId: ownerAId,
            name: data.name,
            slug: data.slug,
            environment: data.environment,
            status: 'active',
          };
        },
      }) as any);

      const credentialCreateSpy = vi.spyOn(ProjectCredential, 'create').mockImplementation(async (data: any) => ({
        _id: new Types.ObjectId(),
        projectId,
        publicKey: data.publicKey,
        name: data.name,
        status: data.status,
        createdAt: new Date(),
        toJSON() {
          return {
            id: 'cred_1',
            publicKey: data.publicKey,
            name: data.name,
            status: data.status,
          };
        },
      }) as any);

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          name: 'Security Hub Alpha',
          slug: 'security-hub-alpha',
          environment: 'development',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.project.name).toBe('Security Hub Alpha');
      expect(response.body.data.credential.publicKey).toMatch(/^alsh_pub_/);
      
      // One-time secret is revealed upon creation
      expect(response.body.data.oneTimeSecret).toMatch(/^alsh_sec_/);

      // Verify the secret stored in database is HASHED, NOT plaintext!
      expect(credentialCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: expect.stringMatching(/^alsh_pub_/),
          secretHash: expect.stringMatching(/^\$argon2id\$/), // Argon2id hash
        })
      );
    });

    it('should reject duplicate slug with 409 Conflict', async () => {
      vi.spyOn(Project, 'findOne').mockResolvedValue({ id: 'existing' } as any);

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          name: 'Duplicate Slug Project',
          slug: 'existing-slug',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('should reject invalid slug formatting with 400 Validation Error', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          name: 'Invalid Slug Project',
          slug: 'INVALID SLUG with spaces & capitals!',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/projects (Project List & Secret Leakage Prevention)', () => {
    it('should list owner projects without exposing secret or secretHash', async () => {
      const projId = new Types.ObjectId();
      const mockProject = {
        _id: projId,
        id: projId.toString(),
        ownerId: new Types.ObjectId(ownerAId),
        name: 'Project 1',
        slug: 'project-1',
        status: 'active',
        toJSON() {
          return { id: projId.toString(), name: 'Project 1', slug: 'project-1' };
        },
      };

      vi.spyOn(Project, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([mockProject]),
      } as any);

      vi.spyOn(ProjectCredential, 'find').mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          projectId: projId,
          publicKey: 'alsh_pub_1234567890abcdef',
          name: 'Primary Key',
          status: 'active',
          toJSON() {
            return {
              id: 'cred_1',
              publicKey: 'alsh_pub_1234567890abcdef',
              name: 'Primary Key',
              status: 'active',
            };
          },
        } as any,
      ]);

      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.projects).toHaveLength(1);

      // Verify zero private secret or secretHash leakage in list response
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('alsh_sec_');
      expect(responseText).not.toContain('secretHash');
      expect(responseText).not.toContain('argon2');
    });
  });

  describe('Cross-Owner Authorization Denial (Tenant Isolation)', () => {
    const projectBId = new Types.ObjectId();
    const mockProjectB = {
      _id: projectBId,
      id: projectBId.toString(),
      ownerId: new Types.ObjectId(ownerBId), // Owned by Owner B
      name: 'Owner B Private Project',
      slug: 'owner-b-project',
      status: 'active',
      save: vi.fn().mockResolvedValue(true),
      toJSON() {
        return { id: projectBId.toString(), name: 'Owner B Private Project' };
      },
    };

    beforeEach(() => {
      vi.spyOn(Project, 'findById').mockResolvedValue(mockProjectB as any);
    });

    it('should deny Owner A from viewing Owner B project (GET /projects/:id) with 403', async () => {
      const response = await request(app)
        .get(`/api/v1/projects/${projectBId}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`); // Owner A token!

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should deny Owner A from updating Owner B project (PATCH /projects/:id) with 403', async () => {
      const response = await request(app)
        .patch(`/api/v1/projects/${projectBId}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ name: 'Hacked Project Name' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should deny Owner A from archiving Owner B project (DELETE /projects/:id) with 403', async () => {
      const response = await request(app)
        .delete(`/api/v1/projects/${projectBId}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should deny Owner A from rotating Owner B credentials with 403', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${projectBId}/credentials/rotate`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ name: 'Malicious Rotation' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should deny Owner A from revoking Owner B credentials with 403', async () => {
      const credId = new Types.ObjectId().toString();
      const response = await request(app)
        .post(`/api/v1/projects/${projectBId}/credentials/revoke`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ credentialId: credId });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Credential Rotation & Revocation by Authorized Owner', () => {
    it('should rotate credentials, revoke prior credentials, and return new one-time secret', async () => {
      const projectAId = new Types.ObjectId();
      const mockProjectA = {
        _id: projectAId,
        id: projectAId.toString(),
        ownerId: new Types.ObjectId(ownerAId), // Owned by Owner A
        status: 'active',
      };

      vi.spyOn(Project, 'findById').mockResolvedValue(mockProjectA as any);
      const updateManySpy = vi.spyOn(ProjectCredential, 'updateMany').mockResolvedValue({} as any);

      vi.spyOn(ProjectCredential, 'create').mockImplementation(async (data: any) => ({
        _id: new Types.ObjectId(),
        publicKey: data.publicKey,
        name: data.name,
        status: data.status,
        toJSON() {
          return {
            id: 'rotated_cred_1',
            publicKey: data.publicKey,
            name: data.name,
            status: data.status,
          };
        },
      }) as any);

      const response = await request(app)
        .post(`/api/v1/projects/${projectAId}/credentials/rotate`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ name: 'Rotated Production Key' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.credential.publicKey).toMatch(/^alsh_pub_/);
      expect(response.body.data.oneTimeSecret).toMatch(/^alsh_sec_/);

      // Verify prior active credentials were revoked
      expect(updateManySpy).toHaveBeenCalledWith(
        { projectId: projectAId, status: 'active' },
        expect.objectContaining({ $set: expect.objectContaining({ status: 'revoked' }) })
      );
    });

    it('should revoke a single credential by authorized owner', async () => {
      const projectAId = new Types.ObjectId();
      const credId = new Types.ObjectId();

      const mockProjectA = {
        _id: projectAId,
        ownerId: new Types.ObjectId(ownerAId),
        status: 'active',
      };

      const mockCred = {
        _id: credId,
        projectId: projectAId,
        status: 'active',
        save: vi.fn().mockResolvedValue(true),
        toJSON() {
          return { id: credId.toString(), status: 'revoked' };
        },
      };

      vi.spyOn(Project, 'findById').mockResolvedValue(mockProjectA as any);
      vi.spyOn(ProjectCredential, 'findOne').mockResolvedValue(mockCred as any);

      const response = await request(app)
        .post(`/api/v1/projects/${projectAId}/credentials/revoke`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ credentialId: credId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockCred.status).toBe('revoked');
    });
  });
});
