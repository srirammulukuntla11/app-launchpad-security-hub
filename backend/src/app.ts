import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { getHealth, getLiveness, getReadiness } from './controllers/healthController';
import platformAuthRoutes from './routes/platformAuthRoutes';
import projectRoutes from './routes/projectRoutes';
import appAuthRoutes from './routes/appAuthRoutes';
import { errorHandler } from './middleware/errorHandler';

export const createApp = () => {
  const app = express();

  // Security Headers
  app.use(helmet());

  // Allowed Origins from environment configuration (reusing env.CLIENT_ORIGIN)
  // Supports single or comma-separated origins while strictly excluding wildcard '*'
  const allowedOrigins = env.CLIENT_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== '*');

  // CORS Configuration
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        // Allow requests with no origin (e.g. server-to-server, curl, health probes)
        if (!requestOrigin) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(requestOrigin)) {
          return callback(null, true);
        }

        // Unapproved origins are not granted CORS access
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-project-id', 'x-project-secret'],
    })
  );

  // Cookie Parser
  app.use(cookieParser(env.COOKIE_SECRET));

  // Request body parsing with strict size limit
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Health, Liveness, and Readiness Probes (Stage 8)
  app.get('/health', getHealth);
  app.get('/health/live', getLiveness);
  app.get('/health/ready', getReadiness);

  // Platform Owner Authentication & Profile Routes
  app.use('/api/v1/platform', platformAuthRoutes);

  // Project Management & Credentials Routes
  app.use('/api/v1/projects', projectRoutes);

  // Application End-User Authentication API (Stage 5)
  app.use('/api/v1/auth', appAuthRoutes);

  // Catch-all 404 for undefined routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
  });

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
};

export const app = createApp();
