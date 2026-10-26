# Implementation Plan
## App Launchpad and Security Hub (ALSH)

**Version:** 1.0  
**Status:** Proposed implementation baseline  
**Stack:** MERN + MongoDB Atlas  
**Docker:** Not permitted / not used

---

## 1. Implementation principles

1. Build a working product, not a static mockup.
2. Follow `SRS.md` as the requirements baseline.
3. Start by inspecting the repository and all project documents.
4. Produce a plan and wait for the user's approval before coding.
5. Work in small, testable stages; implement Stage 1 only after initial approval.
6. Run relevant checks after every stage and fix regressions before moving on.
7. Never fabricate test results or claim completion without evidence.
8. Do not overwrite the three planning documents.
9. Do not add Docker, PostgreSQL, Redis, or unrelated infrastructure.
10. Keep credentials, tokens, and personal data out of source control and logs.

## 2. Agreed stack

### Frontend
- React + Vite.
- TypeScript preferred.
- Tailwind CSS.
- React Router for page navigation.
- A small, consistent API client layer.
- Accessible forms and reusable UI components.

### Backend
- Node.js + Express.
- TypeScript preferred.
- Mongoose for MongoDB Atlas.
- Zod or equivalent for environment and request validation.
- Centralized error-handling middleware.
- Explicit authentication, authorization, ownership, and project-scope middleware.

### Database
- MongoDB Atlas.
- Mongoose models and indexes.
- Separate collections for platform users, projects, credentials, application users, roles, permissions/assignments, sessions, and audit logs as appropriate.
- Compound indexes for project-scoped identities and frequent queries.
- Never put real Atlas credentials in Git.

### Security libraries and controls
- Argon2id password hashing preferred; bcrypt only if documented as a practical fallback.
- A maintained JWT library or an equally well-supported signed-token approach.
- Strong cryptographic random generation for project secrets and refresh tokens.
- Hash stored secrets/refresh tokens where feasible.
- Rate limiting, security headers, strict CORS, validation, and safe logs.
- Short-lived access tokens (target 5–15 minutes), refresh-token rotation and revocation.
- Secure HttpOnly cookies for refresh tokens when the chosen hosting topology supports them safely.

### Development and delivery
- Git for version control.
- Postman or equivalent for API checks.
- Automated tests.
- Vercel frontend and Render backend are the initial deployment direction, subject to cookie/CORS compatibility checks.
- Local setup uses ordinary Node.js/npm commands. **No Docker files or commands.**

## 3. Repository organization

The exact folder tree must be proposed by Antigravity before it creates files. A reasonable starting direction is a single repository with clearly separated client and server applications, shared documentation at the root, and shared types only if useful.

Expected root-level project documents:
- `SRS.md`
- `IMPLEMENTATION.md`
- `ANTIGRAVITY_BUILD_PROMPT.md`
- `README.md` (created during implementation)
- `.gitignore`
- `.env.example` or separate safe examples for frontend/backend

The agent must not generate the complete application in one huge file. It should use a maintainable separation of routes, controllers, services, models, middleware, validators, and UI components. Avoid creating empty abstraction layers that add complexity without a purpose.

## 4. Proposed architecture

### Request flow
1. React UI sends an HTTP request through the API client.
2. Express route validates request input.
3. Authentication middleware identifies the caller.
4. Authorization/ownership/project-scope middleware verifies access.
5. Controller delegates business logic to a service.
6. Service reads/writes MongoDB through Mongoose models.
7. Audit event is written for security-sensitive actions.
8. A consistent response or safe error is returned to the client.

### Separation of identities
- **Platform users** sign into the ALSH dashboard and own projects.
- **Application users** sign into an application that integrates with ALSH.
- Do not accidentally use a platform-owner session as an application-user session.
- Keep project scope explicit in application-user, role, permission, session, and audit queries.

### Project credentials
- Public project identifier: safe to disclose where needed by the documented integration.
- Private project secret: server-only; never embed in a browser bundle.
- Generate secrets with a cryptographically secure random source.
- Store only a hash of private secrets where feasible.
- Reveal plaintext only during initial creation/rotation, and explain that it cannot be viewed later.
- Rotation must invalidate the old credential according to the documented lifecycle.

## 5. Data model implementation notes

Antigravity must propose final schemas and indexes before coding. At minimum, account for:

