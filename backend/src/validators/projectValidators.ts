import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, 'Project name must be at least 2 characters').max(100, 'Project name must not exceed 100 characters'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, 'Project slug must be at least 2 characters')
    .max(50, 'Project slug must not exceed 50 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must only contain lowercase alphanumeric characters and single hyphens'),
  description: z.string().trim().max(500, 'Description must not exceed 500 characters').optional().default(''),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  allowedOrigins: z.array(z.string().trim().url('Origins must be valid URLs')).optional().default([]),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2, 'Project name must be at least 2 characters').max(100, 'Project name must not exceed 100 characters').optional(),
  description: z.string().trim().max(500, 'Description must not exceed 500 characters').optional(),
  environment: z.enum(['development', 'staging', 'production']).optional(),
  allowedOrigins: z.array(z.string().trim().url('Origins must be valid URLs')).optional(),
});

export const rotateCredentialSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
});

export const revokeCredentialSchema = z.object({
  credentialId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid credential ID format'),
});
