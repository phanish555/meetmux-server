# ADR-0011: Connection pool sizing

**Status:** Accepted  ·  **Date:** 2026-07-23

## Context

More connections is not faster past a point — throughput actually drops as context-switching and lock contention rise. Meanwhile Postgres's `max_connections` (default 100) is a hard ceiling that every app instance shares with `psql`, monitoring, and admin tools.

## Decision

Default `DB_POOL_SIZE=10`, matching the heuristic `(CPU cores × 2) + spindles` for a 4-core SSD dev box. Configurable via `.env` so production can tune per environment.

Additional pool params, all configurable:

| Var | Default | Purpose |
| --- | --- | --- |
| `DB_POOL_SIZE` | 10 | Max connections in the pool |
| `DB_POOL_TIMEOUT` | 20 s | How long to wait for a free connection before erroring |
| `DB_CONNECT_TIMEOUT` | 10 s | How long to wait for the initial connect |
| `DB_SLOW_QUERY_MS` | 100 ms | Log a warning above this |

The budget rule for production:

```
instances × pool_size  <  max_connections − reserve_for_admin_tools
```

Four instances at 15 = 60 comfortably fits under 100 and leaves room for `psql`.

## Consequences

- Predictable memory + connection usage under load
- Under overload, requests queue for `pool_timeout` seconds and then get a clean 500 rather than hanging forever
- Slow-query logging catches N+1s and missing indexes early
- The test database uses a smaller pool (`DB_POOL_SIZE=5` in `.env.test`) since tests are single-connection dominated
