import { app } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';

const startServer = async () => {
  // Connect to MongoDB Atlas (if configured)
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    console.log(`[ALSH Server] Running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode.`);
  });

  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[ALSH Server] Fatal startup error: Port ${env.PORT} is already in use by another process.`);
    } else {
      console.error('[ALSH Server] Server error:', error);
    }
    process.exit(1);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[ALSH Server] Received ${signal}. Initiating graceful shutdown...`);
    server.close(async () => {
      console.log('[ALSH Server] HTTP server closed.');
      await disconnectDatabase();
      console.log('[ALSH Server] Graceful shutdown complete.');
      process.exit(0);
    });

    // Force exit if shutdown hangs beyond 10 seconds
    setTimeout(() => {
      console.error('[ALSH Server] Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

// Start the server if directly executed
if (require.main === module) {
  startServer().catch((error) => {
    console.error('[ALSH Server] Fatal startup error:', error);
    process.exit(1);
  });
}

export { startServer };
