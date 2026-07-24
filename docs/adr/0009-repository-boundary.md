# ADR-0009: Only `*.repository.js` may import Prisma

**Status:** Accepted  ·  **Date:** 2026-07-23

## Context

Task 4 introduced Prisma. Without a rule, `prisma` imports would spread across services, controllers, and even middleware. That defeats the whole "one swap point" story — every consumer becomes coupled to the ORM.

## Decision

Only files matching `*.repository.js` may import `@prisma/client` or `src/shared/prisma`. Enforced by:

```bash
npm run check:prisma-boundary
```

which runs `grep -rl '@prisma/client\|shared/prisma' src/modules | grep -v '.repository.js'` and exits non-zero on any hit.

### Legitimate exceptions

- **Transaction composition** — a service coordinating a multi-repository transaction needs *something* like `prisma.$transaction`. This is provided by `src/shared/transactions.js#runInTransaction(fn)`, which never exposes the raw client to the caller. That helper lives in `shared/`, not in a module, so the boundary check passes.
- **Health probe** — the `/ready` endpoint runs `SELECT 1`. Encapsulated in `src/modules/health/health.repository.js` so the rule holds.

## Consequences

- Swapping the data layer again (say, to a different ORM) touches only the `*.db.repository.js` files
- Services stay testable without spinning up a full Prisma client
- The rule is grep-checkable and runs in CI
- Small overhead: some things that would be one line (a `SELECT 1`) become a two-line repo module
