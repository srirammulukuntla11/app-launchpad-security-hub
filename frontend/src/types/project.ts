export interface ProjectCredential {
  id: string;
  publicKey: string;
  name: string;
  status: 'active' | 'revoked';
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  environment: 'development' | 'staging' | 'production';
  allowedOrigins: string[];
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  credentials?: ProjectCredential[];
}

export interface CreateProjectResponse {
  success: boolean;
  data: {
    project: Project;
    credential: ProjectCredential;
    oneTimeSecret: string;
  };
}

export interface RotateCredentialResponse {
  success: boolean;
  data: {
    credential: ProjectCredential;
    oneTimeSecret: string;
  };
}

export interface ProjectListResponse {
  success: boolean;
  data: {
    projects: Project[];
  };
}

export interface ProjectDetailResponse {
  success: boolean;
  data: {
    project: Project;
    credentials: ProjectCredential[];
  };
}
