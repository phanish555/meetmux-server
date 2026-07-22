# ADR-0007: Foreign-key `ON DELETE RESTRICT` by default

**Status:** Accepted  ·  **Date:** 2026-07-22

## Context

Every FK must answer: when the parent is deleted, what happens to the child? The default matters — CASCADE that shouldn't cascade can silently wipe years of records.

## Decision

**`RESTRICT` for anything a human would be upset to lose:**

- `jobs.company_id → companies` — deleting a company must not vaporise its job history
- `applications.student_id → students` — an application is a record of a real action
- `applications.job_id → jobs` — same

**`CASCADE` only for pure attachment/join rows:**

- `student_skills`, `job_skills` — a skill link is meaningless without its parent
- `application_events` — events belong to their application
- `interviews` — a scheduled round has no meaning without an application

## Consequences

- Accidental parent deletes are refused by the database, not by hopeful application code
- Combined with ADR-0005 (soft deletes), RESTRICT rarely fires in practice — it's a safety net against future code that forgets to soft-delete
- Deleting a company requires deliberately dealing with its jobs first (as it should)
