import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setAccessToken, setOnAuthFailure } from '../services/api';
import { PlatformUser, AuthResponse, RefreshResponse, UserResponse } from '../types/auth';

interface AuthContextType {
  user: PlatformUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const handleAuthFailure = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    setAccessToken(null);
  }, []);

  // Register auth failure callback with Axios interceptor
  useEffect(() => {
    setOnAuthFailure(handleAuthFailure);
  }, [handleAuthFailure]);

  // Session restoration on initial application load via HttpOnly refresh cookie
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        // Attempt to rotate refresh token via HttpOnly cookie
        const refreshRes = await api.post<RefreshResponse>('/platform/auth/refresh');
        const token = refreshRes.data.data.accessToken;
        setAccessToken(token);

        // Fetch authenticated user profile
        const meRes = await api.get<UserResponse>('/platform/me');
        if (isMounted) {
          setUser(meRes.data.data.user);
          setIsAuthenticated(true);
        }
      } catch (err) {
        // Refresh token is missing or expired - clean unauthenticated state
        if (isMounted) {
          handleAuthFailure();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [handleAuthFailure]);

  const login = async (email: string, password: string): Promise<void> => {
    setError(null);
    try {
      const response = await api.post<AuthResponse>('/platform/auth/login', {
        email,
        password,
      });

      const { user: userData, accessToken } = response.data.data;
      setAccessToken(accessToken);
      setUser(userData);
      setIsAuthenticated(true);
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Login failed. Please check your credentials.';
      setError(message);
      throw new Error(message);
    }
  };

  const register = async (name: string, email: string, password: string): Promise<void> => {
    setError(null);
    try {
      await api.post('/platform/auth/register', {
        name,
        email,
        password,
      });

      // Automatically sign in upon successful registration
      await login(email, password);
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Registration failed. Please check your details.';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post('/platform/auth/logout');
    } catch (err) {
      // Clean state even if logout request fails
    } finally {
      handleAuthFailure();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        clearError,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
