# Software Requirements Specification (SRS)
## App Launchpad and Security Hub (ALSH)

**Document status:** Baseline specification  
**Version:** 1.0  
**Project type:** Full-stack web application / Authentication-as-a-Service (AuthaaS) and Authorization-as-a-Service  
**Implementation constraint:** MERN stack with MongoDB Atlas; no Docker  
**Primary audience:** Developers, project owner, testers, and AI coding agent

---

## 1. Purpose

App Launchpad and Security Hub (ALSH) is a central identity and access-management platform that allows developers to register multiple applications and use a shared security service for authentication, sessions, roles, permissions, and security auditing.

Instead of every application implementing its own login and authorization system, an application owner can register a project in ALSH, configure its security settings, and integrate it with ALSH APIs.

This document defines the functional and non-functional requirements for a working prototype. It is the primary product requirements source for implementation.

## 2. Product vision and goals

### 2.1 Vision
Provide a clear, secure, developer-friendly hub for managing authentication and authorization across multiple applications.

### 2.2 Goals
- Allow an administrator/developer to create an ALSH account and sign in securely.
- Allow an authenticated owner to register and manage multiple projects.
- Generate project-specific credentials and show them safely.
- Provide registration, login, token refresh, logout, and user/session APIs for registered projects.
- Support role-based access control (RBAC).
- Keep project data and credentials isolated between projects.
- Record important security and administrative events in audit logs.
- Provide a dashboard and integration guidance that make a first project straightforward to configure.
- Deliver a genuinely functional application backed by MongoDB Atlas, not a UI-only prototype.

### 2.3 Out of scope for the initial MVP
Unless explicitly approved later, do not implement these as required MVP features:
- Social login providers.
- Passwordless login.
- Mandatory multi-factor authentication (MFA).
- Enterprise SAML/OIDC single sign-on.
- A full attribute-based access-control (ABAC) policy engine.
- Kubernetes, Docker, or container-based deployment.
- A public marketplace of third-party integrations.
- Claims of formal compliance or security certification.

These may be future roadmap items after the core MVP is tested.

## 3. Users and roles

### 3.1 Platform owner / dashboard user
A person who signs up to ALSH and manages their projects, project credentials, roles, permissions, and audit events.

### 3.2 Application end user
A user account created for a registered application through ALSH's authentication APIs. An end user's identity and role assignments must be scoped to the correct project.

### 3.3 Platform administrator
An optional privileged operational role. Do not create an unauthenticated or hard-coded production admin backdoor. If a platform-admin capability is implemented in the MVP, it must be protected, auditable, and configured through a documented secure bootstrap process.

## 4. Scope and boundaries

The initial product contains:
1. React dashboard.
2. Node.js and Express REST API.
3. MongoDB Atlas persistence using Mongoose.
4. Platform-owner authentication.
5. Project registration and project-specific API credentials.
6. Application-end-user authentication endpoints.
7. Access-token and refresh-token lifecycle.
8. RBAC management and authorization checks.
9. Project/tenant isolation.
10. Audit logs.
11. Developer integration guide and API testing instructions.

The dashboard and public application APIs must be distinguished clearly. A dashboard session must not automatically grant access to an application's end-user data outside the owner's authorized projects.

## 5. Technology constraints

- **Frontend:** React with Vite.
- **Styling:** Tailwind CSS.
- **Backend:** Node.js with Express.
- **Language:** TypeScript is preferred for frontend and backend if it does not complicate the setup; otherwise use modern JavaScript consistently. Do not mix styles unnecessarily.
- **Database:** MongoDB Atlas.
- **ODM:** Mongoose.
- **Authentication:** Short-lived signed access tokens and securely managed refresh tokens.
- **Password hashing:** Argon2id preferred; bcrypt is an acceptable documented fallback if environment support prevents Argon2id.
- **Validation:** A schema validation library such as Zod for request bodies and environment configuration.
- **Testing:** Automated unit and integration tests; use the test runner most compatible with the selected setup.
- **API inspection:** Postman or equivalent.
- **Version control:** Git.
- **Deployment direction:** Vercel for the frontend and Render or another compatible Node host for the backend, with MongoDB Atlas as the cloud database.
- **Docker:** Must not be used. Do not add Dockerfiles, docker-compose files, or Docker-based setup instructions.

Do not introduce PostgreSQL, Redis, NestJS, or a second database as replacements for the agreed MERN stack. If a future feature appears to need an additional service, document the trade-off and request approval before adding it.

## 6. Functional requirements

### FR-01: Platform-owner registration
- A visitor can register with a name, email, and password.
- Validate input on both client and server.
- Normalize email addresses and enforce uniqueness.
- Hash passwords before storage; plaintext passwords must never be stored or logged.
- Return safe, user-friendly error messages.
- Create a secure authenticated session after registration only if that behavior is explicitly chosen and consistently implemented.

