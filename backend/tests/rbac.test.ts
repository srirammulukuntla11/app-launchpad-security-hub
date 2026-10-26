import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../src/app';
import { PlatformUser } from '../src/models/PlatformUser';
import { Project } from '../src/models/Project';
import { ProjectCredential } from '../src/models/ProjectCredential';
import { Role } from '../src/models/Role';
import { Permission } from '../src/models/Permission';
import { AppUser } from '../src/models/AppUser';
import { AppUserRole } from '../src/models/AppUserRole';
import { signAccessToken, signAppAccessToken } from '../src/services/tokenService';

describe('Stage 6 — RBAC and Project Isolation API', () => {
  const ownerAId = new Types.ObjectId();
  const ownerBId = new Types.ObjectId();

  const projectAId = new Types.ObjectId();
  const projectBId = new Types.ObjectId();

  const publicProjectAKey = 'alsh_pub_proj_alpha_key_9999';
  const publicProjectBKey = 'alsh_pub_proj_beta_key_8888';

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

    vi.spyOn(Project, 'findOne').mockImplementation((query: any) => {
      const idStr = query._id?.toString();
      if (idStr === projectAId.toString()) return Promise.resolve(mockProjectA as any);
      if (idStr === projectBId.toString()) return Promise.resolve(mockProjectB as any);
      return Promise.resolve(null);
    });

    // Mock ProjectCredential lookup for AppUser auth
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
  });

  describe('Role Management APIs (/api/v1/projects/:projectId/roles)', () => {
    it('should provision and return default system roles if no roles exist', async () => {
      vi.spyOn(Role, 'countDocuments').mockResolvedValue(0);
      vi.spyOn(Role, 'insertMany').mockResolvedValue([] as any);
      vi.spyOn(Role, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            name: 'admin',
            description: 'Full administrative access',
            isSystem: true,
            permissions: ['users:read', 'users:write', 'roles:read', 'roles:write', 'data:read', 'data:write'],
          },
          {
            _id: new Types.ObjectId(),
            name: 'member',
            description: 'Standard member',
            isSystem: true,
            permissions: ['data:read', 'data:write', 'users:read'],
          },
          {
            _id: new Types.ObjectId(),
            name: 'viewer',
            description: 'Read-only access',
            isSystem: true,
            permissions: ['data:read'],
          },
        ]),
      } as any);

      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/roles`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data.map((r: any) => r.name)).toEqual(['admin', 'member', 'viewer']);
      expect(Role.insertMany).toHaveBeenCalled();
    });

    it('should allow platform owner to create a custom role in Project A', async () => {
      vi.spyOn(Role, 'findOne').mockResolvedValue(null);

      const roleId = new Types.ObjectId();
      vi.spyOn(Role, 'create').mockResolvedValue({
        _id: roleId,
        id: roleId.toString(),
        projectId: projectAId,
        name: 'editor',
        description: 'Content editor',
        isSystem: false,
        permissions: ['data:read', 'data:write'],
      } as any);

      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/roles`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          name: 'editor',
          description: 'Content editor',
          permissions: ['data:read', 'data:write'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('editor');
      expect(res.body.data.isSystem).toBe(false);
    });

    it('should reject duplicate role name within the same project with 409 Conflict', async () => {
      vi.spyOn(Role, 'findOne').mockResolvedValue({
        _id: new Types.ObjectId(),
        name: 'editor',
        projectId: projectAId,
      } as any);

      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/roles`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          name: 'editor',
          permissions: ['data:read'],
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should reject deleting a system role with 400 validation error', async () => {
      const systemRoleId = new Types.ObjectId();
      vi.spyOn(Role, 'findOne').mockResolvedValue({
        _id: systemRoleId,
        name: 'admin',
        isSystem: true,
        projectId: projectAId,
      } as any);

      const res = await request(app)
        .delete(`/api/v1/projects/${projectAId}/roles/${systemRoleId}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('protected and cannot be deleted');
    });

    it('should allow deleting a custom role and cascade delete assignments', async () => {
      const customRoleId = new Types.ObjectId();
      vi.spyOn(Role, 'findOne').mockResolvedValue({
        _id: customRoleId,
        name: 'custom_role',
        isSystem: false,
        projectId: projectAId,
      } as any);
      vi.spyOn(AppUserRole, 'deleteMany').mockResolvedValue({} as any);
      vi.spyOn(Role, 'deleteOne').mockResolvedValue({} as any);

      const res = await request(app)
        .delete(`/api/v1/projects/${projectAId}/roles/${customRoleId}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(AppUserRole.deleteMany).toHaveBeenCalledWith({
        projectId: projectAId,
        roleId: customRoleId,
      });
      expect(Role.deleteOne).toHaveBeenCalledWith({
        _id: customRoleId,
        projectId: projectAId,
      });
    });

    it('should prevent modifying system role names with 400', async () => {
      const systemRoleId = new Types.ObjectId();
      vi.spyOn(Role, 'findOne').mockResolvedValue({
        _id: systemRoleId,
        name: 'admin',
        isSystem: true,
        projectId: projectAId,
      } as any);

      const res = await request(app)
        .patch(`/api/v1/projects/${projectAId}/roles/${systemRoleId}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ name: 'superadmin' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('System role names cannot be modified');
    });
  });

  describe('Permission Catalog and Custom Permissions (/api/v1/projects/:projectId/permissions)', () => {
    it('should list catalog permissions alongside custom project permissions', async () => {
      vi.spyOn(Permission, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue([
          {
            key: 'reports:export',
            description: 'Export monthly reports',
          },
        ]),
      } as any);

      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/permissions`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const keys = res.body.data.map((p: any) => p.key);
      expect(keys).toContain('users:read');
      expect(keys).toContain('data:write');
      expect(keys).toContain('reports:export');
    });

    it('should create a custom project permission with namespace:action validation', async () => {
      vi.spyOn(Permission, 'findOne').mockResolvedValue(null);
      const permId = new Types.ObjectId();
      vi.spyOn(Permission, 'create').mockResolvedValue({
        _id: permId,
        id: permId.toString(),
        projectId: projectAId,
        key: 'billing:manage',
        description: 'Manage billing invoices',
      } as any);

      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/permissions`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          key: 'billing:manage',
          description: 'Manage billing invoices',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.key).toBe('billing:manage');
    });

    it('should reject invalid permission key format with 400', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/permissions`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          key: 'INVALID_FORMAT_NO_COLON',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Role Assignment and Revocation (/api/v1/projects/:projectId/users/:appUserId/roles)', () => {
    const userAId = new Types.ObjectId();
    const roleAId = new Types.ObjectId();

    it('should assign a valid project role to an existing user in Project A', async () => {
      vi.spyOn(AppUser, 'findOne').mockResolvedValue({
        _id: userAId,
        projectId: projectAId,
      } as any);

      vi.spyOn(Role, 'findOne').mockResolvedValue({
        _id: roleAId,
        projectId: projectAId,
        name: 'member',
      } as any);

      vi.spyOn(AppUserRole, 'findOne').mockResolvedValue(null);
      const assignmentId = new Types.ObjectId();
      vi.spyOn(AppUserRole, 'create').mockResolvedValue({
        _id: assignmentId,
        projectId: projectAId,
        appUserId: userAId,
        roleId: roleAId,
      } as any);

      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/users/${userAId}/roles`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ roleId: roleAId.toString() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(AppUserRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: projectAId,
          appUserId: userAId,
          roleId: roleAId,
        })
      );
    });

    it('should revoke a role from user in Project A', async () => {
      vi.spyOn(AppUser, 'findOne').mockResolvedValue({
        _id: userAId,
        projectId: projectAId,
      } as any);

      vi.spyOn(AppUserRole, 'findOneAndDelete').mockResolvedValue({
        _id: new Types.ObjectId(),
        projectId: projectAId,
      } as any);

      const res = await request(app)
        .delete(`/api/v1/projects/${projectAId}/users/${userAId}/roles/${roleAId}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Role revoked');
    });
  });

  describe('Strict Cross-Project Isolation & Negative Authorization Checks', () => {
    it('should DENY Owner A from listing or modifying roles in Project B (Cross-Owner Denial 403)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectBId}/roles`)
        .set('Authorization', `Bearer ${tokenOwnerA}`); // Owner A calling Project B

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('You do not own this project');
    });

    it('should REJECT assigning a role to a user that belongs to another project (Cross-Project User Denial)', async () => {
      const userFromProjectB = new Types.ObjectId();
      const roleInProjectA = new Types.ObjectId();

      // AppUser exists, but in Project B!
      vi.spyOn(AppUser, 'findOne').mockImplementation((query: any) => {
        // Query will include projectId: projectAId, so will return null
        return Promise.resolve(null);
      });

      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/users/${userFromProjectB}/roles`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ roleId: roleInProjectA.toString() });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('User not found in this project');
    });

    it('should REJECT assigning a role from Project B to a user in Project A (Cross-Project Role Denial)', async () => {
      const userInProjectA = new Types.ObjectId();
      const roleFromProjectB = new Types.ObjectId();

      vi.spyOn(AppUser, 'findOne').mockResolvedValue({
        _id: userInProjectA,
        projectId: projectAId,
      } as any);

      // Role lookup with projectId: projectAId fails because role belongs to Project B!
      vi.spyOn(Role, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/users/${userInProjectA}/roles`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ roleId: roleFromProjectB.toString() });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Role not found in this project');
    });
  });

  describe('Deny-by-Default End-User Permission Resolution & Authorization Middleware', () => {
    const endUserAId = new Types.ObjectId();

    const appTokenUserA = signAppAccessToken({
      sub: endUserAId.toString(),
      email: 'user_a@projectalpha.com',
      projectId: projectAId.toString(),
    });

    beforeEach(() => {
      vi.spyOn(AppUser, 'findOne').mockResolvedValue({
        _id: endUserAId,
        id: endUserAId.toString(),
        email: 'user_a@projectalpha.com',
        projectId: projectAId,
        status: 'active',
      } as any);
    });

    it('should DENY access by default if end-user has NO assigned roles (Deny-by-Default)', async () => {
      // User has 0 assigned roles
      vi.spyOn(AppUserRole, 'find').mockResolvedValue([]);

      const res = await request(app)
        .post(`/api/v1/auth/${publicProjectAKey}/authorize`)
        .set('Authorization', `Bearer ${appTokenUserA}`)
        .send({ permission: 'data:read' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Missing required permission: data:read');
    });

    it('should PERMIT authorized permission and DENY unauthorized permission for Viewer role', async () => {
      const viewerRoleId = new Types.ObjectId();

      vi.spyOn(AppUserRole, 'find').mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          projectId: projectAId,
          appUserId: endUserAId,
          roleId: viewerRoleId,
        },
      ] as any);

      vi.spyOn(Role, 'find').mockResolvedValue([
        {
          _id: viewerRoleId,
          projectId: projectAId,
          name: 'viewer',
          permissions: ['data:read'], // Only has data:read!
        },
      ] as any);

      // 1. Check data:read (Permitted)
      const permitRes = await request(app)
        .post(`/api/v1/auth/${publicProjectAKey}/authorize`)
        .set('Authorization', `Bearer ${appTokenUserA}`)
        .send({ permission: 'data:read' });

      expect(permitRes.status).toBe(200);
      expect(permitRes.body.success).toBe(true);
      expect(permitRes.body.data.permitted).toBe(true);
      expect(permitRes.body.data.effectivePermissions).toEqual(['data:read']);

      // 2. Check data:write (Denied with 403)
      const denyRes = await request(app)
        .post(`/api/v1/auth/${publicProjectAKey}/authorize`)
        .set('Authorization', `Bearer ${appTokenUserA}`)
        .send({ permission: 'data:write' });

      expect(denyRes.status).toBe(403);
      expect(denyRes.body.success).toBe(false);
      expect(denyRes.body.error.code).toBe('FORBIDDEN');
      expect(denyRes.body.error.message).toContain('Missing required permission: data:write');
    });

    it('should enforce requirePermission middleware on protected route', async () => {
      const viewerRoleId = new Types.ObjectId();

      vi.spyOn(AppUserRole, 'find').mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          projectId: projectAId,
          appUserId: endUserAId,
          roleId: viewerRoleId,
        },
      ] as any);

      vi.spyOn(Role, 'find').mockResolvedValue([
        {
          _id: viewerRoleId,
          projectId: projectAId,
          name: 'viewer',
          permissions: ['data:read'],
        },
      ] as any);

      // Route requires 'data:read' -> user has it -> 200
      const res = await request(app)
        .get(`/api/v1/auth/${publicProjectAKey}/protected/resource`)
        .set('Authorization', `Bearer ${appTokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Access granted');
    });

    it('should block end-user token from calling platform owner role management endpoints (Privilege Escalation Prevention)', async () => {
      // Calling /api/v1/projects/:projectId/roles with an AppUser token instead of PlatformUser token!
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/roles`)
        .set('Authorization', `Bearer ${appTokenUserA}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });
});
