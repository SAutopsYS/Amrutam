# ADR-007: JWT for Stateless Authentication

## Status
Accepted

## Context
The API must authenticate patients, doctors, and admins across horizontally scaled pods without server-side session storage. Mobile and web clients need a standard, widely supported token format.

## Decision
Use **JWT access tokens** (short-lived, 15 minutes) with **refresh tokens** stored in PostgreSQL (`RefreshToken` table). Every protected route is guarded globally by `JwtAuthGuard`; public routes opt out with `@Public()`.

Token payload includes `sub` (user ID) and role information for `RolesGuard`.

## Consequences

**Positive:**
- Stateless verification — any pod can validate tokens without shared session store
- Standard `Authorization: Bearer` header works across all clients
- Refresh token rotation enables secure long-lived sessions
- Passport-JWT integrates cleanly with NestJS guard pipeline

**Negative:**
- Immediate revocation requires a token blocklist (not yet implemented)
- Token size grows with embedded claims — keep payload minimal
- Auth endpoints (login/register) are infrastructure-ready but not yet exposed as HTTP routes

## Alternatives Considered
- **Server-side sessions (Redis)** — rejected; adds stateful dependency on every request
- **OAuth2-only (no first-party JWT)** — deferred; first-party auth needed for MVP
- **API keys for mobile** — rejected; JWT with refresh provides better expiry semantics
