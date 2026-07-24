# ADR-0018: Zod for schema validation

**Status:** Accepted  ·  **Date:** 2026-07-25

## Context

Options for a Node validation library:

| | Zod | Joi | class-validator | ajv |
| --- | --- | --- | --- | --- |
| Type inference | ✓ (TS) | ✗ | ✓ (decorators) | ✗ |
| Composability | Excellent (pipe, extend, refine) | Good | Awkward | JSON Schema strings |
| Parses (returns typed value) | ✓ | ✓ | ✗ (mutates) | ✓ |
| `.strict()` reject unknown keys | ✓ | ✓ | ✗ | ✓ |
| Small footprint | ✓ | ✓ | Requires reflect-metadata | ✓ |

## Decision

**Zod.** Parse-not-validate philosophy matches our services expecting clean values. Composability lets `primitives.js` supply building blocks that every endpoint schema reuses. `.strict()` is essential for mass-assignment defence.

Public issue codes are mapped through `ISSUE_CODES` in `validate.js` so a future switch to Joi or ajv doesn't break the client contract.

## Consequences

- Ergonomic schemas that read declaratively
- Parsed output carries defaults and coercion (query strings → numbers) automatically
- The library couples our internal error codes; mitigated by the mapping table
- Adds ~50KB to the dependency tree — acceptable
