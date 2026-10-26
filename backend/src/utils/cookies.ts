import { Response, Request } from 'express';
import { env } from '../config/env';

export const PLATFORM_REFRESH_COOKIE = 'alsh_platform_refresh';

export const getCookieOptions = () => {
  const isProduction = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ('none' as const) : ('lax' as const),
    path: '/api/v1/platform/auth',
    maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  };
};

export const setPlatformRefreshCookie = (res: Response, rawRefreshToken: string): void => {
  res.cookie(PLATFORM_REFRESH_COOKIE, rawRefreshToken, getCookieOptions());
};

export const clearPlatformRefreshCookie = (res: Response): void => {
  const options = getCookieOptions();
  res.clearCookie(PLATFORM_REFRESH_COOKIE, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  });
};

export const extractPlatformRefreshCookie = (req: Request): string | undefined => {
  return req.cookies?.[PLATFORM_REFRESH_COOKIE];
};
