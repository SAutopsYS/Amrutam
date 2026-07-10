# ADR-003: PostgreSQL as Primary Database

## Status
Accepted

## Context
Telemedicine workloads require ACID transactions (booking + payment + audit in one unit of work), relational integrity across users/doctors/appointments/clinical records, and strong query flexibility for admin analytics and audit trails.

## Decision
Use **PostgreSQL 16** as the single source of truth. All authoritative state — including the transactional outbox — lives in PostgreSQL. Redis is used only for cache and queues, never as a source of truth.

## Consequences

**Positive:**
- ACID transactions enable booking + outbox + audit atomically
- JSON columns for flexible event payloads without sacrificing relational integrity
- Mature ecosystem: PITR backups, read replicas, managed cloud offerings
- Row-level locking and `FOR UPDATE` available when needed alongside optimistic locking

**Negative:**
- Vertical scaling limits require read replicas and connection pooling at high load
- Single database is a shared dependency across all modules (acceptable in modular monolith)

## Alternatives Considered
- **MongoDB** — rejected; weak multi-document transaction story for booking workflows
- **MySQL** — viable; PostgreSQL preferred for JSON support and advanced indexing
- **CockroachDB** — overkill for current scale; adds operational complexity
