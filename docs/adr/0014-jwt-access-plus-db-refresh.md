# ADR-0014: Short-lived JWT access + DB-backed refresh

**Status:** Accepted  ·  **Date:** 2026-07-24

## Context

| | Server sessions | Pure JWT | JWT + DB refresh |
| --- | --- | --- | --- |
| Stateless request path | ✗ | ✓ | ✓ |
| Instant revocation | ✓ | ✗ | ✓ (delete refresh row) |
| Horizontal scale | Needs shared session store | Trivial | Needs DB (already there) |

## Decision

**Access:** JWT, HS256, 15 minutes.
**Refresh:** opaque 48-byte random string, stored hashed in the DB, 7 days, rotated on every use.

## Consequences

- Common-path requests only need JWT verification — no DB hit for read-only endpoints beyond the user lookup (see ADR-0016)
- Refresh is a DB row, so we can revoke individual sessions instantly
- Access-token revocation is coarse: `users.password_changed_at` invalidates everything issued before that instant
- Two secrets (access + refresh) — startup fails if they're missing, too short, or identical
