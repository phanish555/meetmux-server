# ADR-0008: Append-only `application_events` table

**Status:** Accepted  ·  **Date:** 2026-07-22

## Context

`applications.status` answers "where is this candidate now?" It does **not** answer "who moved them from under-review to rejected, and when?" Once the column is overwritten, the history is gone.

## Decision

Every status transition writes a row to `application_events (application_id, from_status, to_status, note, created_at)`. The write happens in the **same transaction** as the status update, so either both persist or neither does. The table is append-only — no updates, no deletes (join rows cascade if the application itself is deleted).

## Consequences

- **Positive:** full audit trail for every application; "when did status change to X?" is a cheap query
- **Positive:** the transactional pair (update + event) means we never see a status in the current column that has no corresponding event
- **Negative:** more writes per status change; more storage per application over time
- **Future:** `actor_id` should be added when auth lands, so we can answer "who moved this?"
- Precedent for other domain events later (e.g. `job_events`, `student_events`)
