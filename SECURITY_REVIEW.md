# SecureOps security review

## Addressed in this package

- Exact-origin CORS allowlist; wildcard origins are rejected at startup.
- No credentialed CORS; API uses explicit bearer-token authentication.
- Helmet-equivalent baseline response headers without adding an external runtime dependency.
- Request body size limit, JSON body checks, centralized error responses, and generic server errors.
- Per-process request rate limits on API traffic and stricter limits on login/registration.
- JWT verification restricts HS256 and checks issuer, audience, and expiry.
- Current role is loaded from MongoDB on every authenticated request; client-provided roles are ignored during registration.
- Password hashes are excluded from normal user queries and user-list responses.
- Transaction ownership and review permissions are enforced server-side; only pending transactions can be reviewed.
- The original `.env` file and all secrets are excluded from this archive.

## Important remaining limitations

- The frontend stores the JWT in `localStorage`; an XSS vulnerability could expose it. For higher-assurance production, use HttpOnly/Secure/SameSite cookies with CSRF protection and continue to prevent XSS.
- Rate limiting is in-memory and per process. Multi-instance deployments need a shared rate-limit store.
- Security headers and CORS do not replace authentication, authorization, HTTPS, or database access controls.
- The source has passed backend JavaScript syntax checks. This environment could not complete npm dependency installation, so the frontend production build and a live backend/MongoDB integration test have not been verified here. Run the setup/build commands in README in an environment with npm registry access and a working MongoDB instance.
- No software can be guaranteed to have zero vulnerabilities. Perform dependency audits, automated tests, and a deployment-specific security review before production.

## Credential incident response

The uploaded original archive included `backend/.env` with values that looked like real credentials. Treat those values as compromised if the archive or Git repository was publicly accessible:

1. Rotate the MongoDB user's password/credentials.
2. Generate a unique random JWT secret (at least 32 characters) and update deployment secrets.
3. Revoke any other credentials found in that file.
4. Remove secrets from Git history if committed; deleting the file in a new commit is not sufficient.
5. Never commit `.env`; use `.env.example` only for placeholders.
