import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { api, setAccessToken, getAccessToken } from '../services/api';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ProtectedRoute from '../components/common/ProtectedRoute';

// Helper component to verify authenticated protected view
const MockDashboard = () => {
  const { user, logout } = useAuth();
  return (
    <div>
      <h1>Protected Dashboard</h1>
      <p data-testid="user-email">{user?.email}</p>
      <button onClick={() => logout()}>Logout Button</button>
    </div>
  );
};

describe('Frontend Shell & Authentication Flows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken(null);
  });

  describe('Session Restoration & ProtectedRoute', () => {
    it('should redirect unauthenticated users to /login when session restore fails', async () => {
      // Mock session restore failure (e.g. 401 unauthenticated)
      vi.spyOn(api, 'post').mockRejectedValue({
        response: { status: 401, data: { success: false } },
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>Login Page Displayed</div>} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<MockDashboard />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify that after verification fails, user lands on /login
      await waitFor(() => {
        expect(screen.getByText('Login Page Displayed')).toBeInTheDocument();
      });
      expect(getAccessToken()).toBeNull();
    });

    it('should restore session and render protected dashboard when refresh succeeds', async () => {
      // Mock successful refresh and /me profile retrieval
      vi.spyOn(api, 'post').mockImplementation((url: string) => {
        if (url === '/platform/auth/refresh') {
          return Promise.resolve({
            data: { success: true, data: { accessToken: 'restored_token_123' } },
          }) as any;
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      vi.spyOn(api, 'get').mockImplementation((url: string) => {
        if (url === '/platform/me') {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                user: {
                  id: 'owner_123',
                  name: 'Restored Owner',
                  email: 'restored@example.com',
                  status: 'active',
                },
              },
            },
          }) as any;
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>Login Page Displayed</div>} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<MockDashboard />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Dashboard')).toBeInTheDocument();
      });
      expect(screen.getByTestId('user-email')).toHaveTextContent('restored@example.com');
      expect(getAccessToken()).toBe('restored_token_123');
    });
  });

  describe('Login Flow', () => {
    it('should submit login, store token in memory, and redirect', async () => {
      // Fail initial session restore
      vi.spyOn(api, 'post').mockImplementation((url: string, data: any) => {
        if (url === '/platform/auth/refresh') {
          return Promise.reject({ response: { status: 401 } });
        }
        if (url === '/platform/auth/login') {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                user: {
                  id: 'owner_456',
                  name: 'Logged-in Owner',
                  email: data.email,
                  status: 'active',
                },
                accessToken: 'newly_issued_jwt_access_token',
              },
            },
          }) as any;
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<MockDashboard />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Wait for session check to complete
      await waitFor(() => {
        expect(screen.getByPlaceholderText('owner@example.com')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('owner@example.com'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••••••'), {
        target: { value: 'Password123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Protected Dashboard')).toBeInTheDocument();
      });
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      // In-memory token verified
      expect(getAccessToken()).toBe('newly_issued_jwt_access_token');
    });

    it('should display error message on invalid credentials without crashing', async () => {
      vi.spyOn(api, 'post').mockImplementation((url: string) => {
        if (url === '/platform/auth/refresh') {
          return Promise.reject({ response: { status: 401 } });
        }
        if (url === '/platform/auth/login') {
          return Promise.reject({
            response: {
              status: 401,
              data: {
                success: false,
                error: { message: 'Invalid email or password.' },
              },
            },
          });
        }
        return Promise.reject(new Error('Unknown'));
      });

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('owner@example.com')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('owner@example.com'), {
        target: { value: 'bad@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••••••'), {
        target: { value: 'wrongpass' },
      });

      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
      });
    });
  });

  describe('Logout Flow', () => {
    it('should clear in-memory token and state upon logout', async () => {
      // Mock active session
      vi.spyOn(api, 'post').mockImplementation((url: string) => {
        if (url === '/platform/auth/refresh') {
          return Promise.resolve({
            data: { success: true, data: { accessToken: 'token_to_clear' } },
          }) as any;
        }
        if (url === '/platform/auth/logout') {
          return Promise.resolve({ data: { success: true } }) as any;
        }
        return Promise.reject(new Error('Unknown'));
      });

      vi.spyOn(api, 'get').mockResolvedValue({
        data: {
          success: true,
          data: {
            user: { id: 'u1', name: 'User 1', email: 'u1@example.com', status: 'active' },
          },
        },
      } as any);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>Login Page Displayed</div>} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<MockDashboard />} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Dashboard')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Logout Button'));

      await waitFor(() => {
        expect(getAccessToken()).toBeNull();
      });
    });
  });

  describe('Registration Flow', () => {
    it('should submit registration and auto-login user', async () => {
      vi.spyOn(api, 'post').mockImplementation((url: string, data: any) => {
        if (url === '/platform/auth/refresh') {
          return Promise.reject({ response: { status: 401 } });
        }
        if (url === '/platform/auth/register') {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                user: {
                  id: 'owner_reg_1',
                  name: data.name,
                  email: data.email,
                  status: 'active',
                },
              },
            },
          }) as any;
        }
        if (url === '/platform/auth/login') {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                user: {
                  id: 'owner_reg_1',
                  name: 'New Registered User',
                  email: data.email,
                  status: 'active',
                },
                accessToken: 'registered_token_jwt',
              },
            },
          }) as any;
        }
        return Promise.reject(new Error('Unknown'));
      });

      render(
        <MemoryRouter initialEntries={['/register']}>
          <AuthProvider>
            <Routes>
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/dashboard" element={<MockDashboard />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Alex Mercer')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Alex Mercer'), {
        target: { value: 'New Registered User' },
      });
      fireEvent.change(screen.getByPlaceholderText('alex@company.com'), {
        target: { value: 'newuser@company.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••••••'), {
        target: { value: 'ValidPassword123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /register account/i }));

      await waitFor(() => {
        expect(screen.getByText('Protected Dashboard')).toBeInTheDocument();
      });
      expect(screen.getByTestId('user-email')).toHaveTextContent('newuser@company.com');
      expect(getAccessToken()).toBe('registered_token_jwt');
    });
  });
});
