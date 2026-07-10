# Architecture Decision Records

Architecture Decision Records (ADRs) document significant technical choices and their rationale. They help reviewers understand **why** the system is built this way, not just **what** was built.

| ADR | Title | Status |
|-----|-------|--------|
| [001](./001-modular-monolith.md) | Modular Monolith Architecture | Accepted |
| [002](./002-prisma-orm.md) | Prisma as the ORM | Accepted |
| [003](./003-postgresql.md) | PostgreSQL as Primary Database | Accepted |
| [004](./004-redis.md) | Redis for Cache and Queues | Accepted |
| [005](./005-bullmq.md) | BullMQ for Async Job Processing | Accepted |
| [006](./006-transactional-outbox.md) | Transactional Outbox Pattern | Accepted |
| [007](./007-jwt-authentication.md) | JWT for Stateless Authentication | Accepted |
| [008](./008-rbac.md) | Role-Based Access Control | Accepted |

## Format

Each ADR follows a consistent structure:
- **Status** — Accepted, Proposed, Deprecated, Superseded
- **Context** — Problem or forces driving the decision
- **Decision** — What was chosen
- **Consequences** — Positive and negative outcomes
- **Alternatives Considered** — Options evaluated and why they were rejected

## Adding New ADRs

Number sequentially (`009-*.md`). Update this index. Do not modify accepted ADRs — supersede them with a new record if the decision changes.
