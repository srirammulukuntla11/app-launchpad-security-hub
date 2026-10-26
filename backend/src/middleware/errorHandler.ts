import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Safe operational logging on the server
  if (statusCode >= 500) {
    console.error('[ALSH ErrorHandler] Server Error:', {
      message: err.message,
      code: err.code,
      stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'ERROR'),
      message: statusCode === 500 && env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : message,
      details: err.details,
    },
  });
};
