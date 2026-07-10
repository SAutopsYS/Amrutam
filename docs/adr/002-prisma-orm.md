# ADR-002: Prisma as ORM

## Status
Accepted

## Context
We need type-safe database access, schema migrations, and developer productivity. The schema has 39 models across multiple domains with relationships, indexes, and optimistic locking columns.

## Decision
Use **Prisma ORM** with PostgreSQL as the database provider.

## Consequences

**Positive:**
- Generated TypeScript types from schema — compile-time safety
- Declarative schema in `schema.prisma` serves as documentation
- Built-in migration tooling (`prisma migrate`)
- `$transaction` API for booking atomicity
- Active community and NestJS integration patterns

**Negative:**
- Complex raw SQL queries are less ergonomic than query builders
- Schema changes require migration discipline in production
- N+1 query risk requires explicit `include`/`select` awareness

## Alternatives Considered
- **TypeORM** — rejected; decorator-heavy, migration reliability concerns
- **Knex + raw SQL** — rejected; no generated types, more boilerplate
- **Drizzle ORM** — viable alternative; Prisma chosen for maturity and team familiarity
