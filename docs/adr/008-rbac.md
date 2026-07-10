# ADR-008: Role-Based Access Control (RBAC)

## Status
Accepted

## Context
Telemedicine platforms enforce strict access boundaries: patients see their appointments, doctors manage their consultations, admins access platform-wide analytics. Fine-grained permissions (e.g., "can prescribe controlled substances") may be needed later.

## Decision
Implement **RBAC via NestJS guards and decorators**:
- `@Roles(RoleName.DOCTOR)` metadata on controller methods
- `RolesGuard` reads role from JWT payload and enforces at the HTTP layer
- Application services perform **resource-level checks** (e.g., doctor owns consultation)
- Prisma `Role` and `Permission` tables are seeded for future fine-grained RBAC

## Consequences

**Positive:**
- Declarative, readable authorization on controllers
- Two-layer security: role guard + service-level ownership check
- Database permission matrix ready for `@Permissions()` guard without schema changes
- Audit logs capture actor role on every sensitive action

**Negative:**
- Role-only checks are coarse — not yet using DB-backed permissions
- `@Permissions()` decorator exists but guard is not wired (documented as future work)
- Role changes require new token issuance (JWT embeds role at sign time)

## Alternatives Considered
- **ABAC (attribute-based)** — overkill for MVP; RBAC covers current personas
- **ACL per resource row** — partially implemented via service-level checks; full ACL table deferred
- **External auth provider RBAC (Auth0 roles)** — deferred; first-party JWT chosen for control
