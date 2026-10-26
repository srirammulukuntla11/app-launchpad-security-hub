import mongoose from 'mongoose';
import { env } from './env';

export interface DatabaseHealth {
  status: 'connected' | 'connecting' | 'disconnected' | 'unconfigured';
  readyState: number;
}

export const isDatabaseConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};

export const getDatabaseHealth = (): DatabaseHealth => {
  if (!env.MONGODB_URI) {
    return {
      status: 'unconfigured',
      readyState: mongoose.connection.readyState,
    };
  }

  switch (mongoose.connection.readyState) {
    case 1:
      return { status: 'connected', readyState: 1 };
    case 2:
      return { status: 'connecting', readyState: 2 };
    default:
      return { status: 'disconnected', readyState: mongoose.connection.readyState };
  }
};

export const connectDatabase = async (): Promise<boolean> => {
  if (!env.MONGODB_URI) {
    console.warn('[ALSH Database] MONGODB_URI is not set. Running in unconfigured database mode.');
    return false;
  }

  try {
    // Attempt Mongoose connection with 5-second server selection timeout
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[ALSH Database] Successfully connected to MongoDB Atlas.');
    return true;
  } catch (error) {
    console.error('[ALSH Database] Failed to connect to MongoDB Atlas. Error:', (error as Error).message);
    return false;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[ALSH Database] Disconnected from MongoDB.');
  }
};