### FR-02: Platform-owner login and logout
- Registered dashboard users can log in with email and password.
- Invalid credentials must not reveal whether an email exists.
- Provide logout and invalidate/revoke the relevant refresh session.
- Apply reasonable rate limits to authentication endpoints.
- Do not store long-lived sensitive tokens in browser localStorage. Prefer secure, HttpOnly cookies for refresh tokens when the deployment topology supports them. If a different token-storage approach is proposed, explain the risk and request approval before implementation.

### FR-03: Dashboard
- Show a clear overview of the signed-in owner's projects and useful security activity.
- Provide navigation to projects, project details, roles/permissions, audit logs, account settings, and developer documentation.
- Include loading, empty, success, and error states.
- Provide responsive layouts and accessible labels.
- All dashboard data must come from backend APIs, not hard-coded mock data in the final functional flows.

### FR-04: Project registration and management
- A signed-in owner can create, list, view, update, and delete/archive their own projects.
- Project fields should include at minimum name, unique project identifier/slug, description (optional), environment (development/production), allowed origins/domains (where relevant), and creation/update timestamps.
- The server generates identifiers; clients cannot choose another owner's project ID.
- Every project operation must verify ownership on the server.
- Destructive actions require confirmation.
- Do not expose a secret again after its initial reveal unless it is designed to be safely rotated and re-revealed.

### FR-05: Project credentials
- Create a project-specific public identifier and secret credential suitable for server-to-server operations.
- Store only a secure hash of the secret where practical; show the plaintext secret only once at creation or rotation.
- Provide credential rotation and revocation.
- Never place private project secrets in frontend source code, public environment variables, URLs, client-side logs, or committed files.
- Distinguish public/client identifiers from private/server secrets in the UI and documentation.
- Do not treat a public client identifier as proof of trusted server identity.

### FR-06: Application end-user registration
- A registered project can create an end-user account through the documented API.
- End-user records must be scoped to a project.
- Enforce email uniqueness within the intended project scope, not globally unless the product decision is explicitly changed.
- Validate and normalize inputs; hash passwords; return only safe user fields.
- Do not allow a caller to select privileged roles during ordinary self-registration.

### FR-07: Application end-user login
- A project-scoped user can authenticate using the documented API.
- Verify the user's credentials and project scope.
- Return the documented access/refresh session response or set secure cookies according to the chosen API design.
- Keep error messages generic for failed credentials.
- Apply rate limiting and appropriate account-abuse protections.

### FR-08: Token and session lifecycle
- Access tokens must be short-lived; target 5–15 minutes.
- Refresh tokens must be revocable and rotated on use.
- Detect refresh-token reuse where feasible and revoke the affected token family/session.
- Validate signature, expiry, issuer, audience, and relevant project/user claims.
- Logout must revoke the relevant refresh session. Document that already-issued stateless access tokens may remain usable until expiry unless a server-side revocation strategy is implemented.
- Never log raw access tokens, refresh tokens, passwords, or secrets.

### FR-09: Roles and permissions (RBAC)
- An owner can define roles and permissions for a project.
- Provide a sensible starter set of permissions and allow project-specific roles.
- Assign roles to users only within the correct project.
- Provide a backend authorization-check mechanism.
- Enforce authorization in backend middleware/services; hiding a button in React is not sufficient.
- Prevent users from granting themselves platform-level or project-owner privileges.
- Ensure default behavior is deny unless permission is explicitly granted.

### FR-10: Tenant/project isolation
- Every project-scoped query and mutation must be scoped to a verified project ID.
- A credential or user from Project A must not access Project B's users, roles, sessions, logs, or configuration.
- Do not trust a project ID supplied by the browser without validating the associated credentials and authorization.
- Add automated cross-project isolation tests.
- Avoid relying on frontend filtering as an isolation control.

### FR-11: Audit logs
- Record important events, including owner login/logout, project creation/update/deletion, credential creation/rotation/revocation, user registration/login failures where appropriate, role/permission changes, and session revocation.
- Store event type, timestamp, actor or subject where available, project scope, outcome, and safe metadata.
- Never record passwords, raw tokens, private secrets, or unnecessary personal data.
- Audit entries should be append-only through normal application APIs; the dashboard must not offer ordinary editing of past events.
- Provide paginated and filterable audit-log viewing.

### FR-12: Developer integration
- Provide API documentation with endpoint, authentication requirements, request/response examples, status codes, and common error formats.
- Provide a copyable example for integrating a registered project.
- Include a connection/test flow where practical.
- Document CORS/allowed-origin settings and environment setup.
- Clearly explain which calls must be made from a trusted backend and which, if any, may be made from a browser.

