import { z } from 'zod';

export const appRegisterSchema = z.object({
  email: z.string().trim().email('A valid email address is required').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  name: z.string().trim().max(100).optional().default(''),
  metadata: z.record(z.any()).optional().default({}),
});

export const appLoginSchema = z.object({
  email: z.string().trim().email('A valid email address is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const appRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const appLogoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
