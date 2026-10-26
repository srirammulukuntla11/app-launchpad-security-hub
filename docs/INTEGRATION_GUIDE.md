# ALSH Developer Integration Guide

App Launchpad and Security Hub (ALSH) provides centralized Authentication-as-a-Service (AuthaaS) and Authorization-as-a-Service (RBAC) across multiple applications.

This guide walks you through integrating a registered project with ALSH APIs in your web frontend or backend microservices.

---

## 1. Core Architecture & Credential Model

ALSH strictly distinguishes **public client identifiers** from **private server secrets**:

| Credential Type | Prefix | Intended Environment | Usage |
|---|---|---|---|
| **Public Project Key** | `alsh_pub_...` | Web Browser / Mobile / Frontend | Safe to expose in client-side code; used for user registration, login, refresh, logout, and profile lookups. |
| **Private Project Secret** | `alsh_sec_...` | Secure Backend Servers Only | **Never** expose in frontend code. Used for server-to-server operations, user provisioning, and webhook validation. |

> [!WARNING]
> Never commit private project secrets (`alsh_sec_...`) or environment files to version control. ALSH only reveals the plaintext secret once upon creation or rotation.

---

## 2. Quickstart with Official TypeScript SDK

### Installation
You can import the lightweight SDK directly from `@alsh/client` or copy `alshClient.ts` into your application:

```typescript
import { AlshClient } from './alshClient';

// Initialize with your project's public key
const alsh = new AlshClient({
  baseUrl: 'http://localhost:5000', // or your production ALSH server URL
  projectPublicKey: 'alsh_pub_example_key_12345',
});
```

### End-User Registration
```typescript
const result = await alsh.register({
  email: 'developer@example.com',
  password: 'SecurePassword123!',
  name: 'Jane Doe',
  metadata: { plan: 'pro' },
});

console.log('Registered User:', result.user.id);
console.log('Access Token:', result.accessToken);
```

### End-User Login
```typescript
const session = await alsh.login({
  email: 'developer@example.com',
  password: 'SecurePassword123!',
});

// Store accessToken in memory; store refreshToken securely (or use secure cookies)
const { accessToken, refreshToken } = session;
```

### Refresh Token Rotation
```typescript
// Call when access token expires (15m lifetime)
const refreshed = await alsh.refreshToken(refreshToken);
console.log('New Access Token:', refreshed.accessToken);
```

### Authorization Check (RBAC)
```typescript
// Verify if the authenticated user has a specific permission
const authResult = await alsh.checkPermission(accessToken, 'reports:export');

if (authResult.permitted) {
  console.log('User is permitted to export reports!');
} else {
  console.warn('Access denied: missing reports:export');
}
```

---

## 3. Direct REST API Integration (Using Standard Fetch)

If you prefer using vanilla `fetch` or Axios without an SDK:

### 1. Register User
`POST /api/v1/auth/:projectPublicKey/register`
```bash
curl -X POST http://localhost:5000/api/v1/auth/alsh_pub_example_key_12345/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "name": "Alex Smith"
  }'
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "670aa5a5e3f4c8b123456789",
      "email": "user@example.com",
      "status": "active"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "4a1b8c...",
    "expiresIn": "15m"
  }
}
```

### 2. Login User
`POST /api/v1/auth/:projectPublicKey/login`
```bash
curl -X POST http://localhost:5000/api/v1/auth/alsh_pub_example_key_12345/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

### 3. Get Authenticated User Profile
`GET /api/v1/auth/:projectPublicKey/me`
```bash
curl http://localhost:5000/api/v1/auth/alsh_pub_example_key_12345/me \
  -H "Authorization: Bearer <accessToken>"
```

### 4. Check Permission (Server-Side Authorization)
`POST /api/v1/auth/:projectPublicKey/authorize`
```bash
curl -X POST http://localhost:5000/api/v1/auth/alsh_pub_example_key_12345/authorize \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "permission": "data:write"
  }'
```

---

## 4. Role-Based Access Control (RBAC) Lifecycle

ALSH provides project-scoped RBAC with deny-by-default security:

1. **Starter Roles:** Every project is automatically provisioned with:
   - `admin`: Full administrative access (`*` or all project permissions).
   - `member`: Read/write access to project data.
   - `viewer`: Read-only access to project data.
2. **Assigning Roles:** Platform owners assign roles via:
   `POST /api/v1/projects/:projectId/users/:appUserId/roles` with `{ "roleId": "<roleId>" }`.
3. **Cross-Project Isolation:** A role or permission created in Project A **cannot** grant access to Project B.

---

## 5. Error Code Reference

ALSH returns standardized JSON error payloads:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation of error."
  }
}
```

| Error Code | HTTP Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid Bearer access token. |
| `INVALID_CREDENTIALS` | 401 | Incorrect email or password (generic to prevent user enumeration). |
| `TOKEN_EXPIRED` | 401 | Access token expired. Call refresh endpoint. |
| `TOKEN_REUSE_DETECTED` | 401 | Refresh token reuse detected. Entire token family revoked for security. |
| `CROSS_PROJECT_TOKEN_DENIED` | 403 | Token belongs to Project A but was sent to Project B. |
| `FORBIDDEN` | 403 | Missing required RBAC permission or unauthorized project access. |
| `CONFLICT` | 409 | Duplicate resource (e.g. email already exists in this project). |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many authentication attempts. Please retry after the cooldown period. |

---

## 6. Health & Readiness Probes

Use these endpoints for load balancers and deployment health verification:

- `GET /health` — Overall health (HTTP 200 when database connected; HTTP 503 when disconnected).
- `GET /health/live` — Liveness probe (HTTP 200 whenever server process is alive).
- `GET /health/ready` — Readiness probe (HTTP 200 when database is ready for traffic; HTTP 503 otherwise).
