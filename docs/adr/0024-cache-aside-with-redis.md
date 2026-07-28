# ADR-0024: Cache-aside via Redis, with graceful degradation

**Status:** Accepted  ·  **Date:** 2026-07-28

## Context

Read-heavy, slow-changing, expensive endpoints (`GET /jobs`, `GET /students/:id/recommended-jobs`) benefit from caching. The choice is (a) an in-process `Map`, (b) Redis, or (c) a fancier setup with an in-process L1 in front of Redis.

## Decision

**Cache-aside via Redis.** Reasons:

- In-process caches break the moment we run more than one instance (instance A's cache doesn't know instance B updated). Redis is shared.
- Cache-aside (check cache → miss → load → store) keeps the write path untouched — no cache-through complexity.
- Redis is also needed for the Socket.io adapter (Task 10) and for cross-instance rate limits later. One dependency, three uses.

## The graceful-degradation guarantee

**Every cache call is wrapped so a Redis outage means "slower", not "down".** If `REDIS_URL` is unset the client is never even constructed. If Redis errors out later, `redis.on('error')` marks the client as not-ready and every `get`/`set`/`del` becomes a no-op.

The service code path is unchanged in both cases — a miss simply always happens, and the query runs against Postgres. **Verified in this repo**: the whole test suite passes with Redis absent.

## Consequences

- Correct behaviour whether Redis is up or down. Cache is an optimisation, never a dependency.
- Slight cache-key discipline needed — keys are content-addressed via `hashObject({ filters, sort, page, limit, search })` so different inputs produce different keys.
- Every cached response carries `_cache: 'hit' | 'miss'` for observability (stripped from public DTOs in a future task).
