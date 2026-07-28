# ADR-0025: Cache invalidation — event-based + TTL backstop

**Status:** Accepted  ·  **Date:** 2026-07-28

## Context

There's an old joke that the two hardest problems in computing are cache invalidation and naming things. The pitfall the brief calls out is "caching without an invalidation plan" — a cache that never invalidates serves stale data forever, and a user who updates their profile and still sees the old version reads as a bug.

## Decision

**Both** invalidation strategies, together — belt AND braces:

- **Event-based (primary, correct):** every write path that could stale a cache calls `cache.del(pattern)` synchronously in the service. Guarantees the cache is empty *before* the request returns.
- **TTL (backstop, safety net):** every cache entry has a hard TTL (60–120 s currently). Anything a future write path forgets to invalidate expires on its own within seconds.

## Invalidation table

Documented in `docs/PERFORMANCE.md` §4, restated here as the canonical map:

| Key pattern | TTL | Invalidated by |
| --- | --- | --- |
| `jobs:list:*` | 60 s | `jobService.createJob`, `updateJob` |
| `recs:*` | 120 s | Any job write (recommendations can change) |
| `job:{id}` | reserved | (not currently written) |

## Where each strategy fits

- **Event-based**: use when staleness is user-visible and jarring (their own profile, their own data).
- **TTL alone**: acceptable when small staleness is fine and enumeration is hard (aggregate stats, popular-jobs lists).
- **Never rely on TTL alone** for correctness-sensitive data.

## Consequences

- **Positive**: correctness under normal operation (event-based) AND resilience to invalidation gaps (TTL).
- **Negative**: two mental models to keep in mind when adding a new cache key. Mitigated by the invalidation table — new keys MUST get a row before being merged.
- **Deferred**: no cache-key versioning yet (`v1:jobs:list:*`). Add if we ever need a hard cache flush across a deploy without waiting for TTL.
