import { describe, it, expect } from 'vitest';
import { envSchema } from '../src/config/env';

describe('Environment Configuration Validation', () => {
  it('should validate valid environment values', () => {
    const validConfig = {
      NODE_ENV: 'test',
      PORT: '5001',
      CLIENT_ORIGIN: 'http://localhost:5173',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/fake_test_db',
      JWT_ACCESS_SECRET: 'super_secret_jwt_access_token_key_12345',
      JWT_ACCESS_EXPIRES_IN: '15m',
      REFRESH_TOKEN_EXPIRES_DAYS: '7',
      COOKIE_SECRET: 'super_secret_cookie_signing_key_12345',
    };

    const parsed = envSchema.parse(validConfig);
    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.PORT).toBe(5001);
    expect(parsed.REFRESH_TOKEN_EXPIRES_DAYS).toBe(7);
  });

  it('should use default values for optional environment variables', () => {
    const minimalConfig = {};
    const parsed = envSchema.parse(minimalConfig);

    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.PORT).toBe(5000);
    expect(parsed.CLIENT_ORIGIN).toBe('http://localhost:5173');
    expect(parsed.JWT_ACCESS_EXPIRES_IN).toBe('15m');
  });

  it('should fail when PORT is not a valid number', () => {
    const invalidConfig = {
      PORT: 'not-a-number',
    };

    expect(() => envSchema.parse(invalidConfig)).toThrow();
  });

  it('should fail when CLIENT_ORIGIN is wildcard *', () => {
    const invalidConfig = {
      CLIENT_ORIGIN: '*',
    };

    expect(() => envSchema.parse(invalidConfig)).toThrow(/CLIENT_ORIGIN must not include wildcard/);
  });
});
