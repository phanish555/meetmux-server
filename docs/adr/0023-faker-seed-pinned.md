# ADR-0023: Deterministic seed via `faker.seed(42)`

**Status:** Accepted  ·  **Date:** 2026-07-26

## Context

The Task 8 seed uses `@faker-js/faker` to generate realistic volume and variety. Without a pinned RNG seed, every run produces different data — tests that passed yesterday might fail today for reasons unrelated to code.

## Decision

Call `faker.seed(42)` once at the top of `prisma/seed-src/helpers.js`. Every run produces the same student names, cities, dates, application distributions, and skill assignments.

## Consequences

- **Positive:** demos are reproducible — the seed summary reads the same numbers every time.
- **Positive:** if a bug appears after a `db:reset`, someone else running the seed hits exactly the same bug.
- **Positive:** tests can rely on specific seeded records (e.g. "the placed student") without brittle setup.
- **Negative:** the seed loses one aspect of real-world variety (no true randomness across runs). Acceptable — the deliberate edge-case shapes (0-app students, empty companies, power applicant, placed student) provide the variety that matters.
