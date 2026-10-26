import { Request, Response, NextFunction } from 'express';
import { listProjectAuditLogs } from '../services/auditService';

export const handleListProjectAuditLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);

    const result = await listProjectAuditLogs(ownerId, projectId, req.query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
