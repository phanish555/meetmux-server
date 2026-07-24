# ADR-0010: Optional transaction client on every repository method

**Status:** Accepted  ·  **Date:** 2026-07-23

## Context

Services must compose multiple repository calls into one atomic transaction (e.g. accept an offer → withdraw sibling applications → mark student PLACED → decrement openings). Without a shared client parameter, every method would need a duplicate `-InTransaction` variant, or services would have to reach past the repository layer.

## Decision

Every repository method accepts an optional trailing `client` parameter that defaults to the shared Prisma singleton:

```js
findById: async (id, client = prisma) => { ... }
create:   async (data, client = prisma) => { ... }
update:   async (id, patch, client = prisma) => { ... }
```

A service starts a transaction via `runInTransaction(async (tx) => { ... })` (from `src/shared/transactions.js`), then passes `tx` down to any repository method it calls. Repositories neither know nor care whether they're inside a transaction — same code path either way.

## Consequences

- **Transactions are composable across modules** — accept-offer touches `application`, `student`, and `job` repos, all inside one commit-or-rollback
- **No API duplication** — one `update`, not `updateInTransaction`
- **The self-contained transactional writes** (creating an application + its first event) are wrapped inside the repository itself and start their own `$transaction` when no client is passed; services calling `repo.create(app)` still get atomicity
- Requires discipline: forgetting to pass `tx` means the sub-call runs *outside* the transaction and won't roll back. Caught by the rollback test.