### FR-13: Account and project settings
- Allow the dashboard user to view/update basic profile settings.
- Provide project configuration, credential rotation/revocation, and allowed-origin management.
- Validate allowed origins and do not use wildcard CORS with credentialed requests.

### FR-14: Error handling
- Use a consistent API error response structure.
- Handle validation errors, authentication failures, authorization failures, not-found responses, conflicts, rate limits, and unexpected server errors.
- Never send stack traces, database connection strings, environment variables, or secret details to clients.
- Log operational details safely on the server.

## 7. Non-functional requirements

### NFR-01: Security
- Use HTTPS in production.
- Use secure password hashing, request validation, authentication middleware, authorization checks, and rate limiting.
- Protect against injection, broken access control, brute-force attempts, token replay, and common OWASP risks.
- Configure security headers and strict CORS.
- Keep secrets in environment variables or a managed secret store; never commit real secrets.
- Use least privilege for database and service credentials.
- Apply safe cookie attributes when cookies are used: HttpOnly, Secure in production, and an appropriate SameSite policy.
- Avoid exposing detailed authentication failure reasons.

### NFR-02: Data integrity
- Use appropriate Mongoose schemas, indexes, validation, and unique constraints.
- Use transactions only where supported and necessary; do not assume all Atlas configurations support identical transaction behavior.
- Make credential rotation, refresh-token rotation, and role changes safe against partial updates.
- Handle duplicate-key and database-availability errors gracefully.

### NFR-03: Maintainability
- Separate routes, controllers, services, models, middleware, validation, and shared types/utilities.
- Avoid giant components and giant route files.
- Use consistent naming and error-handling conventions.
- Document meaningful architectural decisions.

### NFR-04: Usability and accessibility
- Use clear labels, useful validation messages, keyboard-accessible controls, visible focus states, and responsive layouts.
- Provide empty/loading/error states for all data-driven screens.
- Confirm destructive operations.

### NFR-05: Performance
- Use pagination for potentially large lists such as projects, users, and audit logs.
- Add indexes for frequently queried fields and project-scoped lookups.
- Aim for API response times below 150 ms at p95 in a controlled local test for simple operations, recognizing this is a target and not a guaranteed production SLA.

### NFR-06: Reliability
- Provide health/readiness endpoints that do not reveal secrets.
- Handle temporary database outages without crashing in an uncontrolled way.
- Fail safely when authentication or authorization dependencies are unavailable.
- Do not bypass security checks to keep a request working.

### NFR-07: Testability
- Add unit tests for validation, password hashing, token handling, permission resolution, and project ownership checks.
- Add integration tests for main authentication and project flows.
- Add cross-project isolation and negative authorization tests.
- Aim for at least 80% test coverage of critical authentication and authorization modules where practical; report actual coverage rather than claiming a target was achieved without evidence.

## 8. High-level data model

Use Mongoose models/collections. Names may be adjusted during planning if the same requirements are preserved.

- **PlatformUser:** dashboard-owner identity, normalized email, password hash, status, timestamps.
- **Project:** owner reference, name, slug/identifier, description, environment, allowed origins, status, timestamps.
- **ProjectCredential:** project reference, public key/identifier, hashed secret, status, created/rotated/revoked timestamps. Do not store a plaintext secret.
- **AppUser:** project reference, normalized email or chosen login identifier, password hash, profile fields, status, timestamps. Add a unique compound index for the project and normalized email where appropriate.
- **Role:** project reference, name, description, system/custom flag, timestamps.
- **Permission:** project reference or carefully defined reusable permission catalog, key, description.
- **RolePermission:** role reference and permission reference, or a safely validated embedded representation.
- **AppUserRole:** project reference, app-user reference, role reference.
- **Session / RefreshToken:** project and user references as applicable, hashed refresh-token identifier/value, token family, expiry, revocation and rotation metadata.
- **AuditLog:** actor/subject, project reference, event type, outcome, timestamp, safe metadata.

Use ObjectId references consistently. Document indexes, deletion/archive behavior, and retention decisions in the implementation plan. Do not implement cascading deletion without considering audit history and data retention.

## 9. API surface (initial proposal)

The final route naming and response shape should be confirmed during planning, but the following capabilities are required.

### Dashboard owner
- `POST /api/v1/platform/auth/register`
- `POST /api/v1/platform/auth/login`
- `POST /api/v1/platform/auth/logout`
- `GET /api/v1/platform/me`

### Projects and credentials
- `POST /api/v1/projects`
- `GET /api/v1/projects`
- `GET /api/v1/projects/:projectId`
- `PATCH /api/v1/projects/:projectId`
- `DELETE /api/v1/projects/:projectId` or an archive action
- `POST /api/v1/projects/:projectId/credentials/rotate`
- `POST /api/v1/projects/:projectId/credentials/revoke`

