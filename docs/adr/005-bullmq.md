# ADR-005: BullMQ for Async Job Processing

## Status
Accepted

## Context
Side effects (notifications, analytics cache invalidation) must not run inside database transactions. We need reliable job delivery with retries, backoff, and visibility into queue depth for operations.

## Decision
Use **BullMQ** backed by Redis for all async job processing. Jobs are enqueued by the `OutboxPollerService` after reading committed outbox events. Workers run in-process within the same NestJS application (suitable for modular monolith; extractable to dedicated workers later).

## Consequences

**Positive:**
- Battle-tested retry semantics with exponential backoff and jitter
- Job correlation IDs propagate from HTTP request to worker logs
- Failed jobs move to a dead-letter table after max retries
- Prometheus metrics expose queue depth and failure rates

**Negative:**
- In-process workers scale with API pods — may need dedicated worker deployment at high volume
- Redis becomes a critical dependency for async delivery
- At-least-once delivery requires idempotent job handlers

## Alternatives Considered
- **NestJS @nestjs/bull** — BullMQ is the maintained successor with better TypeScript support
- **AWS SQS** — rejected for local development friction and cloud lock-in at MVP stage
- **Direct setInterval polling without queues** — rejected; no retry/backoff/DLQ semantics
