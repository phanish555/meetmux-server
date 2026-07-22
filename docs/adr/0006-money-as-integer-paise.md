# ADR-0006: Money as integer paise

**Status:** Accepted  ·  **Date:** 2026-07-22

## Context

Job stipends are money. Money in floating-point breaks in production: `0.1 + 0.2 === 0.30000000000000004`. Accumulate a few thousand of those and payroll disagrees with itself.

## Decision

Store all money as **integer paise** in the database (`stipend_paise INTEGER`). The API exposes rupees (`stipend: 35000`); the DB repository divides/multiplies by 100 at the boundary. No arithmetic in floating point, ever.

## Consequences

- Exact arithmetic; no rounding drift
- One conversion point (DB repo), documented and covered by the mapper function
- If ever supporting multiple currencies, store the currency code alongside the integer amount rather than switching to `Decimal`
