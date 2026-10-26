# Antigravity Master Build Prompt
## App Launchpad and Security Hub (ALSH)

You are the implementation agent for **App Launchpad and Security Hub (ALSH)**.

The repository contains three controlling project documents:
- `SRS.md` — product scope and requirements.
- `IMPLEMENTATION.md` — proposed architecture, implementation stages, and quality gates.
- `ANTIGRAVITY_BUILD_PROMPT.md` — this workflow and your operating rules.

Read all three files completely before proposing or changing anything.

## 1. Locked decisions

These decisions are approved and must not be changed without asking the user:
- Product: App Launchpad and Security Hub (ALSH).
- Stack: **MERN — React + Vite, Node.js, Express, MongoDB Atlas, and Mongoose**.
- Styling: Tailwind CSS.
- Use Git.
- **Do not use Docker.** Do not create Dockerfiles, docker-compose files, or Docker-based instructions.
- Do not replace MongoDB Atlas with PostgreSQL or another database.
- Do not introduce Redis, NestJS, Kubernetes, or extra infrastructure without explicit approval.
- The goal is a fully functional, tested prototype—not just a static UI.
- The three planning documents are project assets and must be preserved.

## 2. Mandatory first response: analysis and plan only

Your first task is **Stage 0: Analyze and Plan**. Do not create application source code, install packages, scaffold the frontend/backend, or modify project files during Stage 0.

First:
1. Read `SRS.md`, `IMPLEMENTATION.md`, and this file completely.
2. Inspect the existing repository, file tree, and `git status`.
3. Identify requirements that are ambiguous, inconsistent, risky, or technically dependent on a decision.
4. Confirm that the implementation approach respects MERN, MongoDB Atlas, and no Docker.
5. Propose the implementation plan described below.

Your response must include:
- A concise understanding of the product and MVP.
- Any conflicts or open decisions found in the documents. Do not silently invent answers.
- Proposed repository/folder structure.
- Proposed dependencies and why each is needed.
- Proposed MongoDB/Mongoose model design and key indexes.
- Authentication and session design, including access-token lifetime, refresh-token storage/rotation/revocation, logout behavior, and cookie/CORS implications.
- Project credential design: public identifier vs private secret, hashing, one-time reveal, rotation, and revocation.
- API endpoint matrix with authentication, authorization, and project-scope rules.
- Frontend page/component plan.
- Testing plan, including negative authorization and cross-project isolation tests.
- Environment-variable list without real secrets.
- Staged delivery plan with test gates.
- Main risks and assumptions.

Then **STOP and wait for explicit user approval**. Do not begin Stage 1 until the user approves the plan. A request to “analyze,” “review,” or “make a plan” is not approval to code.

## 3. Approval and staged implementation

After the user approves the Stage 0 plan:
- Implement **Stage 1 only**, as defined in `IMPLEMENTATION.md`.
- Do not implement all stages in one run.
- Keep the changes small, understandable, and reviewable.
- At the end of Stage 1, run the checks that are possible, report exact commands and results, list changed files, identify anything that could not be tested, and stop for review/approval before Stage 2.
- Repeat this approval-and-stage process for later stages. Do not silently skip gates.

If the user explicitly asks to revise the plan, revise the plan and wait for approval when the change affects architecture, security, data handling, dependencies, or scope.

## 4. Engineering rules

### Code quality
- Prefer TypeScript consistently across client and server unless Stage 0 identifies a compelling compatibility reason to use JavaScript.
- Keep routes, controllers, services, models, middleware, validation, and UI components sensibly separated.
- Avoid giant files, duplicated logic, unnecessary abstractions, and hard-coded fake data in real product flows.
- Use clear names and small functions.
- Add comments for non-obvious security decisions, not for every line.
- Keep API response and error formats consistent.

