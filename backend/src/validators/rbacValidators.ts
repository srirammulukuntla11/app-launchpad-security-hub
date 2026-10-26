import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Role name must be at least 2 characters')
    .max(50, 'Role name must not exceed 50 characters'),
  description: z.string().trim().max(255, 'Description must not exceed 255 characters').optional().default(''),
  permissions: z.array(z.string().trim().min(2)).default([]),
});

export const updateRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Role name must be at least 2 characters')
    .max(50, 'Role name must not exceed 50 characters')
    .optional(),
  description: z.string().trim().max(255, 'Description must not exceed 255 characters').optional(),
  permissions: z.array(z.string().trim().min(2)).optional(),
});

export const createPermissionSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, 'Permission key must be at least 2 characters')
    .max(100, 'Permission key must not exceed 100 characters')
    .regex(/^[a-z0-9_-]+:[a-z0-9_*-]+$/, 'Permission key must follow namespace:action format, e.g. reports:view'),
  description: z.string().trim().max(255, 'Description must not exceed 255 characters').optional().default(''),
});

export const assignRoleSchema = z.object({
  roleId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid role ID format'),
});

export const authorizeCheckSchema = z.object({
  permission: z.string().trim().min(2, 'Permission key is required').max(100),
});
