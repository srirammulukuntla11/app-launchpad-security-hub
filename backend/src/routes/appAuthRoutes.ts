import { Router } from 'express';
import {
  handleAppRegister,
  handleAppLogin,
  handleAppRefresh,
  handleAppLogout,
  handleAppGetMe,
} from '../controllers/appAuthController';
import {
  handleAuthorizeCheck,
  handleGetProtectedResource,
} from '../controllers/rbacController';
import {
  appRegisterSchema,
  appLoginSchema,
  appRefreshSchema,
  appLogoutSchema,
} from '../validators/appAuthValidators';
import { validateBody } from '../validators/authValidators';
import { authorizeCheckSchema } from '../validators/rbacValidators';
import { authRateLimiter } from '../middleware/rateLimiter';
import { authenticateAppUser } from '../middleware/authenticateAppUser';
import { requirePermission } from '../middleware/authorize';

const router = Router();

// Project-Scoped Application User Authentication Routes
router.post(
  '/:projectPublicKey/register',
  authRateLimiter,
  validateBody(appRegisterSchema),
  handleAppRegister
);

router.post(
  '/:projectPublicKey/login',
  authRateLimiter,
  validateBody(appLoginSchema),
  handleAppLogin
);

router.post(
  '/:projectPublicKey/refresh',
  validateBody(appRefreshSchema),
  handleAppRefresh
);

router.post(
  '/:projectPublicKey/logout',
  validateBody(appLogoutSchema),
  handleAppLogout
);

// Protected End-User Profile
router.get(
  '/:projectPublicKey/me',
  authenticateAppUser,
  handleAppGetMe
);

// Authorization Verification Endpoint (Stage 6 — Deny-by-default)
router.post(
  '/:projectPublicKey/authorize',
  authenticateAppUser,
  validateBody(authorizeCheckSchema),
  handleAuthorizeCheck
);

// Example Protected Application Resource (requires 'data:read' permission)
router.get(
  '/:projectPublicKey/protected/resource',
  authenticateAppUser,
  requirePermission('data:read'),
  handleGetProtectedResource
);

export default router;