| Model/collection | Key responsibilities |
|---|---|
| `PlatformUser` | Dashboard account, normalized email, password hash, account status, timestamps |
| `Project` | Owner reference, project name/slug, environment, origins, status, timestamps |
| `ProjectCredential` | Project reference, public ID, secret hash, status and rotation/revocation metadata |
| `AppUser` | Project reference, normalized identity, password hash, status and profile fields |
| `Role` | Project-scoped role definitions |
| `Permission` | Permission keys and descriptions with a documented scope |
| `RolePermission` / assignment | Role-to-permission and user-to-role relationships |
| `Session` / `RefreshToken` | Token hash/identifier, token family, expiry, rotation/revocation data, subject and project scope |
| `AuditLog` | Actor, event, outcome, project scope, timestamp, safe metadata |

Implementation requirements:
- Add unique indexes and handle duplicate-key errors gracefully.
- For application users, prefer a unique compound index such as `{ projectId: 1, normalizedEmail: 1 }`.
- Never use a client-provided owner ID as authorization proof.
- Do not log sensitive schema fields.
- Choose archive/delete semantics carefully so audit history is not accidentally erased.
- Avoid unbounded arrays for large or growing relationships.

## 6. API design and conventions

Use a versioned REST API, initially `/api/v1`.

The agent must produce an endpoint matrix listing method, path, caller identity, authentication method, required authorization, project scope, validation, and expected status codes before implementing the corresponding routes.

General conventions:
- Consistent JSON response/error format.
- Appropriate HTTP status codes.
- Validate params, query strings, and request bodies.
- Reject unknown or unexpected sensitive fields where practical.
- Use pagination for list endpoints.
- Do not expose stack traces or secrets.
- Do not trust client-provided project scope until it has been bound to verified credentials and authorization.

Candidate endpoint groups:
- Platform registration/login/logout/current user.
- Project CRUD/archive.
- Project credential creation/rotation/revocation.
- Project role and permission management.
- Application-user register/login/refresh/logout/current user.
- Role assignment and authorization checks.
- Audit-log query.
- Health endpoint.

Final paths and token transport must be fixed in the plan before coding.

## 7. Frontend pages and states

Proposed screens:
1. Landing / product overview.
2. Register.
3. Login.
4. Dashboard overview.
5. Projects list.
6. Create project.
7. Project details and configuration.
8. Credentials view/rotation.
9. Roles and permissions.
10. Audit logs.
11. Developer integration/API guide.
12. Account settings.
13. Not-found and safe error pages.

Each data-driven screen should support:
- Loading state.
- Empty state.
- Success feedback.
- Validation errors.
- API/network errors.
- Confirmation for destructive actions.
- Responsive behavior and keyboard accessibility.

The final UI must be consistent, polished, and usable, but visual polish must not take priority over correct authorization and data handling.

## 8. Stage-by-stage delivery plan

### Stage 0 — Analyze and plan (no application code)
- Read all three project documents fully.
- Inspect current Git status and existing repository files.
- Identify conflicts, missing decisions, risks, and scope ambiguities.
- Propose architecture, folder tree, dependencies, environment variables, data model, API matrix, authentication/token design, test strategy, and staged work plan.
- Wait for explicit user approval before changing files or coding.

**Exit gate:** User approves the plan. No source-code changes are made in this stage.

### Stage 1 — Repository foundation and environment
- Create the approved frontend/backend structure.
- Configure package scripts, TypeScript/lint/format choices if selected, and `.gitignore`.
- Add safe `.env.example` files.
- Add basic app/server entry points, environment validation, health endpoint, and a MongoDB Atlas connection module.
- Add basic automated test setup.
- Document exact local startup and test commands.
- Do not build all product features in Stage 1.

**Verification:** Install dependencies, run lint/type-check/build/tests as configured, start the server, verify health endpoint, and verify database connection when valid local environment values are supplied. If Atlas credentials are unavailable, test graceful configuration failure and document the unperformed live-connection test honestly.

### Stage 2 — Core backend foundation and platform-owner authentication
- Define platform-user schema and indexes.
- Implement register/login/logout/current-user flows.
- Add password hashing, session/token handling, rate limiting, validation, safe errors, and security middleware.
- Add unit and integration tests.

**Exit gate:** Success and failure paths pass tests; no plaintext password or token leakage.

### Stage 3 — Frontend shell and dashboard authentication
- Build shared layout, routing, forms, and authenticated route protection.
- Connect UI to real backend APIs.
- Handle loading/error/empty states.
- Test registration, login, refresh/session behavior, and logout end-to-end.

### Stage 4 — Project management and credentials
- Implement project create/list/detail/update/archive.
- Add owner checks and project indexes.
- Add secure project credential generation, one-time secret reveal, rotation, and revocation.
- Add audit events and tests, especially cross-owner denial.

### Stage 5 — Application-user authentication API
- Implement project-scoped registration/login/refresh/logout/me endpoints.
- Implement token validation and refresh-token rotation/reuse detection.
- Ensure private project secrets are only used by trusted backend callers.
- Add integration examples and end-to-end tests.

