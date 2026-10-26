# ALSH REST API Reference

This document defines the formal REST API contract for App Launchpad and Security Hub (ALSH).

Base URL (Local Development): `http://localhost:5000`

---

## 1. System Health & Probes

### GET `/health`
Composite health check verifying HTTP server process and MongoDB Atlas connection status.
- **Headers:** None required
- **Response (200 OK — Connected):**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-12T19:00:00.000Z",
    "uptime": 124.5,
    "services": {
      "server": "healthy",
      "database": "connected"
    }
  }
  ```
- **Response (503 Service Unavailable — Disconnected):**
  ```json
  {
    "status": "unhealthy",
    "timestamp": "2026-10-12T19:00:00.000Z",
    "uptime": 124.5,
    "services": {
      "server": "healthy",
      "database": "disconnected"
    }
  }
  ```

### GET `/health/live`
Process liveness check. Always returns HTTP 200 while server is running.

### GET `/health/ready`
Traffic readiness probe. Returns HTTP 200 when MongoDB is connected, HTTP 503 otherwise.

---

## 2. Platform Owner Authentication (`/api/v1/platform`)

Used by administrators and project owners to manage their dashboard accounts.

### POST `/api/v1/platform/auth/register`
- **Body:** `{ "name": "string", "email": "string", "password": "string" }`
- **Response:** `201 Created` with user profile.

### POST `/api/v1/platform/auth/login`
- **Body:** `{ "email": "string", "password": "string" }`
- **Response:** `200 OK` with in-memory `accessToken` and sets secure HttpOnly `alsh_platform_refresh` cookie.

### POST `/api/v1/platform/auth/refresh`
- **Cookie:** `alsh_platform_refresh=<token>`
- **Response:** `200 OK` with rotated in-memory `accessToken` and rotated HttpOnly cookie.

### POST `/api/v1/platform/auth/logout`
- **Response:** `200 OK` and clears HttpOnly refresh cookie.

### GET `/api/v1/platform/me`
- **Headers:** `Authorization: Bearer <platformAccessToken>`
- **Response:** `200 OK` with platform user profile.

---

## 3. Project Management & Credentials (`/api/v1/projects`)

Requires platform owner Bearer token.

### POST `/api/v1/projects`
- **Body:**
  ```json
  {
    "name": "My App",
    "slug": "my-app",
    "description": "Optional description",
    "environment": "development",
    "allowedOrigins": ["http://localhost:3000"]
  }
  ```
- **Response:** `201 Created` with project details, public key, and **one-time revealed** private secret.

### GET `/api/v1/projects`
- **Response:** `200 OK` with list of owner's active projects.

### POST `/api/v1/projects/:projectId/credentials/rotate`
- **Response:** `200 OK` with newly generated public key and rotated one-time private secret. Immediately invalidates prior credentials.

### POST `/api/v1/projects/:projectId/credentials/revoke`
- **Body:** `{ "credentialId": "string" }`
- **Response:** `200 OK` with revoked credential record.

---

## 4. Roles & Permissions Management (`/api/v1/projects/:projectId/...`)

### GET `/api/v1/projects/:projectId/roles`
- **Response:** `200 OK` with project roles list. Automatically seeds system roles (`admin`, `member`, `viewer`) if empty.

### POST `/api/v1/projects/:projectId/roles`
- **Body:** `{ "name": "editor", "description": "...", "permissions": ["data:read", "data:write"] }`
- **Response:** `201 Created` with created role.

### DELETE `/api/v1/projects/:projectId/roles/:roleId`
- **Response:** `200 OK` with confirmation. Blocks deleting system roles with HTTP 400.

### POST `/api/v1/projects/:projectId/users/:appUserId/roles`
- **Body:** `{ "roleId": "<roleObjectId>" }`
- **Response:** `200 OK` with role assignment record. Validates that both user and role belong strictly to this project.

---

## 5. Application End-User Authentication (`/api/v1/auth/:projectPublicKey/...`)

Project-scoped authentication endpoints called by client applications.

### POST `/api/v1/auth/:projectPublicKey/register`
- **Body:** `{ "email": "user@example.com", "password": "...", "name": "Jane" }`
- **Response:** `201 Created` with `{ user, accessToken, refreshToken, expiresIn: "15m" }`.

### POST `/api/v1/auth/:projectPublicKey/login`
- **Body:** `{ "email": "user@example.com", "password": "..." }`
- **Response:** `200 OK` with `{ user, accessToken, refreshToken, expiresIn: "15m" }`.

### POST `/api/v1/auth/:projectPublicKey/refresh`
- **Body:** `{ "refreshToken": "<rawToken>" }`
- **Response:** `200 OK` with rotated `{ accessToken, refreshToken, expiresIn: "15m" }`.

### POST `/api/v1/auth/:projectPublicKey/authorize`
- **Headers:** `Authorization: Bearer <appAccessToken>`
- **Body:** `{ "permission": "reports:export" }`
- **Response (Permitted):** `200 OK` with `{ permitted: true, permission: "...", effectivePermissions: [...] }`.
- **Response (Denied):** `403 Forbidden` with `{ success: false, error: { code: "FORBIDDEN", message: "..." } }`.

---

## 6. Audit Logging (`/api/v1/projects/:projectId/audit-logs`)

### GET `/api/v1/projects/:projectId/audit-logs`
- **Headers:** `Authorization: Bearer <platformAccessToken>`
- **Query Params:**
  - `page`: Page number (default 1)
  - `limit`: Items per page (default 20, max 100)
  - `eventType`: Filter by event (e.g. `CREDENTIAL_ROTATED`, `AUTHORIZATION_DENIED`)
  - `outcome`: `success` or `failure`
  - `startDate`, `endDate`: ISO 8601 date filters
- **Response:** `200 OK` with paginated audit entries and metadata.
