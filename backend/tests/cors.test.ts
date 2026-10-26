import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('CORS Configuration & Security Verification', () => {
  const allowedOrigin = 'http://localhost:5173';
  const unapprovedOrigin = 'http://malicious-attacker.com';

  describe('Allowed Origin (http://localhost:5173) with Credentials', () => {
    it('should set exact Access-Control-Allow-Origin and Credentials for registration preflight', async () => {
      const res = await request(app)
        .options('/api/v1/platform/auth/register')
        .set('Origin', allowedOrigin)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });

    it('should set exact Access-Control-Allow-Origin and Credentials for login preflight', async () => {
      const res = await request(app)
        .options('/api/v1/platform/auth/login')
        .set('Origin', allowedOrigin)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });

    it('should set exact Access-Control-Allow-Origin and Credentials for actual requests', async () => {
      const res = await request(app)
        .post('/api/v1/platform/auth/refresh')
        .set('Origin', allowedOrigin);

      // Even if refresh returns an auth error (no cookie), CORS headers must be present and exact
      expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    });
  });

  describe('Unapproved Origin Rejection', () => {
    it('should not grant credentialed CORS access to unapproved origin on preflight', async () => {
      const res = await request(app)
        .options('/api/v1/platform/auth/login')
        .set('Origin', unapprovedOrigin)
        .set('Access-Control-Request-Method', 'POST');

      // Unapproved origin must not receive Access-Control-Allow-Origin or credentialed access
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('should not grant credentialed CORS access to unapproved origin on actual requests', async () => {
      const res = await request(app)
        .post('/api/v1/platform/auth/refresh')
        .set('Origin', unapprovedOrigin);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });
  });

  describe('Wildcard Prohibition', () => {
    it('must never return wildcard "*" when credentials are true', async () => {
      const res = await request(app)
        .post('/api/v1/platform/auth/refresh')
        .set('Origin', allowedOrigin);

      expect(res.headers['access-control-allow-origin']).not.toBe('*');
      if (res.headers['access-control-allow-credentials'] === 'true') {
        expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
      }
    });
  });

  describe('Non-browser / Direct Server-to-Server Requests', () => {
    it('should succeed normally without Origin header (e.g. curl / health checks)', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
