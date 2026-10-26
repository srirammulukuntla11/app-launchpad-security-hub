import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlshClient, AlshClientError } from '../src/sdk/alshClient';

describe('ALSH Official Developer Client SDK (AlshClient)', () => {
  const mockBaseUrl = 'http://localhost:5000';
  const mockPublicKey = 'alsh_pub_test_app_key_12345';
  const mockSecret = 'alsh_sec_test_private_secret_99999';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should throw an AlshClientError if projectPublicKey is empty or omitted', () => {
      expect(() => new AlshClient({ baseUrl: mockBaseUrl, projectPublicKey: '' })).toThrow(
        AlshClientError
      );
    });

    it('should trim baseUrl trailing slashes properly', () => {
      const client = new AlshClient({
        baseUrl: 'http://localhost:5000///',
        projectPublicKey: mockPublicKey,
      });
      expect((client as any).baseUrl).toBe('http://localhost:5000');
    });
  });

  describe('End-User Authentication Operations', () => {
    it('should register end user and return token data', async () => {
      const mockResponseData = {
        user: { id: 'user_1', email: 'dev@test.com', status: 'active' },
        accessToken: 'mock_jwt_access',
        refreshToken: 'mock_refresh',
        expiresIn: '15m',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: mockResponseData }),
      } as any);

      const client = new AlshClient({
        baseUrl: mockBaseUrl,
        projectPublicKey: mockPublicKey,
      });

      const result = await client.register({
        email: 'dev@test.com',
        password: 'ValidPassword123!',
        name: 'Developer Test',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/v1/auth/${mockPublicKey}/register`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            email: 'dev@test.com',
            password: 'ValidPassword123!',
            name: 'Developer Test',
          }),
        })
      );
      expect(result.user.email).toBe('dev@test.com');
      expect(result.accessToken).toBe('mock_jwt_access');
    });

    it('should login end user successfully', async () => {
      const mockResponseData = {
        user: { id: 'user_1', email: 'dev@test.com', status: 'active' },
        accessToken: 'mock_jwt_access_login',
        refreshToken: 'mock_refresh_login',
        expiresIn: '15m',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockResponseData }),
      } as any);

      const client = new AlshClient({
        baseUrl: mockBaseUrl,
        projectPublicKey: mockPublicKey,
      });

      const result = await client.login({
        email: 'dev@test.com',
        password: 'ValidPassword123!',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/v1/auth/${mockPublicKey}/login`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'dev@test.com',
            password: 'ValidPassword123!',
          }),
        })
      );
      expect(result.accessToken).toBe('mock_jwt_access_login');
    });

    it('should refresh user session token', async () => {
      const mockResponseData = {
        accessToken: 'mock_new_access_token',
        refreshToken: 'mock_new_refresh_token',
        expiresIn: '15m',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockResponseData }),
      } as any);

      const client = new AlshClient({
        baseUrl: mockBaseUrl,
        projectPublicKey: mockPublicKey,
      });

      const result = await client.refreshToken('old_refresh_token');

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/v1/auth/${mockPublicKey}/refresh`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refreshToken: 'old_refresh_token' }),
        })
      );
      expect(result.accessToken).toBe('mock_new_access_token');
    });

    it('should check user permissions (RBAC)', async () => {
      const mockResponseData = {
        permitted: true,
        permission: 'reports:export',
        effectivePermissions: ['reports:export', 'data:read'],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockResponseData }),
      } as any);

      const client = new AlshClient({
        baseUrl: mockBaseUrl,
        projectPublicKey: mockPublicKey,
      });

      const result = await client.checkPermission('user_access_token', 'reports:export');

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/api/v1/auth/${mockPublicKey}/authorize`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer user_access_token',
          }),
          body: JSON.stringify({ permission: 'reports:export' }),
        })
      );
      expect(result.permitted).toBe(true);
      expect(result.effectivePermissions).toContain('reports:export');
    });

    it('should attach x-project-secret header when configured for server environments', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      } as any);

      const serverClient = new AlshClient({
        baseUrl: mockBaseUrl,
        projectPublicKey: mockPublicKey,
        projectPrivateSecret: mockSecret,
      });

      await serverClient.login({ email: 'a@b.com', password: '123' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-project-secret': mockSecret,
          }),
        })
      );
    });

    it('should normalize HTTP errors into AlshClientError', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
          },
        }),
      } as any);

      const client = new AlshClient({
        baseUrl: mockBaseUrl,
        projectPublicKey: mockPublicKey,
      });

      await expect(client.login({ email: 'bad@test.com', password: 'wrong' })).rejects.toThrow(
        AlshClientError
      );

      try {
        await client.login({ email: 'bad@test.com', password: 'wrong' });
      } catch (err: any) {
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('INVALID_CREDENTIALS');
        expect(err.message).toBe('Invalid email or password.');
      }
    });
  });
});
