# ADR-001: Layered architecture with feature modules

**Status:** Accepted  ·  **Date:** 2026-07-20

## Context

Organising by layer (all controllers in one folder, all services in another) scatters a single feature across five folders and does not scale past a handful of endpoints. Adding, reviewing, or deleting a feature becomes a multi-folder scavenger hunt.

## Decision

Organise by feature under `src/modules/`. Within each module keep the layer separation:

```
route → controller → service → repository
```

with dependencies pointing downward only. Cross-cutting code (error class, response helpers, query parsing, middleware) lives in `src/shared/`.

## Consequences

**Positive**
- A feature is added, reviewed, or deleted in one folder
- Services are testable and callable without an HTTP server (see `scripts/demo-service.js`)
- Layer boundaries become reviewable as a rule, not a matter of taste — see `npm run check:layers`

**Negative**
- More files per feature; slightly heavier for trivial endpoints
- Requires discipline: nothing structurally stops a controller importing a repository except code review and the layer-check script
