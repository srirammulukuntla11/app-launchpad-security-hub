import { z } from 'zod';

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  eventType: z.string().trim().optional(),
  outcome: z.enum(['success', 'failure']).optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
});
