import { Request, Response, NextFunction } from 'express';
import { verifyAppAccessToken, AuthenticationError } from '../services/tokenService';
import { resolveProjectByPublicKey } from '../services/appAuthService';
import { AppUser, IAppUser } from '../models/AppUser';
import { IProject } from '../models/Project';

declare global {
  namespace Express {
    interface Request {
      appUser?: IAppUser;
      project?: IProject;
    }
  }
}

export const authenticateAppUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { projectPublicKey } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Missing Bearer token.',
      },
    });
    return;
  }

  const token = authHeader.substring(7).trim();

  try {
    const { project } = await resolveProjectByPublicKey(String(projectPublicKey));

    // Verify token belongs to this exact project
    const decoded = verifyAppAccessToken(token, project._id.toString());

    const user = await AppUser.findOne({
      _id: decoded.sub,
      projectId: project._id,
      status: 'active',
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User account not found or suspended in this project.',
        },
      });
      return;
    }

    req.appUser = user;
    req.project = project;
    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid project key or access token.',
      },
    });
  }
};
