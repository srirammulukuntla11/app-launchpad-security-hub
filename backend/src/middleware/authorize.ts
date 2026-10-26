import { Request, Response, NextFunction } from 'express';
import { resolveUserPermissions } from '../services/rbacService';
import { recordAuditEvent, AuditEvents } from '../services/auditService';

/**
 * Deny-by-default authorization middleware for application end-users
 * Requires authenticateAppUser to be run previously in the middleware pipeline
 */
export const requirePermission = (requiredPermission: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.appUser || !req.project) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required before verifying permissions.',
        },
      });
      return;
    }

    try {
      const userPermissions = await resolveUserPermissions(req.project._id, req.appUser._id);

      // Deny-by-default: strictly require exact permission match or wildcard admin '*'
      const isAuthorized =
        userPermissions.includes(requiredPermission) || userPermissions.includes('*');

      if (!isAuthorized) {
        // Record denied authorization audit event safely
        await recordAuditEvent({
          projectId: req.project._id,
          actorType: 'app',
          actorId: req.appUser._id,
          actorEmail: req.appUser.email,
          eventType: AuditEvents.AUTHORIZATION_DENIED,
          action: 'auth.authorize',
          outcome: 'failure',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string,
          metadata: { requiredPermission },
        });

        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Access denied. Missing required permission: ${requiredPermission}.`,
          },
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to resolve user authorization.',
        },
      });
    }
  };
};

/**
 * Deny-by-default authorization middleware requiring ANY of the specified permissions
 */
export const requireAnyPermission = (requiredPermissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.appUser || !req.project) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required before verifying permissions.',
        },
      });
      return;
    }

    try {
      const userPermissions = await resolveUserPermissions(req.project._id, req.appUser._id);

      const isAuthorized =
        userPermissions.includes('*') ||
        requiredPermissions.some((perm) => userPermissions.includes(perm));

      if (!isAuthorized) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Access denied. Requires at least one of: ${requiredPermissions.join(', ')}.`,
          },
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to resolve user authorization.',
        },
      });
    }
  };
};
