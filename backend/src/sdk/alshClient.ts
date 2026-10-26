/**
 * App Launchpad and Security Hub (ALSH) — Official TypeScript / JavaScript Client SDK
 * Lightweight, zero-dependency HTTP client for integrating registered projects.
 */

export interface AlshClientConfig {
  baseUrl: string;
  projectPublicKey: string;
  projectPrivateSecret?: string; // Only for secure server-to-server environments
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AppUserProfile {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, any>;
  status: string;
  roles?: string[];
  permissions?: string[];
}

export interface PermissionCheckResult {
  permitted: boolean;
  permission: string;
  effectivePermissions: string[];
}

export class AlshClientError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, code = 'CLIENT_ERROR', statusCode = 400) {
    super(message);
    this.name = 'AlshClientError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class AlshClient {
  private baseUrl: string;
  private projectPublicKey: string;
  private projectPrivateSecret?: string;

  constructor(config: AlshClientConfig) {
    if (!config.projectPublicKey) {
      throw new AlshClientError('projectPublicKey is required to initialize AlshClient', 'CONFIG_ERROR', 400);
    }
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.projectPublicKey = config.projectPublicKey.trim();
    this.projectPrivateSecret = config.projectPrivateSecret?.trim();
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.projectPrivateSecret) {
      headers['x-project-secret'] = this.projectPrivateSecret;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const rawData: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = rawData?.error?.message || response.statusText || 'Request failed';
      const errorCode = rawData?.error?.code || `HTTP_${response.status}`;
      throw new AlshClientError(errorMsg, errorCode, response.status);
    }

    return (rawData.data !== undefined ? rawData.data : rawData) as T;
  }

  /**
   * Register a new end-user under this project scope
   */
  async register(params: {
    email: string;
    password: string;
    name?: string;
    metadata?: Record<string, any>;
  }): Promise<{ user: AppUserProfile } & AuthTokens> {
    return this.request<{ user: AppUserProfile } & AuthTokens>(
      `/api/v1/auth/${this.projectPublicKey}/register`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  }

  /**
   * Authenticate an end-user in this project scope
   */
  async login(params: {
    email: string;
    password: string;
  }): Promise<{ user: AppUserProfile } & AuthTokens> {
    return this.request<{ user: AppUserProfile } & AuthTokens>(
      `/api/v1/auth/${this.projectPublicKey}/login`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  }

  /**
   * Refresh an active application user session with token rotation
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    return this.request<AuthTokens>(
      `/api/v1/auth/${this.projectPublicKey}/refresh`,
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }
    );
  }

  /**
   * Invalidate an active session upon logout
   */
  async logout(refreshToken: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      `/api/v1/auth/${this.projectPublicKey}/logout`,
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }
    );
  }

  /**
   * Retrieve the current authenticated end-user's profile
   */
  async getMe(accessToken: string): Promise<{ user: AppUserProfile; project: { id: string; name: string; slug: string } }> {
    return this.request<{ user: AppUserProfile; project: { id: string; name: string; slug: string } }>(
      `/api/v1/auth/${this.projectPublicKey}/me`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
  }

  /**
   * Check if the authenticated end-user holds a specific permission in this project
   */
  async checkPermission(accessToken: string, permission: string): Promise<PermissionCheckResult> {
    return this.request<PermissionCheckResult>(
      `/api/v1/auth/${this.projectPublicKey}/authorize`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ permission }),
      }
    );
  }
}
