export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'suspended';
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: PlatformUser;
    accessToken: string;
  };
}

export interface RefreshResponse {
  success: boolean;
  data: {
    accessToken: string;
  };
}

export interface UserResponse {
  success: boolean;
  data: {
    user: PlatformUser;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}
