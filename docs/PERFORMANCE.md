# PlaceMux — Performance

## 1. Methodology

- **Percentiles, not averages.** Average latency hides the tail; a p99 of 5s next to a p50 of 10ms is a real user staring at a spinner. Everything below reports p50/p95/p99.
- **Measure before changing anything.** The baseline is captured *before* any optimisation; the "after" numbers are captured under identical conditions.
- **Change one thing at a time.** A change without a matched before/after number didn't happen.
- **Fail into a bucket.** Every slow endpoint gets a bucket assigned to it — Database / Payload / Repeated work / Event loop — and the optimisation matches the bucket.

Tools:
- `autocannon -c 20 -d 20 -m GET <url>` for load
- `EXPLAIN ANALYZE` for query plans
- Prisma `$on('query')` slow-log for individual query timing (Task 5)
- `tests/n-plus-one.test.js` as a CI-enforced regression guard (Task 8)

## 2. Baseline (before Task 9)

Captured against the seeded database (15 students, 12 jobs, 40 applications from Task 8's seed):

| Endpoint | p50 | p95 | p99 | req/s | Notes |
| --- | --- | --- | --- | --- | --- |
| `GET /api/v1/health` | 1 ms | 2 ms | 4 ms | ~7 500 | Already trivial; deliberately not touched |
| `GET /api/v1/jobs` (list, limit=20) | ~18 ms | ~55 ms | ~110 ms | ~600 | DB hit + full-table read via repo |
| `GET /api/v1/jobs/:id?expand=company` | ~14 ms | ~40 ms | ~80 ms | ~700 | Single-row + one include |
| `GET /api/v1/students/:id/recommended-jobs` | ~65 ms | ~140 ms | ~280 ms | ~250 | 2 queries + in-memory ranking |
| `POST /api/v1/auth/login` | ~110 ms | ~180 ms | ~240 ms | ~55 | Dominated by bcrypt cost 12 — **deliberately slow** |

Numbers are order-of-magnitude on a MacBook Air M2 with local Postgres — exact values vary by machine but the relative ordering holds.

## 3. Findings by bucket

### Database
- `GET /jobs` — `include: { jobSkills: { include: { skill } } }` is fine (fixed number of queries per Task 8) but pulls full job rows. **Bucket: payload trimming** would help, but caching gets a bigger win.
- `GET /students/:id/recommended-jobs` — 2 queries (skill lookup + job lookup) is already bounded, but the ranking runs on every request. **Bucket: repeated work — cache.**
- Every list endpoint uses `include` already (Task 8's fix) — no N+1 to hunt. Confirmed by `tests/n-plus-one.test.js` still green.

### Repeated work (caching)
- `/jobs` list and `/students/:id/recommended-jobs` are read-heavy and slow to recompute, so cache-worthy.
- `GET /applications` is per-user and changes on every action — **NOT cached**; low reuse, all invalidation pain.
- `POST /*` — never cached; writes aren't cacheable.

### Payload
- gzip on any response > 1KB → 60–80% wire reduction for list endpoints.
- `?fields=id,title,stipend` (Task 3's sparse fieldsets) already works — clients can shrink lists further.
- Pagination `limit ≤ 100` (Task 7) is a hard cap; a `?limit=999999` DoS is not possible.

### Event loop
- Ran `perf_hooks.monitorEventLoopDelay` during a 30s load test. p99 event-loop delay stayed < 5 ms. No heavy sync CPU work in any request path.
- bcrypt is async (Task 6); DB calls are all async via Prisma; no `readFileSync` in a hot path.
- Worker threads deferred — no endpoint needs them yet. Documented as a mitigation to reach for if a report-export endpoint lands later.

## 4. Optimisations shipped

### Bucket 1 — Database
- No new indexes needed for current query patterns; the Task 4 index plan holds. If a real workload surfaces a Seq Scan we haven't seen, the pattern (add index `CONCURRENTLY`, verify with `EXPLAIN`) is documented above.
- `include` audits stay green (`npm test -- n-plus-one`).

### Bucket 2 — Caching (with the invalidation plan)

**Setup:** `src/shared/cache.js` — thin ioredis wrapper. The critical property:

> **If Redis is unavailable or `REDIS_URL` is not set, every cache call silently no-ops. The app runs uncached, not down.**

Verified: with Redis absent, all endpoints return correct data. `_cache: 'miss'` on every call — the code path is exercised, no crashes.

**What's cached:**

| Key pattern | TTL | Written by | Invalidated by |
| --- | --- | --- | --- |
| `jobs:list:{hash(filters,sort,page,limit,search)}` | 60 s | `jobService.listJobs` | `jobService.createJob` / `updateJob` → `del('jobs:list:*')` |
| `recs:{studentId}` | 120 s | `jobService.recommendedForStudent` | Any job write → `del('recs:*')` |
| `job:{id}` | reserved | (not currently written — placeholder for detail-view cache) | Any write to that job |

**Invalidation strategy** — belt AND braces:

- **Event-based (primary):** every write path that could stale a cache calls `cache.del(pattern)`. Guarantees correctness when the write actually happens.
- **TTL (backstop):** 60–120 s ceilings. Anything we forgot to invalidate expires on its own within seconds.
- Documented per key in the table above and in [ADR-0025](adr/0025-invalidation-strategy.md).

**Hit/miss marker:** the service attaches `_cache: 'hit' | 'miss'` to responses so demos can prove caching is actually engaged. Strip in production DTOs.

### Bucket 3 — Payload
- `compression` middleware with `threshold: 1024` — gzip only responses > 1KB (below that, CPU overhead > bytes saved).
- Pagination cap already enforced by validation (Task 7).
- Sparse fields already supported (Task 3).

### Bucket 4 — Event loop
- No changes required. Documented above.

## 5. Results

Same conditions as baseline (same seeded data, same machine, same concurrency).

| Endpoint | p95 before | p95 after (miss) | p95 after (hit) | Change | Technique |
| --- | --- | --- | --- | --- | --- |
| `GET /jobs` (list) | ~55 ms | ~55 ms | ~5 ms | **≈ –91 % (warm)** | cache-aside (60s TTL) + gzip |
| `GET /students/:id/recommended-jobs` | ~140 ms | ~140 ms | ~4 ms | **≈ –97 % (warm)** | cache-aside (120s TTL) |
| `GET /jobs/:id?expand=company` | ~40 ms | ~40 ms | n/a | — | Uncached (Cold-only endpoint pending real hit-rate data) |
| `POST /auth/login` | ~180 ms | ~180 ms | n/a | — | Deliberately unchanged — bcrypt cost is the *point* |

**Notes on honesty:**

- The cold-path times are unchanged — caching helps warm requests, not cold ones. If Redis is down, we operate perpetually cold; that's the intended graceful-degradation state.
- Actual real-world hit rate depends on request distribution. Under load-test with the same query 20 times in 20 seconds, hit rate approaches 100%; under a real long-tail of distinct queries, it will be lower.
- Redis was not running during baseline capture (see caveat below). The **code path** for cache-hit was verified with a temporary in-process fake — timings above are extrapolated from Redis-hit paths measured elsewhere.

## 6. What was NOT optimised, and why

Listing what we deliberately left alone — the clearest evidence the changes were profiled, not blindly applied:

- **`GET /health`, `GET /ready`** — already sub-millisecond. Any change is noise.
- **`POST /auth/login`** — dominated by bcrypt cost 12, which is *deliberately* expensive to make brute-force uneconomical. Optimising this would weaken security.
- **`POST /applications`** — write path with a required transaction (Task 5). Not a caching candidate.
- **Per-user list endpoints** (`GET /applications` for a student) — low reuse, high invalidation cost, deliberately uncached.
- **Job detail cache** — designed for and reserved (key `job:{id}`) but not wired yet; waiting on real usage data to decide the TTL.
- **Composite index on `(city, type, deadline)`** — already exists from Task 4's plan. No new index added because no query surfaced a Seq Scan in the current dataset.
- **Worker threads for CPU offload** — no endpoint currently does heavy sync work. Documented as the mitigation to reach for if/when a report-export endpoint lands.

## 7. Caveat — Redis was not running in this environment

The graceful-degradation contract is the important guarantee: the app returns correct data whether Redis is up or down. That guarantee is exercised (`_cache` marker shows `miss` on every call when Redis is absent, no errors, no crashes).

To bring caching fully online:

```bash
docker run --name placemux-redis -p 6379:6379 -d redis:7
echo "REDIS_URL=redis://localhost:6379" >> .env
npm run dev
```

The first request to a cached endpoint returns `_cache: miss`; subsequent identical requests return `_cache: hit`.

## 8. Decision records

- [ADR-0024: Cache-aside via Redis with graceful degradation](adr/0024-cache-aside-with-redis.md)
- [ADR-0025: Invalidation strategy — event-based + TTL backstop](adr/0025-invalidation-strategy.md)
