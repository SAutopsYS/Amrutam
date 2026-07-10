# ADR-001: Modular Monolith Architecture

## Status
Accepted

## Context
Amrutam is a telemedicine platform requiring strong consistency for booking, payments, and clinical records. The team is small, and time-to-market matters. We need an architecture that supports 100K+ consultations/day eventually without operational overhead from day one.

## Decision
Build a **modular monolith** — a single deployable NestJS application with clearly bounded domain modules (`bookings`, `consultations`, `payments`, etc.), each following Clean Architecture layers.

## Consequences

**Positive:**
- Single deployment unit — simple CI/CD, debugging, and local development
- ACID transactions across booking + audit + outbox without distributed transaction complexity
- Module boundaries serve as extraction points for future microservices
- Lower infrastructure cost at early scale

**Negative:**
- Must enforce module boundaries through code review (no compile-time isolation)
- Entire application scales together (mitigated by stateless design + horizontal pod scaling)
- Shared database schema requires careful migration discipline

## Alternatives Considered
- **Microservices from day one** — rejected due to operational complexity and distributed transaction needs
- **Modular monolith without Clean Architecture** — rejected; would lead to tangled dependencies over time
