# Authentication Flow

## Overview
The auth system uses short-lived JWT access tokens plus rotating refresh tokens stored in HttpOnly cookies. Access tokens are kept in memory on the frontend and refreshed automatically before expiry.

## Endpoints
- `POST /auth/signup`: Create account (email + password). Returns verification status.
- `POST /auth/login`: Email + password login. Returns access token and sets refresh + CSRF cookies.
- `POST /auth/wallet/login`: Wallet signature login. Returns access token and sets refresh + CSRF cookies.
- `POST /auth/social/login`: Social login (dev stub) using provider + token.
- `POST /auth/refresh`: Rotate refresh token and return new access token.
- `POST /auth/logout`: Revoke current refresh token and clear cookies.
- `POST /auth/logout-all`: Revoke all refresh tokens and clear cookies.
- `GET /auth/sessions`: List sessions for the current user (JWT protected).
- `GET /auth/profile`: Return JWT payload for the current user.
- `GET /auth/csrf`: Issue CSRF token cookie for SPA bootstrapping.
- `POST /auth/verify-email`: Verify an email token.

## Token Storage
- Access tokens: in memory only (React context)
- Refresh tokens: `refresh_token` HttpOnly cookie (`/auth` path)
- CSRF tokens: `csrf_token` cookie and `X-CSRF-Token` header

## Refresh Token Rotation
Every refresh call rotates the refresh token. Reuse of a revoked refresh token revokes all user sessions.

## Session Management
Refresh tokens are tracked in the `refresh_tokens` table with IP, user agent, and last-used timestamps. Session expiry is enforced by refresh token TTL.

## Security Controls
- CSRF guard required for refresh and logout actions
- XSS mitigation via React encoding and server `helmet`
- Rate limiting on auth endpoints using endpoint type `auth`
- Audit logging for auth events in `audit_logs`

## Frontend Notes
- `AuthProvider` bootstraps via `/auth/csrf` then `/auth/refresh`
- `ProtectedRoute` guards routes and redirects unauthenticated users to `/login`
- Logout is broadcast across tabs via `localStorage` event

## Environment Variables
- `JWT_SECRET`: JWT signing secret
- `JWT_ACCESS_TTL`: Access token TTL (default `15m`)
- `REFRESH_TOKEN_TTL_DAYS`: Refresh token TTL (default `30`)
- `EMAIL_VERIFICATION_TTL_HOURS`: Email verification token TTL (default `24`)
- `REQUIRE_EMAIL_VERIFICATION`: `true` to require email verification before login
- `CORS_ORIGIN`: Comma-separated allowed origins (default `http://localhost:3000`)
