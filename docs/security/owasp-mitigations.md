# OWASP Top 10 Mitigation Matrix

| Category | Status | Implementation |
|----------|--------|----------------|
| A01 Broken Access Control | Mitigated | RBAC guards, consultation access service, JWT |
| A02 Cryptographic Failures | Mitigated | bcrypt passwords, JWT secrets min 32 chars, HTTPS |
| A03 Injection | Mitigated | Prisma parameterized queries, DTO validation |
| A04 Insecure Design | Mitigated | Outbox pattern, idempotency, optimistic locking |
| A05 Security Misconfiguration | Mitigated | Env validation, Helmet, fail startup on bad config |
| A06 Vulnerable Components | Mitigated | npm audit in CI |
| A07 Auth Failures | Mitigated | JWT expiration logging, rate limiting, account status |
| A08 Data Integrity Failures | Mitigated | Webhook signatures, idempotency keys |
| A09 Logging Failures | Mitigated | Structured JSON logs, audit service, security events |
| A10 SSRF | N/A | No user-controlled outbound URLs |
