import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { RefreshResponse } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// In-memory access token storage (NEVER written to localStorage or sessionStorage)
let inMemoryAccessToken: string | null = null;
let authFailureCallback: (() => void) | null = null;

export const setAccessToken = (token: string | null): void => {
  inMemoryAccessToken = token;
};

export const getAccessToken = (): string | null => {
  return inMemoryAccessToken;
};

export const setOnAuthFailure = (callback: () => void): void => {
  authFailureCallback = callback;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Ensures HttpOnly refresh cookies are sent
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach in-memory access token as Bearer token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (inMemoryAccessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Concurrency lock for token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Handle 401 and refresh token without infinite loops
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If no config or error is not 401, reject immediately
    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Do NOT retry for auth endpoints (/login, /refresh, /register) to prevent infinite loops
    if (
      originalRequest.url?.includes('/platform/auth/login') ||
      originalRequest.url?.includes('/platform/auth/refresh') ||
      originalRequest.url?.includes('/platform/auth/register') ||
      originalRequest._retry
    ) {
      if (originalRequest.url?.includes('/platform/auth/refresh')) {
        setAccessToken(null);
        authFailureCallback?.();
      }
      return Promise.reject(error);
    }

    // If refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Attempt to refresh the access token via HttpOnly cookie
      const response = await api.post<RefreshResponse>('/platform/auth/refresh');
      const newAccessToken = response.data.data.accessToken;

      setAccessToken(newAccessToken);
      processQueue(null, newAccessToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      setAccessToken(null);
      authFailureCallback?.();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
