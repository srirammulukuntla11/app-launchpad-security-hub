import { Request, Response, NextFunction } from 'express';
import {
  registerPlatformUser,
  loginPlatformUser,
  refreshPlatformSession,
  logoutPlatformUser,
} from '../services/platformAuthService';
import {
  setPlatformRefreshCookie,
  clearPlatformRefreshCookie,
  extractPlatformRefreshCookie,
} from '../utils/cookies';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await registerPlatformUser(req.body);

    res.status(201).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { user, accessToken, rawRefreshToken } = await loginPlatformUser(req.body, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    // Set refresh token in secure HttpOnly cookie (never in JSON body)
    setPlatformRefreshCookie(res, rawRefreshToken);

    res.status(200).json({
      success: true,
      data: {
        user,
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawRefreshToken = extractPlatformRefreshCookie(req);

    if (!rawRefreshToken) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Refresh token cookie is missing.',
        },
      });
      return;
    }

    const { accessToken, newRawRefreshToken } = await refreshPlatformSession(rawRefreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    // Update the HttpOnly cookie with the rotated refresh token
    setPlatformRefreshCookie(res, newRawRefreshToken);

    res.status(200).json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (error) {
    // If refresh fails, clear invalid cookie
    clearPlatformRefreshCookie(res);
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawRefreshToken = extractPlatformRefreshCookie(req);

    await logoutPlatformUser(rawRefreshToken);
    clearPlatformRefreshCookie(res);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    clearPlatformRefreshCookie(res);
    next(error);
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    data: {
      user: req.platformUser,
    },
  });
};