### Stage 6 — RBAC and project isolation
- Implement roles, permissions, role assignments, and authorization checks.
- Enforce deny-by-default backend checks.
- Test allowed and denied actions, privilege escalation attempts, and Project A vs Project B isolation.

### Stage 7 — Audit logs and developer experience
- Implement paginated/filterable audit log API and UI.
- Build integration documentation and example requests.
- Add project connection/test flow if included in the approved plan.

### Stage 8 — Hardening, QA, and usability
- Review CORS, cookies, rate limits, security headers, validation, logging, token lifecycle, and secret handling.
- Run automated tests, type checks, lint, build, manual acceptance checks, and relevant security tests.
- Fix defects before proceeding.
- Report actual test/coverage results.

### Stage 9 — Documentation and deployment readiness
- Complete README and `.env.example`.
- Document MongoDB Atlas setup, local development, testing, API integration, deployment, and known limitations.
- Prepare Vercel/Render deployment settings without committing secrets.
- Do not claim production readiness or certification without independent evidence.

Stages may be refined after Stage 0, but changes to requirements or security trade-offs require the user's approval.

## 9. Testing strategy

### Unit tests
- Input validation and normalization.
- Password hashing/verification.
- Token claims, expiry, and verification.
- Refresh-token rotation and reuse detection.
- Permission resolution.
- Project-owner and project-scope checks.
- Error mapping and safe responses.

### Integration tests
- Platform registration → login → current user → logout.
- Project create → list → update → archive.
- Credential create → validate use → rotate/revoke.
- Application-user registration → login → refresh → protected route → logout.
- Role creation → assignment → allowed action and denied action.
- Audit event generation and safe retrieval.

### Isolation/security tests
- Owner A cannot modify Owner B's project.
- Project A cannot read or modify Project B's users, roles, sessions, credentials, or audit logs.
- Invalid, expired, tampered, and replayed tokens are rejected.
- Missing permission results in denial.
- Self-registration cannot assign privileged roles.
- Brute-force requests are rate-limited.
- Responses and logs do not leak passwords, tokens, secrets, connection strings, or stack traces.

### Quality gates
Do not proceed to the next stage until:
- Relevant tests pass.
- Lint/type-check/build checks pass where configured.
- New errors and warnings are reviewed.
- Manual smoke tests for the stage pass.
- The agent summarizes changed files, commands run, test outcomes, and known issues.

## 10. Environment variables

The exact list must be finalized during Stage 0. Likely variables include:
- `NODE_ENV`
- `PORT`
- `MONGODB_URI`
- `CLIENT_ORIGIN`
- `JWT_ACCESS_SECRET` or key configuration appropriate to the approved signing design
- Refresh-token/session configuration
- Cookie/security configuration
- Any project-secret hashing or encryption configuration required by the chosen design

Use strong unique values for local and production environments. `.env.example` must contain placeholders only. Never commit `.env`, production credentials, or real tokens. The frontend may expose only variables explicitly intended to be public; private server secrets must never use a Vite `VITE_` variable.

## 11. Local developer workflow

1. Install a supported Node.js LTS version and Git.
2. Create a MongoDB Atlas cluster and database user.
3. Restrict Atlas network access appropriately; avoid broad access in production.
4. Copy `.env.example` to the relevant local `.env` file(s) and fill in local values.
5. Install dependencies using the documented package manager.
6. Start the backend and frontend using ordinary npm scripts.
7. Run unit/integration tests and lint/type-check/build commands.
8. Use Postman or the integration guide to test APIs.

All commands must be documented and must work without Docker.

## 12. Git and change management

- Keep the three planning documents in the repository.
- Never delete or overwrite them without explicit permission.
- Use small, reviewable commits.
- Do not reset, rebase, force-push, delete branches, or discard user changes without permission.
- Before edits, inspect `git status`.
- Do not add `.env`, credentials, build outputs, or `node_modules` to Git.
- If a remote repository is not configured, do not invent its URL or push automatically.
- The user reviews Antigravity's plan and diffs before approving significant changes.

## 13. Definition of done

The MVP is ready for owner review only when:
- SRS acceptance criteria have been checked individually.
- Required tests and build checks pass, and results are reported honestly.
- MongoDB Atlas persistence is real for completed flows.
- Authentication and authorization are enforced server-side.
- Cross-project and cross-owner isolation tests pass.
- Secret and token handling follows the documented design.
- Setup, API, environment, and deployment documentation are complete.
- No Docker artifacts or Docker instructions have been introduced.
- Remaining limitations, untested integrations, and security risks are clearly listed.

A passing local prototype is not the same as a formally audited production identity platform.
