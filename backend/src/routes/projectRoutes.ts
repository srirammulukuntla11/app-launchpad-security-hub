import { Router } from 'express';
import {
  handleCreateProject,
  handleListProjects,
  handleGetProject,
  handleUpdateProject,
  handleArchiveProject,
  handleRotateCredentials,
  handleRevokeCredential,
} from '../controllers/projectController';
import {
  handleListRoles,
  handleCreateRole,
  handleUpdateRole,
  handleDeleteRole,
  handleListPermissions,
  handleCreatePermission,
  handleGetUserRoles,
  handleAssignRoleToUser,
  handleRevokeRoleFromUser,
} from '../controllers/rbacController';
import { handleListProjectAuditLogs } from '../controllers/auditController';
import { authenticatePlatform } from '../middleware/authenticatePlatform';
import { validateBody } from '../validators/authValidators';
import {
  createProjectSchema,
  updateProjectSchema,
  rotateCredentialSchema,
  revokeCredentialSchema,
} from '../validators/projectValidators';
import {
  createRoleSchema,
  updateRoleSchema,
  createPermissionSchema,
  assignRoleSchema,
} from '../validators/rbacValidators';

const router = Router();

// All project management endpoints require platform owner authentication
router.use(authenticatePlatform);

router.post('/', validateBody(createProjectSchema), handleCreateProject);
router.get('/', handleListProjects);
router.get('/:projectId', handleGetProject);
router.patch('/:projectId', validateBody(updateProjectSchema), handleUpdateProject);
router.delete('/:projectId', handleArchiveProject);

// Credential Lifecycle
router.post('/:projectId/credentials/rotate', validateBody(rotateCredentialSchema), handleRotateCredentials);
router.post('/:projectId/credentials/revoke', validateBody(revokeCredentialSchema), handleRevokeCredential);

// Roles & Permissions Management (Stage 6)
router.get('/:projectId/roles', handleListRoles);
router.post('/:projectId/roles', validateBody(createRoleSchema), handleCreateRole);
router.patch('/:projectId/roles/:roleId', validateBody(updateRoleSchema), handleUpdateRole);
router.delete('/:projectId/roles/:roleId', handleDeleteRole);

router.get('/:projectId/permissions', handleListPermissions);
router.post('/:projectId/permissions', validateBody(createPermissionSchema), handleCreatePermission);

// Role Assignment to Application Users (Strict Project-Scoped)
router.get('/:projectId/users/:appUserId/roles', handleGetUserRoles);
router.post('/:projectId/users/:appUserId/roles', validateBody(assignRoleSchema), handleAssignRoleToUser);
router.delete('/:projectId/users/:appUserId/roles/:roleId', handleRevokeRoleFromUser);

// Security Audit Event Logs (Stage 7)
router.get('/:projectId/audit-logs', handleListProjectAuditLogs);

export default router;
