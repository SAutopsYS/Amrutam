# Contributing to Amrutam Backend

Thank you for your interest in contributing. This guide reflects how we actually work on this codebase.

---

## Before You Start

1. Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) — understand module boundaries
2. Read [REVIEWER_GUIDE.md](docs/REVIEWER_GUIDE.md) — conventions and patterns
3. Run `npm run setup` — local environment

---

## Development Workflow

```bash
git checkout -b feature/your-feature
npm run setup
npm run start:dev
npm test
npm run test:integration   # requires Postgres + Redis
npm run lint
npm run build
```

Before opening a PR:

```bash
npm run ci:local    # mirrors GitHub Actions
```

---

## Code Conventions

### Module Structure

New feature modules follow Clean Architecture:

```
src/modules/your-module/
├── presentation/          # Controllers only — no business logic
├── application/
│   ├── services/          # Use cases
│   └── dto/               # class-validator DTOs
├── infrastructure/
│   └── persistence/       # Prisma repositories
└── domain/
    └── enums/             # State machines, invariants
```

Reference implementation: `src/modules/bookings/`

### Rules

| Rule | Rationale |
|------|-----------|
| Controllers stay thin | Business logic in application services |
| Repositories own Prisma | Services never call `prisma` directly |
| Use `DomainException` | Consistent error codes via `ErrorCode` enum |
| Audit sensitive actions | Call `AuditService.log()` |
| Side effects via outbox | Never HTTP-call providers inside DB transactions |
| `@Public()` for open routes | Global `JwtAuthGuard` is default |
| Update Swagger | `@ApiOperation`, examples, `ApiStandardErrorResponses()` |

### Naming

- Services: `CreateBookingService`, `DoctorSearchService` (verb + noun)
- Repositories: `SlotRepository`, `AppointmentRepository`
- DTOs: `CreateAppointmentDto`, `SearchDoctorsQueryDto`
- Events: constants in `OUTBOX_EVENTS` (`common/constants/index.ts`)

---

## Database Changes

```bash
# Create migration after schema change
npx prisma migrate dev --name describe_change

# Never edit applied migrations
# Never use prisma migrate dev against production
```

Add indexes for new query patterns. Document in `docs/performance/QUERY_OPTIMIZATION.md` if significant.

---

## Testing

| Type | When required |
|------|---------------|
| Unit | New business logic in services |
| Integration | New HTTP endpoints |
| Load | Performance-sensitive paths |

Place tests in:
- `test/unit/*.spec.ts`
- `test/integration/*.integration.spec.ts`

Run integration tests with Postgres + Redis running (or let CI handle it).

---

## Pull Request Checklist

- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Swagger updated for new/changed endpoints
- [ ] No secrets in code or commits
- [ ] ADR added if architectural decision changes
- [ ] README/docs updated if behavior changes

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(bookings): add reschedule validation for past appointments
fix(auth): reject refresh token after rotation
docs: update reviewer guide with doctors module
test(integration): add booking flow integration test
```

Commitlint is configured via `commitlint.config.js`.

---

## What Not to Do

- Do not call external HTTP APIs inside `$transaction` blocks
- Do not bypass repositories with direct Prisma in services
- Do not log PHI (use `sanitizeForLog()`)
- Do not add business logic to controllers
- Do not create cross-module service imports for side effects — use outbox events
- Do not lower coverage thresholds without justification

---

## Questions?

See [INTERVIEW_PREP.md](docs/INTERVIEW_PREP.md) for architecture rationale or open a discussion in your PR.
