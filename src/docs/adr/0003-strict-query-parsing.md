# ADR-003: Strict query parsing — reject unknown filters and sorts

**Status:** Accepted  ·  **Date:** 2026-07-20

## Context

Clients pass arbitrary query strings. The API can either silently ignore unknown parameters (Express default) or reject them with a `400`.

## Decision

Every list endpoint declares its `filterable`, `sortable`, `selectable`, and `expandable` fields in a `<module>.queryschema.js`. The shared `queryParser` rejects any unknown parameter with **400** and returns the allowed list in `error.details`.

## Consequences

**Positive**
- Typos surface immediately (`?statuss=seeking` fails loudly instead of returning unfiltered data)
- Client-side bugs are found in seconds, not hours
- Documentation and enforcement live in the same file — the schema is executable

**Negative**
- New clients must know the exact parameter names; there is no "close enough" behaviour
- Adding a filter is a two-step change (schema + service handler)

Trade accepted — silent tolerance is worse than a good error message.