### Roles and permissions
- `GET /api/v1/projects/:projectId/roles`
- `POST /api/v1/projects/:projectId/roles`
- `PATCH /api/v1/projects/:projectId/roles/:roleId`
- `DELETE /api/v1/projects/:projectId/roles/:roleId`
- Endpoints for permission listing, role assignment, and authorization checks.

### Project-scoped end users
- `POST /api/v1/auth/:projectPublicId/register`
- `POST /api/v1/auth/:projectPublicId/login`
- `POST /api/v1/auth/:projectPublicId/refresh`
- `POST /api/v1/auth/:projectPublicId/logout`
- `GET /api/v1/auth/:projectPublicId/me`
- Project-scoped user/role/session endpoints, protected by the appropriate project credentials and permissions.

### Audit and operational endpoints
- `GET /api/v1/projects/:projectId/audit-logs`
- `GET /health`

All routes are proposals until the implementation plan documents the final route map. Every endpoint must have explicit authentication, authorization, validation, and project-scope rules.

## 10. Main user journeys

### Journey A: Register and enter the dashboard
1. A developer opens ALSH.
2. They register with their name, email, and password.
3. The backend validates input, hashes the password, and stores the user in MongoDB Atlas.
4. The developer logs in and reaches the dashboard.
5. Invalid input or credentials show safe error messages.

### Journey B: Create a project
1. The signed-in owner chooses **Create Project**.
2. They enter project name, environment, and optional description/origins.
3. The backend validates ownership and input, then persists the project.
4. ALSH creates a public project identifier and a private secret.
5. The secret is shown once with a warning to copy it safely.
6. The project appears in the owner's dashboard.

### Journey C: Integrate authentication
1. The owner opens the project's integration guide.
2. They follow documented environment and API instructions.
3. They test end-user registration and login against the project-specific endpoint.
4. Tokens/session behavior follows the documented security model.
5. The owner can revoke/rotate credentials and inspect safe audit events.

### Journey D: Enforce roles
1. The owner creates roles and permissions.
2. The owner assigns a role to a project user through a protected operation.
3. A protected request is authorized by the backend.
4. Unauthorized or cross-project requests are denied.

## 11. Acceptance criteria

The MVP is not complete until the following can be demonstrated:

1. A user can register, log in, and log out of the ALSH dashboard.
2. Dashboard users and projects persist in MongoDB Atlas.
3. An owner can create, list, view, update, and archive/delete their own projects.
4. A project-specific credential is generated; the secret is never stored or returned as plaintext after its initial reveal.
5. The documented application-user register/login/refresh/logout flow works end-to-end.
6. Passwords are hashed, tokens are validated, and refresh-token rotation/revocation works according to the documented design.
7. Roles and permissions are enforced on the backend.
8. Project A cannot access Project B's users, roles, sessions, credentials, or logs.
9. Important events appear in the audit-log view without exposing secrets.
10. Forms and data screens have loading, empty, success, and error states.
11. Automated tests cover critical success and failure cases.
12. The project can be run locally using documented commands without Docker.
13. `.env.example` documents required variables but contains no real credentials.
14. The README explains installation, Atlas setup, environment configuration, testing, and deployment.
15. No core screen is relying on fake hard-coded data when it is meant to demonstrate a real backend flow.

## 12. Risks and assumptions

- MongoDB Atlas network access, database users, and connection strings must be configured by the developer.
- Cookie-based sessions across separate frontend/backend domains require correct CORS and cookie settings; the implementation plan must choose and document the deployment model.
- A public frontend cannot safely hold a private project secret. Client-side applications must use a public identifier and an appropriate flow; server secrets remain on trusted servers.
- The MVP is a prototype and must not be marketed as independently audited or production-certified.
- Security decisions must be documented, tested, and reviewed rather than assumed secure because a library is used.

## 13. Future roadmap

After MVP acceptance and explicit approval:
- MFA.
- Social login and passwordless flows.
- Additional SDKs and CLI.
- OpenAPI specification and sandbox.
- Webhooks.
- Enterprise SAML/OIDC SSO.
- ABAC and more advanced policy management.
- Compliance reporting.
- High-availability and scaling improvements.

## 14. Source-of-truth rule

This SRS is the requirements baseline. `IMPLEMENTATION.md` describes the proposed build approach and must not silently remove or weaken requirements in this SRS. `ANTIGRAVITY_BUILD_PROMPT.md` governs how the coding agent must inspect, plan, seek approval, implement in stages, test, and report. If the documents conflict or an important security decision is ambiguous, the agent must identify the conflict and ask for a decision before implementing the affected feature.
