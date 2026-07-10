# ADR-004: Redis for Cache and Queues

## Status
Accepted

## Context
The platform needs sub-millisecond cache for doctor search and dashboard metrics, plus a reliable backing store for job queues. Session data and rate limiting counters also benefit from in-memory storage.

## Decision
Use **Redis 7** for caching, BullMQ job queues, rate limiting, and distributed lock keys (cache stampede protection).

## Consequences

**Positive:**
- Single technology for cache + queue backing store
- BullMQ built on Redis — mature retry, backoff, and DLQ patterns
- Stampede protection via Redis lock keys in `CacheService`
- Health checks verify Redis connectivity at readiness probe

**Negative:**
- Redis is not the source of truth — cache invalidation must be deliberate
- Queue data loss possible if persistence not configured (mitigated by outbox in PostgreSQL)
- Additional operational component to monitor and backup

## Alternatives Considered
- **Memcached** — rejected; no queue support, no persistence options
- **Separate message broker (RabbitMQ, SQS)** — viable at scale; Redis chosen for simplicity at current stage
- **In-memory cache only** — rejected; doesn't survive restarts or scale horizontally
