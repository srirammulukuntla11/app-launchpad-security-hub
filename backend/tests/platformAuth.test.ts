import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { PlatformUser } from '../src/models/PlatformUser';
import { Session } from '../src/models/Session';
import { hashPassword, hashToken } from '../src/utils/crypto';
import { signAccessToken } from '../src/services/tokenService';
import { PLATFORM_REFRESH_COOKIE } from '../src/utils/cookies';

describe('Platform Owner Authentication API (/api/v1/platform)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/platform/auth/register', () => {
    it('should register a new platform owner with valid credentials', async () => {
      vi.spyOn(PlatformUser, 'findOne').mockResolvedValue(null);
      vi.spyOn(PlatformUser, 'create').mockImplementation(async (data: any) => ({
        _id: '507f1f77bcf86cd799439011',
        name: data.name,
        email: data.email,
        status: data.status,
        createdAt: new Date(),
        updatedAt: new Date(),
        toJSON() {
          return {
            id: '507f1f77bcf86cd799439011',
            name: data.name,
            email: data.email,
            status: data.status,
          };
        },
      }) as any);

      const response = await request(app)
        .post('/api/v1/platform/auth/register')
        .send({
          name: 'Jane Developer',
          email: 'jane@example.com',
          password: 'SecurePassword123!',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('jane@example.com');
      // Ensure password hash is not returned
      expect(response.body.data.user.passwordHash).toBeUndefined();
    });

    it('should reject registration if email is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/platform/auth/register')
        .send({
          name: 'Jane Developer',
          email: 'not-an-email',
          password: 'SecurePassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration if password does not meet complexity rules', async () => {
      const response = await request(app)
        .post('/api/v1/platform/auth/register')
        .send({
          name: 'Jane Developer',
          email: 'jane@example.com',
          password: 'weak', // too short, no uppercase, no number
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 Conflict if email is already registered', async () => {
      vi.spyOn(PlatformUser, 'findOne').mockResolvedValue({ id: 'existing_id' } as any);

      const response = await request(app)
        .post('/api/v1/platform/auth/register')
        .send({
          name: 'Jane Developer',
          email: 'jane@example.com',
          password: 'SecurePassword123!',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');
    });
  });

  describe('POST /api/v1/platform/auth/login', () => {
    it('should authenticate platform owner and return access token with HttpOnly refresh cookie', async () => {
      const password = 'CorrectPassword123!';
      const passwordHash = await hashPassword(password);

      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Jane Developer',
        email: 'jane@example.com',
        status: 'active',
        passwordHash,
        createdAt: new Date(),
        toJSON() {
          return {
            id: '507f1f77bcf86cd799439011',
            name: 'Jane Developer',
            email: 'jane@example.com',
            status: 'active',
          };
        },
      };

      vi.spyOn(PlatformUser, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      } as any);

      vi.spyOn(Session, 'create').mockResolvedValue({
        _id: 'session_123',
        tokenFamily: 'family_123',
      } as any);

      const response = await request(app)
        .post('/api/v1/platform/auth/login')
        .send({
          email: 'jane@example.com',
          password,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('user');

      // CRITICAL: Refresh token must NEVER be returned in JSON response
      expect(response.body.data.refreshToken).toBeUndefined();
      expect(response.body.data.rawRefreshToken).toBeUndefined();

      // Verify HttpOnly cookie is set
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find((c) => c.startsWith(`${PLATFORM_REFRESH_COOKIE}=`));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    it('should return 401 with generic error message for invalid password', async () => {
      const passwordHash = await hashPassword('CorrectPassword123!');
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'jane@example.com',
        status: 'active',
        passwordHash,
      };

      vi.spyOn(PlatformUser, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      } as any);

      const response = await request(app)
        .post('/api/v1/platform/auth/login')
        .send({
          email: 'jane@example.com',
          password: 'WrongPassword999!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toBe('Invalid email or password.');
    });

    it('should return 401 with generic error message if email does not exist', async () => {
      vi.spyOn(PlatformUser, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);

      const response = await request(app)
        .post('/api/v1/platform/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid email or password.');
    });
  });

  describe('POST /api/v1/platform/auth/refresh', () => {
    it('should return 401 if refresh token cookie is missing', async () => {
      const response = await request(app).post('/api/v1/platform/auth/refresh');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should rotate session and return new access token when valid cookie is provided', async () => {
      const rawToken = 'valid_raw_refresh_token_value_32chars!';
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 5); // 5 days remaining

      const existingSession = {
        _id: 'session_old',
        tokenHash: hashToken(rawToken),
        tokenFamily: 'family_456',
        userType: 'platform',
        userId: '507f1f77bcf86cd799439011',
        expiresAt,
        isRevoked: false,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Session, 'findOne').mockResolvedValue(existingSession as any);
      vi.spyOn(Session, 'create').mockResolvedValue({
        _id: 'session_new',
        tokenFamily: 'family_456',
      } as any);

      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'jane@example.com',
        name: 'Jane',
        status: 'active',
      };
      vi.spyOn(PlatformUser, 'findById').mockResolvedValue(mockUser as any);

      const response = await request(app)
        .post('/api/v1/platform/auth/refresh')
        .set('Cookie', [`${PLATFORM_REFRESH_COOKIE}=${rawToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.refreshToken).toBeUndefined();

      // Ensure rotated cookie is set
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain(PLATFORM_REFRESH_COOKIE);
      expect(existingSession.isRevoked).toBe(true);
    });

    it('should detect token reuse and invalidate the entire token family', async () => {
      const replayedToken = 'stolen_or_already_rotated_token';
      const revokedSession = {
        _id: 'session_stolen',
        tokenHash: hashToken(replayedToken),
        tokenFamily: 'family_compromised',
        userType: 'platform',
        userId: '507f1f77bcf86cd799439011',
        expiresAt: new Date(Date.now() + 100000),
        isRevoked: true, // ALREADY REVOKED / ROTATED
      };

      vi.spyOn(Session, 'findOne').mockResolvedValue(revokedSession as any);
      const updateManySpy = vi.spyOn(Session, 'updateMany').mockResolvedValue({} as any);

      const response = await request(app)
        .post('/api/v1/platform/auth/refresh')
        .set('Cookie', [`${PLATFORM_REFRESH_COOKIE}=${replayedToken}`]);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_REUSE_DETECTED');

      // Verify all sessions in this family are revoked
      expect(updateManySpy).toHaveBeenCalledWith(
        { tokenFamily: 'family_compromised' },
        expect.objectContaining({ $set: expect.objectContaining({ isRevoked: true }) })
      );
    });
  });

  describe('POST /api/v1/platform/auth/logout', () => {
    it('should revoke session and clear refresh cookie', async () => {
      const rawToken = 'token_to_logout';
      const session = {
        tokenHash: hashToken(rawToken),
        isRevoked: false,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Session, 'findOne').mockResolvedValue(session as any);

      const response = await request(app)
        .post('/api/v1/platform/auth/logout')
        .set('Cookie', [`${PLATFORM_REFRESH_COOKIE}=${rawToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(session.isRevoked).toBe(true);

      // Verify cookie is cleared (expires in the past)
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain(`${PLATFORM_REFRESH_COOKIE}=;`);
    });
  });

  describe('GET /api/v1/platform/me (Protected)', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const response = await request(app).get('/api/v1/platform/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 200 with user profile when valid access token is provided', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = signAccessToken({
        sub: userId,
        email: 'jane@example.com',
        name: 'Jane Developer',
      });

      const mockUser = {
        _id: userId,
        id: userId,
        name: 'Jane Developer',
        email: 'jane@example.com',
        status: 'active',
        createdAt: new Date(),
      };

      vi.spyOn(PlatformUser, 'findById').mockResolvedValue(mockUser as any);

      const response = await request(app)
        .get('/api/v1/platform/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('jane@example.com');
    });

    it('should return 401 when access token is invalid or tampered', async () => {
      const response = await request(app)
        .get('/api/v1/platform/me')
        .set('Authorization', 'Bearer invalid_tampered_token_here');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Rate Limiting on Authentication Endpoints', () => {
    it('should throttle repeated authentication requests exceeding limit with 429', async () => {
      vi.spyOn(PlatformUser, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as any);

      let lastResponse: request.Response | undefined;

      // Make requests until rate limit threshold (20) is exceeded
      for (let i = 0; i < 22; i++) {
        lastResponse = await request(app)
          .post('/api/v1/platform/auth/login')
          .send({ email: 'spam@example.com', password: 'Password123!' });
      }

      expect(lastResponse).toBeDefined();
      expect(lastResponse?.status).toBe(429);
      expect(lastResponse?.body.success).toBe(false);
      expect(lastResponse?.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(lastResponse?.body.error.message).toContain('Too many authentication attempts');
    });
  });
});
