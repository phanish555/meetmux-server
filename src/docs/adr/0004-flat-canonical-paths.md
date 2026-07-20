# ADR-004: Flat canonical paths with one-level nesting for reads

**Status:** Accepted  ·  **Date:** 2026-07-20

## Context

REST APIs often nest resources arbitrarily deep (`/companies/:c/jobs/:j/applications/:a/interviews/:i`). This looks organised but breaks when a resource has more than one parent — clients disagree about which URL is canonical, and every URL becomes a maintenance burden.

## Decision

Every resource has **one canonical, flat path** for writes: `/resource` and `/resource/:id`. Nested reads are allowed **one level deep only**, as a convenience for "give me the children of this parent":

- `GET /companies/:id/jobs` — allowed
- `GET /jobs/:id/applications` — allowed
- `POST /companies/:id/jobs` — **not** allowed; use `POST /jobs` with `companyId` in the body
- `GET /companies/:c/jobs/:j/applications` — **not** allowed; use `GET /jobs/:j/applications`

## Consequences

**Positive**
- One URL per resource for writes; no ambiguity
- Nested reads are still ergonomic for the common "parent → children" query
- Adding a new parent relationship doesn't fork every existing URL

**Negative**
- Slightly more verbose for the read cases where a client already has the parent context in the URL
- Requires a written rule (this ADR) — the pattern isn't self-documenting

## Enforcement

Route conventions R5 and R6 in `ARCHITECTURE.md`. Reviewed at PR time.
