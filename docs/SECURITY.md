# PlaceMux — Authentication & Security

## 1. Threat model

**Defends against:** credential stuffing, brute force, refresh-token theft, privilege escalation, IDOR, user enumeration (partially — trade-off noted), SQL injection (Task 5), token forgery, `alg: none`, downgrade attacks.

**Does not defend in Phase 1:** a fully compromised server, malicious insiders with DB access, MITM without HTTPS, DDoS at the network layer, side-channel attacks against bcrypt/jwt libraries.

## 2. Vocabulary

| authentication (authn) | authorization (authz) |
| --- | --- |
| Who are you? | What are you allowed to do? |
| Fails → 401 | Fails → 403 |
| Once at login | Every request |

The Task 6 pitfall is confusing them: a system with only authn lets any logged-in student change an ID in the URL and read every other student's applications (**IDOR** — OWASP #1 today).

## 3. Password storage

- **bcryptjs, cost 12** (`src/modules/auth/password.service.js`). Never plaintext, never SHA-256, never any encryption.
- **Application-level pepper** (`PASSWORD_PEPPER` env, HMAC-SHA256'd before bcrypt) so a DB dump without the server config is useless.
- **Policy:** 12–128 chars, common-password blocklist. Length beats complexity — per NIST 800-63B.
- **Opportunistic rehash on login** if the work factor has been raised since signup (no forced password reset needed).
- Note: argon2id would be stronger; ADR-0013 documents why bcryptjs (pure-JS, no native compile pain) is a defensible fallback.

Proof: `tests/auth.test.js` asserts (a) the stored value matches `^\$2[aby]\$` (bcrypt marker), never plaintext, and (b) two accounts with the same password produce different hashes.

## 4. Tokens

### Access — short-lived JWT

- HS256, 15 minutes, signed with `JWT_ACCESS_SECRET`
- Claims: `sub` (user id), `role`, `email`, `type: 'access'`, `iss`, `aud`, `iat`, `exp`
- **Algorithm pinned server-side** via `algorithms: ['HS256']` — an `alg: none` token is rejected by the verifier

### Refresh — opaque random string, DB-backed

- 48 random bytes (base64url), 7-day TTL
- Stored **hashed** (SHA-256) in `refresh_tokens.token_hash`, never plaintext
- Belongs to a `family` UUID; rotation issues a new token in the same family and revokes the old

### Rotation and reuse detection

Every use of a refresh token mints a new one and revokes the old. If a **revoked** token is ever presented again, we assume theft and revoke **the entire family**. Both the attacker's new token and the legitimate user's next refresh will fail — the theft is detected instead of quietly ongoing for a week.

Verified in `tests/auth.test.js` → `refresh token rotation & reuse detection` block.

### Revocation of access tokens

Access tokens are stateless, so we can't delete them individually. Instead, `users.password_changed_at` is bumped and every access token whose `iat` is older is rejected on next use. That's how "log out everywhere" and forced re-auth after a password change work.

### Config secrets

`config/env.js` throws at startup if `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, or `PASSWORD_PEPPER` are missing / shorter than 32 chars, or if access and refresh secrets are equal. The server refuses to boot into an insecure state.

## 5. Authorization model

Role table:

| Role | Description |
| --- | --- |
| `STUDENT` | The default role after signup |
| `RECRUITER` | Company-side reviewer |
| `PLACEMENT_OFFICER` | Institution-side coordinator |
| `ADMIN` | Full access |

`src/shared/middleware/authorize.js` exposes:
- `requireRole(...roles)` — coarse check
- `requirePermission(perm)` + `PERMISSIONS` map — finer grain, ready for future needs

### Route matrix (current enforcement)

| Route | STUDENT | RECRUITER | OFFICER | ADMIN |
| --- | --- | --- | --- | --- |
| `GET /health`, `/ready`, `POST /auth/*` | public | public | public | public |
| `GET /auth/me`, `POST /auth/logout-all` | ✓ | ✓ | ✓ | ✓ |
| `GET /students` | ✗ | ✓ | ✓ | ✓ |
| `POST /students` | ✗ | ✗ | ✗ | ✓ (signup via `/auth/register`) |
| `GET /companies`, `GET /jobs`, `GET /interviews/:id` | ✓ | ✓ | ✓ | ✓ |
| `POST /companies`, `PATCH /companies/:id` | ✗ | update only | ✓ | ✓ |
| `POST /jobs`, `PATCH /jobs/:id` | ✗ | ✓ | ✓ | ✓ |
| `GET /jobs/:id/applications` | ✗ | ✓ | ✓ | ✓ |
| `POST /applications` | ✓ (only own) | ✗ | ✗ | ✓ |
| `GET /applications`, `GET /applications/:id` | own only | ✓ | ✓ | ✓ |
| `PATCH /applications/:id/status` | ✗ | ✓ | ✓ | ✓ |
| `POST /applications/:id/withdrawal` | own only | ✗ | ✗ | ✓ |
| `POST /interviews`, `GET /interviews` | ✗ | ✓ | ✓ | ✓ |

### Ownership scoping — the pitfall

**Never check ownership after fetching.** The scope is part of the query, inside the service:

```js
// application.service.js#scopeFilters
if (actor.role === 'STUDENT') {
  return { ...filters, studentId: actor.studentId };
}
```

A student fetching `/applications/:id` for another student's application returns **404, not 403**. Confirming the record exists is itself information leak. Verified by `tests/auth.test.js` → `IDOR` test.

### The 401/403/404 policy

| Situation | Status | Reason |
| --- | --- | --- |
| Missing / invalid access token | 401 | authentication failed |
| Valid token, wrong role | 403 | authenticated but not permitted |
| Valid token, correct role, no such visible record | 404 | don't confirm existence outside your scope |

## 6. Defences

| Defence | Where |
| --- | --- |
| Helmet with a strict CSP + HSTS + `X-Content-Type-Options` + `X-Frame-Options: DENY` etc | `src/app.js` |
| `x-powered-by` disabled | `src/app.js` |
| CORS allow-list from `CORS_ORIGINS` env | `src/app.js` |
| Body size cap 100kb | `src/app.js` |
| Rate limits (global 300/15min, register 3/hr, login 5/15min keyed on IP+email) | `src/shared/middleware/rateLimit.js` |
| Account lockout after 5 failed logins for 15 minutes | `auth.service.js#recordFailedAttempt` |
| Identical login-failure message and timing (dummy hash if user missing) | `auth.service.js#login` |
| Prisma parameterises inputs (Task 5) | shared/prisma + `db:injection` script |
| SQL injection payload tests (Task 5) | `tests/injection.test.js` |
| `alg: none` rejected (algorithm pinned) | `token.service.js#verifyAccessToken` + test |

## 7. Client storage recommendation

- **Access token:** JavaScript memory (dies on refresh; not readable by other tabs; XSS-resistant if you use `httpOnly` cookies for the refresh)
- **Refresh token:** should be delivered as an `httpOnly; secure; sameSite=strict` cookie in production. The current API accepts the refresh token in the body OR from the `refreshToken` cookie so either strategy works.

## 8. Known limitations (Phase 1)

- Rate-limit store is in-memory → single-instance only. Redis lands with the caching layer.
- No email verification, no MFA.
- Account lockout is vulnerable to a deliberate lockout attack against a known email — mitigated by short lock duration + rate limits.
- The user-enumeration trade-off is intentional (ADR-0017): a duplicate-email 409 is more user-friendly than a mystery success. In a high-security context, replace with an "email sent" 200 regardless.
- Server-side session revocation for access tokens costs a DB read per request. Task 8's caching layer will optimise it.

## 9. Decision records

- [ADR-0013: bcryptjs (cost 12) with an app-level pepper](adr/0013-password-hashing.md)
- [ADR-0014: short-lived JWT access tokens + DB-backed refresh](adr/0014-jwt-access-plus-db-refresh.md)
- [ADR-0015: refresh-token rotation with family revocation](adr/0015-refresh-token-rotation.md)
- [ADR-0016: 404 over 403 for records you can't see](adr/0016-404-over-403.md)
- [ADR-0017: user-enumeration trade-off](adr/0017-user-enumeration-tradeoff.md)