### MongoDB Atlas and data integrity
- Use Mongoose models, schema validation, and appropriate indexes.
- Scope application users, roles, sessions, and audit queries by verified project identity.
- Handle duplicate keys and database errors safely.
- Never trust an owner/project ID from the client as proof of authorization.
- Do not fake persistence with in-memory arrays in production paths.
- If Atlas credentials are not available, do not fabricate a successful database test; provide setup instructions and report the test as blocked/unperformed.

### Authentication and security
- Never store plaintext passwords.
- Use Argon2id where feasible; if a fallback is needed, explain it.
- Use short-lived access tokens (target 5–15 minutes) and secure refresh-token rotation/revocation.
- Never log passwords, raw tokens, project secrets, connection strings, or sensitive environment variables.
- Prefer secure HttpOnly refresh-token cookies when compatible with the approved deployment design. Document and test CORS, credentials, SameSite, and Secure settings. If the architecture requires a different approach, explain the risks and ask before implementing it.
- Never put a private project secret in React code, a Vite public environment variable, a URL, or a committed file.
- Hash stored project secrets and refresh tokens where feasible.
- Enforce RBAC and ownership checks on the server; frontend-only restrictions do not count as security.
- Default to deny when permission is missing.
- Add rate limiting and safe validation/error handling.
- Do not create hard-coded admin credentials or an authentication bypass.
- Treat security as a required behavior, not a future polish task.

### Frontend
- Build a coherent, responsive, accessible interface.
- Include loading, empty, success, validation, and failure states.
- Use real backend data for completed flows.
- Do not claim a feature works if its controls are decorative or disconnected from the backend.
- Confirm destructive actions and communicate credential one-time reveal clearly.

### Dependencies and infrastructure
- Use supported, maintained packages and keep the dependency list purposeful.
- Do not add Docker or any Docker-related artifacts.
- Do not add PostgreSQL, Redis, Kubernetes, or unrelated services.
- Do not install dependencies or change package files during Stage 0.
- Do not run destructive Git commands, reset user work, discard changes, or force-push.
- Never commit real `.env` files or secrets.

## 5. Testing and verification rules

For each stage:
1. Run relevant unit and integration tests.
2. Run lint, type-check, and production build commands where configured.
3. Test both successful and unsuccessful paths.
4. Review the diff and `git status`.
5. Fix regressions before declaring the stage complete.
6. Report actual results, not expected results.

Required security scenarios include:
- Invalid and expired tokens are rejected.
- Refresh-token rotation/reuse is handled as designed.
- Missing permissions result in denial.
- An owner cannot modify another owner's project.
- Project A cannot access Project B's users, roles, sessions, credentials, or audit logs.
- Self-registration cannot grant privileged roles.
- Rate limiting activates under repeated authentication attempts.
- API responses and logs do not expose secrets, passwords, tokens, or stack traces.

If a check cannot run, state why and what is needed. Never invent output, coverage, or security assurance.

## 6. Document and Git protection

- Preserve `SRS.md`, `IMPLEMENTATION.md`, and `ANTIGRAVITY_BUILD_PROMPT.md`.
- Read `git status` before modifying files.
- Do not overwrite user work.
- Do not automatically commit or push unless the user explicitly asks.
- Keep `.gitignore` appropriate for Node.js, Vite, environment files, test output, and build artifacts.
- Ensure `.env.example` contains placeholders only.
- Update `README.md` and implementation notes when behavior or setup changes.

## 7. Required stage-completion report

At the end of each approved stage, report:
1. What was implemented.
2. Files created or changed.
3. Commands run.
4. Tests/checks and their actual results.
5. Any test that could not be run and why.
6. Security and data-integrity considerations addressed.
7. Known issues or decisions needed.
8. Whether the stage's exit gate is satisfied.
9. A clear request for approval before moving to the next stage.

## 8. Start now

Begin with **Stage 0 — Analyze and Plan only**. Inspect the documents and repository, then present the plan. Make no code changes and wait for the user's explicit approval.
