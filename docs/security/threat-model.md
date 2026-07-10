# Amrutam Security — Threat Model (STRIDE)

## Assets
- Patient medical records (consultations, prescriptions, clinical notes)
- User credentials and session tokens
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

## Threats & Mitigations

| STRIDE | Threat | Mitigation |
|--------|--------|------------|
| Spoofing | JWT forgery | HS256 with 32+ char secrets, expiration, validation |
| Tampering | Prescription alteration | Immutable versioning, audit trail |
| Repudiation | Deny clinical action | Immutable audit logs with correlation IDs |
| Information Disclosure | PHI in logs/responses | Field masking, RBAC, response filtering |
| Denial of Service | API flooding | Rate limiting, circuit breakers, queue backpressure |
| Elevation of Privilege | Patient accesses doctor data | Policy-based RBAC guards |

## Residual Risks
- Insider with admin credentials — mitigated by audit, least privilege
- Provider compromise — mitigated by webhook signature verification
- Zero-day dependencies — mitigated by npm audit in CI
