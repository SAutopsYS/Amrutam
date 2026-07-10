# Security Architecture Overview

## Defense in Depth

```
Client (HTTPS) → Helmet + CORS + Rate Limiter → JWT Guard → RBAC Guard → Service Layer → Repository → Database
                                                                                    ↓
                                                                              Audit Log
```

## Authentication
- JWT access tokens (short-lived) with refresh token rotation architecture
- Token expiration logged as security events
- Public routes explicitly marked with `@Public()`

## Authorization
- Role-based guards (`@Roles()`) — no authorization logic in controllers
- Domain-level access checks (e.g., `ConsultationAccessService`)

## Data Protection
- Passwords: bcrypt with configurable rounds
- Secrets: environment variables, validated at startup, min 32 chars
- Logs: PHI/PII masked via `sanitizeForLog()`
- Production: stack traces never returned to clients

## Encryption
- **In transit**: HTTPS (terminated at load balancer)
- **At rest**: PostgreSQL encryption (cloud provider responsibility)
- **Secrets**: Environment variables today; designed for AWS Secrets Manager / HashiCorp Vault

## Dependency Security
- `npm audit --audit-level=high` in CI pipeline
- Pin major dependency versions in package-lock.json
