# PlaceMux — Persistence Layer

## 1. Boundary

**Only `*.repository.js` files may import Prisma.** Everything else — services, controllers, routes, middleware — reaches the database through a repository. Enforced mechanically by:

```bash
npm run check:prisma-boundary
```

Which fails if `grep -rl '@prisma/client\|shared/prisma' src/modules` returns any non-`.repository.js` file. The one legitimate exception is **transaction composition** across repositories — services get that via `src/shared/transactions.js`'s `runInTransaction(fn)` helper, which never exposes the underlying client to the caller.

## 2. Repository contract

Every repository method obeys these rules:

1. **Optional `client` parameter (default: the shared prisma singleton).** Lets a service pass a `tx` client into any method and compose transactions across repositories without touching the client itself.
2. **Repositories return domain objects, not raw rows.** Mapping happens at the boundary (see each `*.db.repository.js`'s `toDomain(row)`): `Decimal → Number`, enum `SEEKING → 'seeking'`, join tables `jobSkills → skills: []`, `stipendPaise → stipend rupees`, `Date → ISO string`.
3. **Repositories don't throw `ApiError`.** Missing → return `null`; empty → return `[]`. Deciding that "missing means 404" is a business decision and belongs in the service.
4. **No `req`, no `res`, no HTTP status codes.** Enforced by `npm run check:layers`.

### Example — `student.db.repository.js` signature

```js
findAll(client = prisma)
findById(id, client = prisma)
findByEmail(email, client = prisma)
create(student, client = prisma)
update(id, patch, client = prisma)
softDelete(id, client = prisma)
```

A service calls `repo.update(id, patch)` normally, or `repo.update(id, patch, tx)` inside a transaction — same interface, either mode.

## 3. Injection safety

- **Every standard Prisma call is parameterised.** `prisma.student.findMany({ where: { email } })` sends the query text and the value over the wire separately; the value can never become SQL.
- **Tagged-template raw queries stay safe.** `prisma.$queryRaw\`SELECT ... WHERE email = ${email}\`` becomes a parameterised query too — the `${}` is intercepted, not concatenated.
- **`$queryRawUnsafe` / `$executeRawUnsafe` are banned.** They accept plain strings and would open the injection door back up. Grep the repo — zero occurrences.
- **Identifiers (sort columns, table names) use an allow-list**, not parameterisation (SQL parameters are for values only). Task 3's `<module>.queryschema.js` files hold the allow-list; the shared query parser rejects anything else with a 400.

### Proof

- `npm run db:injection` — hits `findByEmail` with 6 hostile payloads; 0 rows returned each time; row count unchanged; `students` table still there.
- `tests/injection.test.js` — same 6 payloads, asserted inert including "table still exists" and "the real record with that email still has cgpa 8.5".

## 4. Transactions

Every multi-step write is atomic.

| Operation | Writes | Where |
| --- | --- | --- |
| Create application | `applications` + `application_events` | `application.db.repository.js#create` (self-contained transaction) |
| PATCH `/applications/:id/status` | `applications` + `application_events` | `application.db.repository.js#update` (self-contained transaction) |
| Accept offer (multi-table) | `applications` (accepted) + N × `applications` (withdrawn) + N × `application_events` + `students` + `jobs.openings` | `application.service.js#acceptOffer` via `runInTransaction` — coordinates repo calls across `application`, `student`, `job` |

### Rules

- **Short.** Every open transaction holds locks and a connection.
- **No external calls inside.** A slow HTTP call holds a DB lock for its whole duration.
- **Explicit timeout.** `runInTransaction` sets `{ timeout: 10000, isolationLevel: 'ReadCommitted' }` by default.
- **Throw to roll back.** Never catch-and-swallow inside a `$transaction` callback — catching means "handled", so it commits.
- **Isolation:** `ReadCommitted` by default (Postgres default). `Serializable` only if a check-then-act must be exact, and even then a row lock or database constraint is usually simpler.

### Rollback proof

`tests/transaction.test.js`:

- Insert an application inside `$transaction`, then intentionally violate the enum on the next insert. **The first insert is discarded.** Row counts unchanged.
- `acceptOffer` end-to-end: 1 accepted, 2 siblings withdrawn, student marked `PLACED`, `openings` decremented — verified in a single test after one call.

## 5. Concurrency

| Technique | Where used | Why |
| --- | --- | --- |
| DB-side atomic increment/decrement | `job.decrementOpenings` | No read-modify-write race; combined with `CHECK (openings > 0)`, over-allocation is structurally impossible |
| Composite UNIQUE `(student_id, job_id)` | applications | Two simultaneous applies for the same job — exactly 1 succeeds, the other 4 rejected by the DB |
| Idempotency-key UNIQUE (Task 2) | applications | Client double-clicks Apply → same key returned as 200, no duplicate |
| ~~Optimistic version column~~ | Not yet | Would add for high-contention entities; deferred until measured to matter |
| ~~SELECT FOR UPDATE~~ | Not yet | Same; unnecessary for current workload because atomic operations + constraints cover the case |

### Concurrency proofs

`tests/concurrency.test.js`:

- **5 simultaneous identical applications → exactly 1 succeeds**, the other 4 rejected with `P2002`.
- **5 concurrent decrements on `openings: 3` → openings ends at 1**, 2 succeed, 3 rejected by `chk_jobs_openings_positive`. The database refuses to over-allocate, regardless of the application code.

## 6. Connection pooling

Configured via query params on `DATABASE_URL`, then applied by `src/shared/prisma.js`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DB_POOL_SIZE` | 10 | Max connections in the pool |
| `DB_POOL_TIMEOUT` | 20 | Seconds to wait for a free connection before erroring |
| `DB_CONNECT_TIMEOUT` | 10 | Seconds to wait for the initial TCP connect |
| `DB_SLOW_QUERY_MS` | 100 | Log a warning for any query slower than this |

### Sizing

Start from `(CPU cores × 2) + spindles` — around **9–10** for a 4-core dev box on SSD. Then:

```
total_across_instances × per-instance-pool-size  <  max_connections − reserve
```

Postgres's default `max_connections` is 100. Four app instances at 25 each is exactly 100 and your next `psql` login fails. Four at 15 leaves comfortable headroom.

### Single client

Exactly one `PrismaClient` in the process, exported by `src/shared/prisma.js`. Creating clients inside handlers or loops exhausts `max_connections` within minutes — a classic outage.

### Graceful shutdown

`src/server.js` handles `SIGINT`/`SIGTERM` in this order:

1. `server.close(...)` — stop accepting new HTTP requests, let in-flight ones finish
2. `prisma.$disconnect()` — release the pool
3. `process.exit(0)`

Closing the pool before the server means in-flight requests fail at the last moment. The order matters.

### Observing the pool

```sql
SELECT state, count(*) FROM pg_stat_activity
WHERE datname = 'placemux' GROUP BY state;

SELECT pid, state, now() - query_start AS duration, left(query, 60)
FROM pg_stat_activity
WHERE datname = 'placemux' AND state <> 'idle'
ORDER BY duration DESC;
```

Under load (`npx autocannon -c 50 -d 10 http://localhost:3000/api/v1/students`) the connection count rises to `DB_POOL_SIZE` and **stops there** rather than climbing forever.

## 7. Error translation

`src/shared/dbErrorTranslator.js` — one place, called from the central error handler above the generic branch.

| Prisma / Postgres code | Client sees |
| --- | --- |
| `P2002` (UNIQUE violation) | 409 `RESOURCE_CONFLICT` — "A record with this email address already exists" |
| `P2003` (FK violation) | 400 `BAD_REQUEST` — "Referenced record does not exist" |
| `P2025` (record not found) | 404 `RESOURCE_NOT_FOUND` |
| `P2000` (value too long) | 422 `VALIDATION_FAILED` |
| `P2034` (write conflict) | 409 `WRITE_CONFLICT` — retry hint |
| `PrismaClientValidationError` | 400 `BAD_REQUEST` — "Malformed database query" |
| `PrismaClientInitializationError` | 503 `SERVICE_UNAVAILABLE` |
| Raw Postgres `23514` (CHECK violation) | 422 `VALIDATION_FAILED` |
| Anything else | 500 `INTERNAL_SERVER_ERROR` (message hidden) |

Two rules:

- **No raw Prisma error text ever reaches a client.** Messages contain table names, column names, and sometimes the offending values.
- **Translate at one place.** Every service catching Prisma errors individually gives three different messages for the same violation — the Task 3 "inconsistent error conventions" pitfall creeping back in.

Verified by `tests/api.test.js`: the 409 response message contains no `prisma`/`p2002`/`constraint`/`violate` text.

## 8. Query efficiency

- **N+1 policy:** always `include` at read time; never loop calling the DB per item.
- **Query counter middleware** (`src/shared/middleware/queryCounter.js`) — subscribes to Prisma's `query` event, counts per request, warns above 10.
- Runs in development only (needs `emit: 'event'` log entries).

## 9. Testing

- Separate DB: **`placemux_test`**. `npm test` loads `.env.test` via `dotenv-cli` and runs `prisma migrate deploy` once, then Jest with `--runInBand` so files don't fight over the same rows.
- Each test file truncates children-before-parents in `beforeEach` (`tests/helpers.js#truncateAll`).
- `afterAll(() => prisma.$disconnect())` in every file so Jest exits cleanly.

### Coverage matrix

| Scenario | Suite | Expected |
| --- | --- | --- |
| Create → read → update → soft-delete | `student.repository.test.js` | passes |
| findByEmail case-insensitive | `student.repository.test.js` | passes |
| Duplicate email | `student.failures.test.js` | P2002 |
| CGPA out of range | `student.failures.test.js` | CHECK 23514 |
| Malformed email | `student.failures.test.js` | CHECK 23514 |
| Update missing record | `student.failures.test.js` | P2025 |
| Invalid FK (application → nonexistent job) | `student.failures.test.js` | P2003 |
| 6 SQL injection payloads | `injection.test.js` | 0 rows each, no mutation, table intact |
| Rollback on mid-transaction failure | `transaction.test.js` | zero rows written |
| Accept offer cascade | `transaction.test.js` | siblings withdrawn, student PLACED, openings decremented |
| 5 concurrent identical applications | `concurrency.test.js` | exactly 1 succeeds |
| 5 concurrent decrements | `concurrency.test.js` | openings never goes below 1 |
| API 201 with DTO stripping | `api.test.js` | no `deletedAt`/`idempotencyKey` in response |
| API 409 without Prisma leak | `api.test.js` | message contains no prisma/constraint/violate text |
| API unknown filter (Task 3 strictness) | `api.test.js` | 400 BAD_REQUEST |

**Current status:** 21/21 tests pass across 6 suites.

## 10. Decision records

- [ADR-0009: Repository boundary — only repositories touch Prisma](adr/0009-repository-boundary.md)
- [ADR-0010: Optional transaction client on every repository method](adr/0010-transaction-client-injection.md)
- [ADR-0011: Connection pool sizing](adr/0011-pool-sizing.md)
- [ADR-0012: Optimistic vs pessimistic locking](adr/0012-optimistic-vs-pessimistic-locking.md)
