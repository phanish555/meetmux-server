# ADR-0021: Placement as its own resource, not a status flag on Student

**Status:** Accepted  ·  **Date:** 2026-07-26

## Context

When a student accepts an offer, we need to record it. Two shapes:

1. Add a `placedAt` timestamp and a `placedJobId` FK on `Student`, plus more denormalised fields.
2. Give it a dedicated `Placement` table.

## Decision

**Its own table** (`placements`). A placement has a real lifecycle — snapshot fields at offer time, links to the specific application that produced it, its own timestamps — and treating it as a genuine resource keeps the model clean.

Enforced 1:1 with the student via `@unique` on `studentId`, and 1:1 with the application via `@unique` on `applicationId`. The DB itself refuses a double-placement.

## Consequences

- **Positive:** future features (offer letter PDFs, package negotiation history, placement analytics) attach cleanly to the Placement resource rather than bloating Student.
- **Positive:** the 1:1 constraint is DB-enforced, not application-level — a race in the accept-offer flow can't produce two placements.
- **Negative:** slightly more join work when querying "give me the placed student's package" — one join through `placements`.
- Student still carries a `status: PLACED` enum for fast filtering. The two are kept in sync inside the accept-offer transaction (Task 5's `acceptOffer`).
