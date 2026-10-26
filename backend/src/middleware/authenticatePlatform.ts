import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AuthenticationError } from '../services/tokenService';
import { PlatformUser, IPlatformUser } from '../models/PlatformUser';

// Extend Express Request interface with platformUser property
declare global {
  namespace Express {
    interface Request {
      platformUser?: IPlatformUser;
    }
  }
}

export const authenticatePlatform = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Missing or malformed Bearer token.',
      },
    });
    return;
  }

  const token = authHeader.substring(7).trim();

  try {
    const decoded = verifyAccessToken(token);

    const user = await PlatformUser.findById(decoded.sub);
    if (!user || user.status !== 'active') {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User account is suspended or no longer exists.',
        },
      });
      return;
    }

    req.platformUser = user;
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
        message: 'Invalid authentication credentials.',
      },
    });
  }
};
