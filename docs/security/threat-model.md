# Amrutam Security — Threat Model (STRIDE)

## Assets
- Patient medical records (consultations, prescriptions, clinical notes)
- User credentials, TOTP secrets (encrypted), recovery codes (hashed), session tokens
- Payment transaction data
- Audit logs and operational telemetry

## Actors
- Patient, Doctor, Admin (trusted authenticated)
- Anonymous attacker, malicious insider, compromised account (untrusted)

## Trust Boundaries
- Client ↔ API Gateway (HTTPS)
- API ↔ PostgreSQL (private network)
- API ↔ Redis (private network)
- API ↔ Payment/Notification providers (external)

## Attack Surface
- Public: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/mfa/verify`, `/doctors*`, `/health*`, `/metrics`, payment webhook
- Authenticated: appointments, consultations, prescriptions, notifications, MFA enroll/disable
- Admin: dashboard, analytics, audit, search

## Threats & Mitigations

| STRIDE | Threat | Mitigation |
|--------|--------|------------|
| Spoofing | JWT forgery | HS256 with 32+ char secrets, expiration, validation |
| Spoofing | Stolen password | TOTP MFA (`otplib`) + encrypted secret + recovery codes |
| Tampering | Prescription alteration | Immutable versioning, audit trail |
| Tampering | MFA secret theft from DB | AES-256-GCM at rest (`MFA_ENCRYPTION_KEY`) |
| Repudiation | Deny clinical action | Immutable audit logs with correlation IDs |
| Information Disclosure | PHI in logs/responses | Field masking, RBAC, response filtering |
| Information Disclosure | Recovery codes leak | Shown once; stored as SHA-256 hashes |
| Denial of Service | API flooding | Rate limiting, circuit breakers, queue backpressure |
| Elevation of Privilege | Patient accesses doctor data | Policy-based RBAC guards |

## Residual Risks
- Insider with admin credentials — mitigated by audit, least privilege, MFA
- Provider compromise — mitigated by webhook signature verification
- Zero-day dependencies — mitigated by npm audit in CI
- SIM-swap / authenticator device loss — mitigated by hashed recovery codes
