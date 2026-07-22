# ADR-0005: Soft deletes via `deleted_at`

**Status:** Accepted  ·  **Date:** 2026-07-22

## Context

Placement records (students, applications, jobs, companies) are business-critical history. A hard `DELETE` is irreversible and defeats audit; but keeping deleted rows in every query is slow and clutters results.

## Decision

Add a nullable `deleted_at TIMESTAMPTZ` to `students`, `jobs`, and `companies`. "Delete" sets this column; every read filters `WHERE deleted_at IS NULL`.

Pure attachment/join tables (`student_skills`, `job_skills`, `application_events`, `interviews`) are hard-deleted via `ON DELETE CASCADE` from their parents — they have no independent meaning.

## Consequences

- **Positive:** deleted data is recoverable; audit trails hold; foreign keys remain valid
- **Negative:** every query must filter `deleted_at IS NULL` — enforced in the repository layer, not in services
- Partial indexes (`WHERE deleted_at IS NULL`) keep hot-path indexes small
- Case-insensitive email uniqueness is a *partial* unique index rather than a plain UNIQUE, so re-registration after a soft delete works
