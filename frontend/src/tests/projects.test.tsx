import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { api, setAccessToken } from '../services/api';
import ProjectsPage from '../pages/ProjectsPage';
import ProjectDetailPage from '../pages/ProjectDetailPage';

describe('Frontend Project Management & Credentials UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('mock_authenticated_jwt_token');

    // Default mock session restore & user profile
    vi.spyOn(api, 'post').mockImplementation((url: string) => {
      if (url === '/platform/auth/refresh') {
        return Promise.resolve({
          data: { success: true, data: { accessToken: 'mock_jwt_token' } },
        }) as any;
      }
      return Promise.reject(new Error(`Unhandled POST ${url}`));
    });

    vi.spyOn(api, 'get').mockImplementation((url: string) => {
      if (url === '/platform/me') {
        return Promise.resolve({
          data: {
            success: true,
            data: { user: { id: 'o1', name: 'Owner', email: 'owner@example.com', status: 'active' } },
          },
        }) as any;
      }
      return Promise.reject(new Error(`Unhandled GET ${url}`));
    });
  });

  describe('ProjectsPage', () => {
    it('should render projects list when projects exist', async () => {
      vi.spyOn(api, 'get').mockImplementation((url: string) => {
        if (url === '/platform/me') {
          return Promise.resolve({
            data: { success: true, data: { user: { id: 'o1', name: 'Owner', email: 'owner@example.com' } } },
          }) as any;
        }
        if (url === '/projects') {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                projects: [
                  {
                    id: 'proj_1',
                    name: 'E-Commerce Backend',
                    slug: 'e-commerce-backend',
                    description: 'Main production API',
                    environment: 'production',
                    allowedOrigins: ['https://shop.example.com'],
                    status: 'active',
                    createdAt: new Date().toISOString(),
                  },
                ],
              },
            },
          }) as any;
        }
        return Promise.reject(new Error(`Unhandled GET ${url}`));
      });

      render(
        <MemoryRouter initialEntries={['/projects']}>
          <AuthProvider>
            <Routes>
              <Route path="/projects" element={<ProjectsPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('E-Commerce Backend')).toBeInTheDocument();
      });
      expect(screen.getByText('slug: e-commerce-backend')).toBeInTheDocument();
      expect(screen.getByText('production')).toBeInTheDocument();
    });

    it('should render empty state when no projects are returned', async () => {
      vi.spyOn(api, 'get').mockImplementation((url: string) => {
        if (url === '/platform/me') {
          return Promise.resolve({
            data: { success: true, data: { user: { id: 'o1', name: 'Owner' } } },
          }) as any;
        }
        if (url === '/projects') {
          return Promise.resolve({
            data: { success: true, data: { projects: [] } },
          }) as any;
        }
        return Promise.reject(new Error(`Unhandled GET ${url}`));
      });

      render(
        <MemoryRouter initialEntries={['/projects']}>
          <AuthProvider>
            <Routes>
              <Route path="/projects" element={<ProjectsPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No Projects Registered')).toBeInTheDocument();
      });
      expect(screen.getByText('Create Your First Project')).toBeInTheDocument();
    });

    it('should open create modal, create project, and show one-time secret modal', async () => {
      vi.spyOn(api, 'get').mockImplementation((url: string) => {
        if (url === '/platform/me') {
          return Promise.resolve({
            data: { success: true, data: { user: { id: 'o1', name: 'Owner' } } },
          }) as any;
        }
        if (url === '/projects') {
          return Promise.resolve({
            data: { success: true, data: { projects: [] } },
          }) as any;
        }
        return Promise.reject(new Error(`Unhandled GET ${url}`));
      });

      vi.spyOn(api, 'post').mockImplementation((url: string, data: any) => {
        if (url === '/platform/auth/refresh') {
          return Promise.resolve({ data: { success: true, data: { accessToken: 'token' } } }) as any;
        }
        if (url === '/projects') {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                project: {
                  id: 'p_new',
                  name: data.name,
                  slug: data.slug,
                  environment: data.environment,
                  status: 'active',
                },
                credential: {
                  id: 'cred_new',
                  publicKey: 'alsh_pub_test_12345',
                  name: 'Initial Primary Key',
                  status: 'active',
                },
                oneTimeSecret: 'alsh_sec_super_secret_one_time_value',
              },
            },
          }) as any;
        }
        return Promise.reject(new Error(`Unhandled POST ${url}`));
      });

      render(
        <MemoryRouter initialEntries={['/projects']}>
          <AuthProvider>
            <Routes>
              <Route path="/projects" element={<ProjectsPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('New Project')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Project'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Billing Portal')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Billing Portal'), {
        target: { value: 'Customer Portal' },
      });

      fireEvent.click(screen.getByRole('button', { name: /register project/i }));

      // Verify One-Time Secret modal is revealed
      await waitFor(() => {
        expect(screen.getByText('One-Time Secret Reveal')).toBeInTheDocument();
      });
      expect(screen.getByText('alsh_pub_test_12345')).toBeInTheDocument();
      expect(screen.getByText(/important security warning:/i)).toBeInTheDocument();
      expect(screen.getByText('NEVER')).toBeInTheDocument();
    });
  });

  describe('ProjectDetailPage', () => {
    it('should render project details and allow credential rotation with one-time reveal', async () => {
      vi.spyOn(api, 'get').mockImplementation((url: string) => {
        if (url === '/platform/me') {
          return Promise.resolve({
            data: { success: true, data: { user: { id: 'o1', name: 'Owner' } } },
          }) as any;
        }
        if (url === '/projects/proj_abc') {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                project: {
                  id: 'proj_abc',
                  name: 'Mobile Gateway',
                  slug: 'mobile-gateway',
                  environment: 'staging',
                  description: 'API for mobile clients',
                  allowedOrigins: [],
                  status: 'active',
                },
                credentials: [
                  {
                    id: 'cred_1',
                    publicKey: 'alsh_pub_mobile_111',
                    name: 'Primary Key',
                    status: 'active',
                    createdAt: new Date().toISOString(),
                  },
                ],
              },
            },
          }) as any;
        }
        return Promise.reject(new Error(`Unhandled GET ${url}`));
      });

      vi.spyOn(api, 'post').mockImplementation((url: string) => {
        if (url === '/platform/auth/refresh') {
          return Promise.resolve({ data: { success: true, data: { accessToken: 'token' } } }) as any;
        }
        if (url === '/projects/proj_abc/credentials/rotate') {
          return Promise.resolve({
            data: {
              success: true,
              data: {
                credential: {
                  id: 'cred_rotated',
                  publicKey: 'alsh_pub_mobile_222',
                  name: 'Rotated Primary Secret',
                  status: 'active',
                },
                oneTimeSecret: 'alsh_sec_rotated_secret_reveal',
              },
            },
          }) as any;
        }
        return Promise.reject(new Error(`Unhandled POST ${url}`));
      });

      render(
        <MemoryRouter initialEntries={['/projects/proj_abc']}>
          <AuthProvider>
            <Routes>
              <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Mobile Gateway')).toBeInTheDocument();
      });
      expect(screen.getByText('alsh_pub_mobile_111')).toBeInTheDocument();

      // Trigger rotation
      fireEvent.click(screen.getByText('Rotate Credentials'));

      await waitFor(() => {
        expect(screen.getByText('Credentials Successfully Rotated')).toBeInTheDocument();
      });
      expect(screen.getByText('alsh_pub_mobile_222')).toBeInTheDocument();
      expect(screen.getByText('alsh_sec_rotated_secret_reveal')).toBeInTheDocument();
    });
  });
});
