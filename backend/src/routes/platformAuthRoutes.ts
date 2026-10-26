import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
} from '../controllers/platformAuthController';
import { validateBody, registerSchema, loginSchema } from '../validators/authValidators';
import { authRateLimiter } from '../middleware/rateLimiter';
import { authenticatePlatform } from '../middleware/authenticatePlatform';

const router = Router();

// Public Platform Owner Authentication Routes (with rate limiting & validation)
router.post('/auth/register', authRateLimiter, validateBody(registerSchema), register);
router.post('/auth/login', authRateLimiter, validateBody(loginSchema), login);
router.post('/auth/refresh', refresh);
router.post('/auth/logout', logout);

// Protected Platform Owner Profile
router.get('/me', authenticatePlatform, getMe);

export default router;
