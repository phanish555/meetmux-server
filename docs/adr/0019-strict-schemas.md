# ADR-0019: `.strict()` schemas everywhere — mass-assignment defence

**Status:** Accepted  ·  **Date:** 2026-07-25

## Context

Without `.strict()`, Zod silently ignores unknown keys. Any downstream code path that does `prisma.user.create({ data: req.body })` then happily persists whatever the client sent — including `role: 'ADMIN'` or `emailVerified: true`. This is textbook **mass assignment**.

## Decision

Every object schema in `src/**/*.schema.js` uses `.strict()`. Unknown keys → `UNKNOWN_FIELD` at the validation layer, before any business logic runs.

For endpoints that legitimately need to accept extra keys (analytics params, tracking tokens), use `.passthrough()` explicitly and document why in the schema file. Currently the only such case is `POST /applications` accepting arbitrary `headers` (Express hands us the full set).

## Consequences

- **Positive:** privileged fields can't sneak in through a body payload. Verified by `tests/validation.test.js` — sending `role: 'ADMIN'` in a signup body returns 422.
- **Positive:** typos in client requests surface immediately as `UNKNOWN_FIELD` rather than being silently ignored.
- **Negative:** legitimate extra client params (analytics, tracking) will be rejected. Fixable per-endpoint with `.passthrough()`, but each exception must be justified — silent tolerance is worse than an error.
