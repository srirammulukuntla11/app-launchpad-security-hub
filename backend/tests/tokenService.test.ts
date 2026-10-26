import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken, AuthenticationError } from '../src/services/tokenService';
import { env } from '../src/config/env';

describe('Token Service (JWT Lifecycle)', () => {
  it('should sign and verify a valid platform access token', () => {
    const payload = {
      sub: '507f1f77bcf86cd799439011',
      email: 'owner@example.com',
      name: 'Platform Owner',
    };

    const token = signAccessToken(payload);
    expect(token).toBeDefined();

    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.name).toBe(payload.name);
    expect(decoded.type).toBe('platform');
  });

  it('should reject an expired access token', () => {
    // Generate an already expired token
    const expiredToken = jwt.sign(
      { sub: '507f1f77bcf86cd799439011', type: 'platform', email: 'owner@example.com', name: 'Owner' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '-1s' }
    );

    expect(() => verifyAccessToken(expiredToken)).toThrow(AuthenticationError);
    try {
      verifyAccessToken(expiredToken);
    } catch (err) {
      expect((err as AuthenticationError).code).toBe('TOKEN_EXPIRED');
      expect((err as AuthenticationError).statusCode).toBe(401);
    }
  });

  it('should reject a tampered access token', () => {
    const validToken = signAccessToken({
      sub: '507f1f77bcf86cd799439011',
      email: 'owner@example.com',
      name: 'Owner',
    });

    const tamperedToken = validToken.slice(0, -5) + 'xxxxx';

    expect(() => verifyAccessToken(tamperedToken)).toThrow(AuthenticationError);
    try {
      verifyAccessToken(tamperedToken);
    } catch (err) {
      expect((err as AuthenticationError).code).toBe('INVALID_TOKEN');
      expect((err as AuthenticationError).statusCode).toBe(401);
    }
  });

  it('should reject a token with incorrect token type', () => {
    const nonPlatformToken = jwt.sign(
      { sub: '507f1f77bcf86cd799439011', type: 'app_user', email: 'user@example.com', name: 'User' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    expect(() => verifyAccessToken(nonPlatformToken)).toThrow(AuthenticationError);
    try {
      verifyAccessToken(nonPlatformToken);
    } catch (err) {
      expect((err as AuthenticationError).code).toBe('INVALID_TOKEN');
    }
  });
});
