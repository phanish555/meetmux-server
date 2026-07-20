# ADR-002: Offset pagination for v1

**Status:** Accepted  ·  **Date:** 2026-07-20

## Context

List endpoints need paging. Offset is simple and supports page numbers and totals; cursor is stable under concurrent writes and performs better at scale.

## Options

1. **Offset** — simple, gives totals and jump-to-page, unstable under inserts
2. **Cursor** — stable and fast, no totals, no jump-to-page
3. **Both** — maximum flexibility, double the surface and double the bugs

## Decision

Offset for v1. The UI requires page numbers and a total count, and Phase 1 datasets are small (well under 1k rows per resource).

## Consequences

**Positive**
- Simple client integration; totals available
- Trivial to test and cache

**Negative**
- Rows may repeat or be skipped if data changes between page loads
- Will need revisiting past ~100k rows or under high write concurrency

**Mitigation:** `meta.pagination` is a nested object, so cursor fields (`nextCursor`, `prevCursor`) can be added alongside it without a breaking change. Migrating to cursor pagination later is additive.
