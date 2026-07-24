# ADR-0015: Refresh-token rotation with family revocation

**Status:** Accepted  ·  **Date:** 2026-07-24

## Context

Without rotation, a stolen refresh token gives an attacker access for its whole lifetime (7 days here) and nobody ever detects the theft. With rotation, we get *detection* almost for free.

## Decision

Every use of a refresh token issues a **new** refresh token and revokes the old one. Both tokens share a `family` UUID.

If a **revoked** token is ever presented, we assume theft and revoke every token in that family. Both the attacker's newly-issued token AND the legitimate user's next refresh fail, forcing re-authentication.

Refresh tokens are **stored hashed** (SHA-256). If the DB is dumped, the values are useless — same principle as password storage.

## Consequences

- Legitimate clients that lose their refresh token (bug, page reload before storage) end up logging out — acceptable trade
- Race condition: a legitimate client that fires two refreshes simultaneously will trip reuse detection. Very rare in practice; UX mitigation is a "refresh in progress" mutex client-side
- Documented and tested end-to-end in `tests/auth.test.js` → `refresh token rotation & reuse detection`
