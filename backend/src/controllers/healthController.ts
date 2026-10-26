import { Request, Response } from 'express';
import * as dbConfig from '../config/database';

/**
 * Composite health check endpoint (HTTP 200 when DB & server healthy, HTTP 503 when DB unavailable)
 */
export const getHealth = (_req: Request, res: Response): void => {
  const dbHealth = dbConfig.getDatabaseHealth();
  const dbHealthy = dbConfig.isDatabaseConnected();

  const responseBody = {
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      server: 'healthy',
      database: dbHealth.status,
    },
  };

  if (dbHealthy) {
    res.status(200).json(responseBody);
  } else {
    res.status(503).json(responseBody);
  }
};

/**
 * Liveness probe: verifies that the HTTP server process is running and responding
 */
export const getLiveness = (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

/**
 * Readiness probe: verifies that required backing services (MongoDB) are connected and ready
 */
export const getReadiness = (_req: Request, res: Response): void => {
  const dbHealth = dbConfig.getDatabaseHealth();
  const dbHealthy = dbConfig.isDatabaseConnected();

  if (dbHealthy) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      services: {
        server: 'ready',
        database: 'connected',
      },
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      services: {
        server: 'ready',
        database: dbHealth.status,
      },
    });
  }
};
