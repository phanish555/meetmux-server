# ADR-0017: User-enumeration trade-off on register

**Status:** Accepted  ·  **Date:** 2026-07-24

## Context

`POST /auth/register` for an email that's already registered can respond in two ways:

1. **409 "email already exists"** — clear UX; leaks that this email has an account
2. **200 "check your inbox"** with no email actually sent — no leak; confusing UX; needs a real email pipeline to feel legitimate

## Decision

For Phase 1, use option **1** (409). A campus placement platform has semi-public user identities and we don't yet have an email pipeline to make option 2 believable.

## Consequences

- Someone can probe whether an email is registered — a real privacy cost
- Compensating controls: registration is rate-limited (3/hour), and login already returns identical messages for "wrong password" and "no such user"
- **This decision is revisited** when email delivery lands. Note in migrations if we do change: the same-message rule applies to password-reset requests too.
