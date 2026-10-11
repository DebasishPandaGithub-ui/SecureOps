# SecureOps — Enterprise Operations Console

A full-stack admin dashboard built with React, TypeScript, Vite, Node.js, Express, JWT, and MongoDB.

## Features

- Email/password registration and login with bcrypt password hashing and 8-hour JWT sessions
- Role-based access control (`user`, `manager`, `admin`)
- Transaction creation, listing, review, and deletion with ownership checks
- Dashboard summary counts and transaction volumes
- Admin team listing and role management
- Responsive React UI with filters, loading/error states, and transaction form
- Exact-origin CORS allowlist, security headers, request-size limits, in-memory rate limits, validation, and centralized error handling
- Public registration always creates a standard `user`; it cannot grant admin privileges

## Requirements

- Node.js 20 or newer and npm
- MongoDB running locally or a MongoDB Atlas connection string

## Quick start on Windows

1. Extract the ZIP.
2. Run `start-dev.bat`.
3. On first run, it creates `backend/.env`. Edit that file and replace the `JWT_SECRET` placeholder with a unique random value at least 32 characters long. Configure `MONGO_URI` if you're using MongoDB Atlas or a different local setup.
4. Run `start-dev.bat` again. It installs missing dependencies and opens separate backend/frontend terminals.
5. Visit `http://localhost:5173`.

The batch file cannot start MongoDB for you. Ensure your local MongoDB service is running, or use a valid Atlas URI with the right network access and database credentials.

## Manual start (Windows, macOS, or Linux)

Backend terminal:

```bash
cd backend
# Copy .env.example to .env, then edit JWT_SECRET and MONGO_URI
npm install
npm run check
npm run dev
```

Frontend terminal:

```bash
cd frontend
# Copy .env.example to .env if needed
npm install
npm run build
npm run dev
```

API: `http://localhost:5000/api`; health endpoint: `http://localhost:5000/api/health`.

## Environment configuration

`backend/.env`:

- `MONGO_URI`: database connection string
- `JWT_SECRET`: unique random secret, at least 32 characters; do not reuse the old secret
- `CLIENT_ORIGIN`: comma-separated exact frontend origins, e.g. `http://localhost:5173`
- `NODE_ENV`: use `production` for production configuration
- `PORT`: API port (defaults to 5000)

`frontend/.env`:

- `VITE_API_URL=http://localhost:5000/api`

CORS is intentionally configured for explicit origins. If you deploy the frontend, set `CLIENT_ORIGIN` to its exact HTTPS origin. Do not use `*`. CORS is a browser policy, not an API authentication mechanism.

## First administrator

Public registration always creates a `user`. To create the first administrator, register an account, then promote it through an authorized MongoDB connection using `mongosh`:

```javascript
use secureops
db.users.updateOne({ email: "admin@your-company.com" }, { $set: { role: "admin" } })
```

Replace the email with the account you registered. Do not expose database credentials. Sign out and sign in again after role changes.

## API overview

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public, rate-limited | Create standard user account |
| POST | `/api/auth/login` | Public, rate-limited | Sign in and receive JWT |
| GET | `/api/auth/me` | Authenticated | Get current user's safe profile |
| GET | `/api/dashboard/summary` | Authenticated | Dashboard counts and amounts |
| GET | `/api/transactions` | Authenticated | List transactions visible to caller |
| POST | `/api/transactions` | Authenticated | Create a pending transaction |
| PATCH | `/api/transactions/:id/status` | Admin/manager | Approve or reject pending transaction |
| DELETE | `/api/transactions/:id` | Owner of pending transaction/admin | Delete a transaction |
| GET | `/api/users` | Admin | List users without password hashes |
| PATCH | `/api/users/:id/role` | Admin | Change another user's role |

Protected requests use `Authorization: Bearer <token>`.

## Security and verification notes

- Never commit `.env`; the original uploaded archive contained a real-looking secret file. Rotate its MongoDB credentials and JWT secret if they were ever pushed to GitHub, and consider purging them from Git history.
- The browser client stores the JWT in `localStorage` for this demo. XSS prevention remains important; for higher-assurance production use, consider HttpOnly secure cookies plus CSRF protections.
- The included rate limiter is in-memory and per process. Use a shared store (e.g. Redis) when running multiple instances or behind a load balancer.
- Use HTTPS, least-privilege MongoDB credentials, monitoring, backups, and regular dependency audits in production.
- No application can honestly be guaranteed to have zero bugs or vulnerabilities. This source has had JavaScript syntax checks, but full build, live MongoDB integration, browser testing, and penetration testing must be run in your environment before production deployment.
- Dashboard amounts display USD; change the currency formatter if your business uses another currency.
