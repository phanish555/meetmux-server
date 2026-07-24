# ADR-0012: Concurrency strategy — atomic ops + constraints, not locks

**Status:** Accepted  ·  **Date:** 2026-07-23

## Context

Concurrent writes to the same row (two recruiters offering the same seat, a user double-clicking Apply) can lose updates or over-allocate. Three defences: pessimistic locks (`SELECT FOR UPDATE`), optimistic locks (version column), or database-side atomic operations paired with constraints.

## Decision

For Phase 1, prefer **atomic database operations + declarative constraints** over locks:

- `openings` decremented via `{ decrement: 1 }` (a single UPDATE — no read-modify-write race) + `CHECK (openings > 0)` — over-allocation is refused by the DB
- Duplicate applications refused by composite `UNIQUE(student_id, job_id)` — two concurrent inserts, exactly one wins
- Idempotency-Key replay via `UNIQUE(idempotency_key)` — same logic

**Not adopted yet, but planned:**

- **Optimistic version column** — would add `version INT` to `Student` and use `UPDATE ... WHERE id = ? AND version = ?` for update-in-place with conflict detection. Deferred until a hot mutable entity actually surfaces a lost-update bug.
- **`SELECT FOR UPDATE`** — for the accept-offer flow, we currently rely on the `status = 'OFFERED'` guard inside a transaction. A row lock would tighten the check-then-act window, but the workload is low-contention and the guard is sufficient today.

## Consequences

- **Correct under concurrency, verified in tests** — `tests/concurrency.test.js` fires 5 simultaneous applications and 5 simultaneous decrements; the database refuses over-allocation in both cases
- **No application-level locking code to maintain** — the guarantee lives in the schema
- If a future hot row (say, a leaderboard counter) does start seeing lost updates, add an optimistic version column at that point — not now, when it's premature and adds noise to every update

## References

- Uses invariants INV-3 (composite unique on applications) and INV-6 (job.deadline in future) from Task 3
- Backed by the CHECK constraints introduced in the Task 4 migration
