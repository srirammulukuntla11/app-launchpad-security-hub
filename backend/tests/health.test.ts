import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import * as dbConfig from '../src/config/database';
import { app } from '../src/app';

describe('Health, Liveness, and Readiness Probe Endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /health (Composite Health Probe)', () => {
    it('should return 503 when MongoDB is disconnected or unconfigured', async () => {
      vi.spyOn(dbConfig, 'isDatabaseConnected').mockReturnValue(false);
      vi.spyOn(dbConfig, 'getDatabaseHealth').mockReturnValue({
        status: 'disconnected',
        readyState: 0,
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'unhealthy');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('server', 'healthy');
      expect(response.body.services).toHaveProperty('database', 'disconnected');

      // Verify zero credential or connection string leakage
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('mongodb');
      expect(responseText).not.toContain('password');
      expect(responseText).not.toContain('srv');
    });

    it('should return 200 when MongoDB is connected', async () => {
      vi.spyOn(dbConfig, 'isDatabaseConnected').mockReturnValue(true);
      vi.spyOn(dbConfig, 'getDatabaseHealth').mockReturnValue({
        status: 'connected',
        readyState: 1,
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body.services).toHaveProperty('server', 'healthy');
      expect(response.body.services).toHaveProperty('database', 'connected');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /health/live (Liveness Probe)', () => {
    it('should return 200 alive regardless of database state', async () => {
      vi.spyOn(dbConfig, 'isDatabaseConnected').mockReturnValue(false);

      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /health/ready (Readiness Probe)', () => {
    it('should return 200 ready when database connection is healthy', async () => {
      vi.spyOn(dbConfig, 'isDatabaseConnected').mockReturnValue(true);
      vi.spyOn(dbConfig, 'getDatabaseHealth').mockReturnValue({
        status: 'connected',
        readyState: 1,
      });

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body.services).toHaveProperty('database', 'connected');
    });

    it('should return 503 not_ready when database connection is unavailable', async () => {
      vi.spyOn(dbConfig, 'isDatabaseConnected').mockReturnValue(false);
      vi.spyOn(dbConfig, 'getDatabaseHealth').mockReturnValue({
        status: 'disconnected',
        readyState: 0,
      });

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'not_ready');
      expect(response.body.services).toHaveProperty('database', 'disconnected');
    });
  });

  it('should return 404 with safe JSON format for unknown routes', async () => {
    const response = await request(app).get('/api/unknown-endpoint');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
  });
});
