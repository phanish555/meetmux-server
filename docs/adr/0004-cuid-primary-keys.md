# ADR-0004: cuid primary keys

**Status:** Accepted  ·  **Date:** 2026-07-22

## Context

Every table needs a PK. Three real options: `SERIAL`, `UUID v4`, `cuid`/`ULID`.

## Options

| Option | Pros | Cons |
| --- | --- | --- |
| `SERIAL` (1, 2, 3, …) | Small (4/8B), fast, human-readable | Leaks row-count volume, guessable in URLs, painful to merge across DBs |
| `UUID v4` | Globally unique, unguessable | 16B, random order → poor index locality on inserts |
| `cuid` / `ULID` | Unguessable **and** monotonic by creation | Slightly larger than integer, less familiar |

## Decision

`cuid` (via Prisma's `@default(cuid())`). The Task 3 API contract already used prefixed opaque IDs (`stu_001`, `job_001`) — cuid preserves the opaque promise while adding real uniqueness and time-ordering. Monotonic IDs also mean new rows append to the end of B-tree indexes rather than scattering, keeping index locality good.

## Consequences

- IDs are longer than the mock's `stu_001` style — clients should treat them as opaque strings and never parse them
- Row counts no longer leak from URLs (`/students/47` vs `/students/cmr…`)
- Inserts scale better than UUIDv4 at millions of rows
