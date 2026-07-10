# ADR-006: Transactional Outbox Pattern

## Status
Accepted

## Context
After a successful booking, the system must send notifications and update analytics. Publishing directly to a message broker inside a database transaction creates a dual-write problem: either the DB commit fails after publish, or publish fails after commit — losing side effects or creating inconsistency.

## Decision
Implement the **Transactional Outbox Pattern**:
1. Application services write domain events to an `outbox_events` table in the **same PostgreSQL transaction** as business data
2. `OutboxPollerService` polls unpublished events every 5 seconds
3. Poller enqueues BullMQ jobs and marks events as `PUBLISHED`
4. Failed jobs retry up to 5 times, then land in `dead_letter_events`

## Consequences

**Positive:**
- Atomicity: if booking commits, the event is guaranteed to exist
- At-least-once delivery with idempotent consumers
- Unpublished events are queryable for monitoring and alerting
- Natural inter-service contract when modules are extracted to microservices

**Negative:**
- Side effects are eventually consistent (~5 second delay)
- Poller adds background load on PostgreSQL
- Requires idempotent notification handlers to handle duplicate delivery

## Alternatives Considered
- **Two-phase commit across DB + broker** — rejected; operational complexity, few brokers support it well
- **Change Data Capture (Debezium)** — viable at scale; outbox is simpler for MVP and testable locally
- **Synchronous notification in request path** — rejected; provider latency and failures would block booking response
