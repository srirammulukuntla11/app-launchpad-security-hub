import { Request, Response, NextFunction } from 'express';
import {
  registerAppUser,
  loginAppUser,
  refreshAppUserSession,
  logoutAppUser,
} from '../services/appAuthService';

export const handleAppRegister = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const projectPublicKey = String(req.params.projectPublicKey);
    const result = await registerAppUser(projectPublicKey, req.body);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleAppLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const projectPublicKey = String(req.params.projectPublicKey);
    const result = await loginAppUser(projectPublicKey, req.body, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleAppRefresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const projectPublicKey = String(req.params.projectPublicKey);
    const { refreshToken } = req.body;

    const result = await refreshAppUserSession(projectPublicKey, refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleAppLogout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const projectPublicKey = String(req.params.projectPublicKey);
    const { refreshToken } = req.body;

    await logoutAppUser(projectPublicKey, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
};

export const handleAppGetMe = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    data: {
      user: req.appUser,
      project: {
        id: req.project?._id.toString(),
        name: req.project?.name,
        slug: req.project?.slug,
      },
    },
  });
};
