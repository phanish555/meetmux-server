# PlaceMux — Request Validation

## 1. Philosophy

- **Parse, don't validate.** The middleware returns a *cleaned, typed* value; the raw input is discarded. Services then trust the shape completely and only enforce *rules* (email uniqueness, transition graph, ownership).
- **Validate at the edge, once.** No re-checking shapes in services or repositories.
- **Allowlist, never blocklist.** Enumerate the good, not the bad. Same lesson as SQL injection in Task 5.
- **Reject unknown fields (`.strict()`).** Mass-assignment defence — a client can't append `"role": "ADMIN"` to a signup body.
- **Fail with everything at once.** Every field error is returned in one response.

## 2. The three defence layers

| Layer | Catches | Cost |
| --- | --- | --- |
| **Validation middleware** (Task 7) | Wrong shape, wrong type, unknown fields, hostile strings | 1 ms — rejects before any work |
| **Service rules** (Task 3/5) | "Email taken", "can't move from rejected → offered", ownership | DB read |
| **Database constraints** (Task 4) | Anything that reached the DB wrongly | Absolute, but expensive |

Middleware is the outermost ring. Cheap insurance — a bad request costs a millisecond, letting one through costs a database round trip, a confusing error, or a vulnerability.

## 3. The middleware — `src/shared/middleware/validate.js`

```js
validate({ body, query, params, headers })
```

- Runs `schema.safeParse(req[target])` for each provided target.
- Parsed output lands in `req.validated.<target>`.
- `req.body` and `req.params` are overwritten with the parsed values (types coerced, defaults applied).
- **`req.query` is left alone.** In Express 5 it's a getter and assignment silently fails. Use `req.validatedQuery` in controllers that need it.
- Errors return **400** for query/path/header issues (malformed request) and **422** for body issues (well-formed but semantically invalid).
- The middleware's function name is literally `validate` so the coverage test can identify it in the router stack.

## 4. Stable public issue codes

Zod's internal codes are an implementation detail. We map them to a stable vocabulary so clients can branch without depending on the library.

| Public code | Meaning |
| --- | --- |
| `INVALID_TYPE` | Wrong JS type (e.g. string where number expected) |
| `INVALID_FORMAT` | Doesn't match required pattern (email, ID, phone) |
| `INVALID_OPTION` | Not in the allowed enum |
| `TOO_SMALL` / `TOO_BIG` | Length / value out of range |
| `UNKNOWN_FIELD` | Extra field not permitted by the schema |
| `INVALID_VALUE` | Cross-field or custom `refine()` failed |

## 5. Primitive vocabulary — `src/shared/schemas/primitives.js`

Reusable building blocks so new endpoint schemas compose rather than re-invent.

| Primitive | Rule |
| --- | --- |
| `studentId` / `companyId` / `jobId` / `applicationId` / `interviewId` | `prefix_...` or a cuid; anything else → `INVALID_FORMAT` |
| `email` | trimmed, lowercased, RFC-lite regex, ≤ 255 chars |
| `personName` | Unicode-aware (`\p{L}`), 2–100 chars, allowlist regex — non-Latin names welcome |
| `cleanString` | strips C0/C1 control chars + zero-width joiners, then trims |
| `shortText(max)` / `longText(max)` | `cleanString` piped into length checks |
| `positiveInt` / `nonNegativeInt` | `z.coerce.number()` (query params arrive as strings) |
| `cgpa` | 0–10 |
| `graduationYear` | 2020–2035 |
| `futureDate` | ISO-parsed date; refuses past dates |
| `studentStatus` / `jobType` / `applicationStatus` / `interviewOutcome` | Domain enums — single source of truth |
| `pagination` | `page` default 1, `limit` default 20 max 100, both coerced |
| `sortBy(allowed)` | Comma list validated against an allowlist |
| `boolFromQuery` | `'true'` / `'false'` → real boolean |

## 6. Sanitisation

Sanitise **before** validate — validation sees the final value.

- **`src/shared/middleware/sanitiseBody.js`** — strips `__proto__` / `constructor` / `prototype` keys from request bodies at any depth (max 20). Blocks prototype pollution and caps recursion as a DoS defence.
- **`primitives.cleanString`** — strips control chars (0x00–0x1F, 0x7F) and zero-width joiners (U+200B..200D, U+FEFF). Invisible-payload smuggling.
- **`sanitise.stripHtml` / `safeHtml`** — DOMPurify wrappers ready to `.transform()` into any text field.

### Where XSS actually lives

The API returns JSON — it isn't itself XSS-vulnerable. But **stored XSS is real:** save `<img src=x onerror=alert(1)>` today, some admin dashboard renders it unescaped next month. Sanitising on input is defence in depth. The frontend still MUST escape on output.

## 7. Coverage — enforced by CI

`tests/validation-coverage.test.js` walks every route registered on the Express router and asserts each one either:
- has a middleware whose function name is `validate`, OR
- is in a short, explicit `EXEMPT` set (each entry justified in a comment).

Deleting a `validate(...)` from any route **fails CI**. Adding a new route without one **fails CI**. Every exception is a conscious, reviewable decision.

## 8. Endpoint schema matrix

| Endpoint | body | query | params | headers |
| --- | --- | --- | --- | --- |
| `POST /auth/register` | ✓ | — | — | — |
| `POST /auth/login` | ✓ | — | — | — |
| `POST /auth/refresh` | ✓ | — | — | — |
| `POST /auth/logout` | ✓ | — | — | — |
| `POST /auth/logout-all` | — | — | — | — (auth-only) |
| `GET /auth/me` | — | — | — | — (auth-only) |
| `GET /students` | — | ✓ | — | — |
| `GET /students/:id` | — | — | ✓ | — |
| `POST /students` | ✓ | — | — | — |
| `PATCH /students/:id` | ✓ | — | ✓ | — |
| `GET /students/:id/applications` | — | ✓ | ✓ | — |
| `GET /companies` | — | ✓ | — | — |
| `GET /companies/:id` | — | — | ✓ | — |
| `POST /companies` | ✓ | — | — | — |
| `PATCH /companies/:id` | ✓ | — | ✓ | — |
| `GET /companies/:id/jobs` | — | ✓ | ✓ | — |
| `GET /jobs` | — | ✓ | — | — |
| `GET /jobs/:id` | — | ✓ (`expand`) | ✓ | — |
| `POST /jobs` | ✓ | — | — | — |
| `PATCH /jobs/:id` | ✓ | — | ✓ | — |
| `GET /jobs/:id/applications` | — | ✓ | ✓ | — |
| `GET /applications` | — | ✓ | — | — |
| `GET /applications/:id` | — | — | ✓ | — |
| `POST /applications` | ✓ | — | — | ✓ (`Idempotency-Key`) |
| `PATCH /applications/:id/status` | ✓ | — | ✓ | — |
| `POST /applications/:id/withdrawal` | — | — | ✓ | — |
| `GET /applications/:id/interviews` | — | ✓ | ✓ | — |
| `GET /interviews` | — | ✓ | — | — |
| `POST /interviews` | ✓ | — | — | — |
| `GET /interviews/:id` | — | — | ✓ | — |

## 9. Error contract

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [
      { "field": "body.email", "code": "INVALID_FORMAT", "message": "must be a valid email address" },
      { "field": "body.password", "code": "TOO_SMALL", "message": "must be at least 12 characters" },
      { "field": "body.name", "code": "TOO_SMALL", "message": "must be at least 2 characters" }
    ]
  }
}
```

### What never leaks

Verified by `tests/validation.test.js` — regexed the response for each and asserted absence:

| Never | Because |
| --- | --- |
| Stack traces (`/src/`, `at Object.`, `node_modules`) | Reveals file paths and library versions |
| Library names (`zod`, `prisma`, `postgres`) | Narrows exploit search |
| Table / column names (`password_hash`, `users.`) | Maps our schema |
| Regex patterns | Helps craft bypasses |

## 10. Test matrix

| Suite | Proves |
| --- | --- |
| `validation-coverage.test.js` | Every non-EXEMPT route has `validate()` |
| `validation.test.js` — valid | 201 on well-formed; defaults + coercion applied |
| `validation.test.js` — invalid | 4 body errors returned at once (422); unknown body field 422; unknown query field 400; bad path id 400; empty PATCH 422 |
| `validation.test.js` — hostile | `__proto__` doesn't pollute `Object.prototype`; operator-injection rejected; oversized string < 500; no library/stack/schema leaks in errors |
| `fuzz.test.js` | 20 junk values × 5 fields → 0 responses ≥ 500 |

**Current status:** 57/57 passing across 10 suites.

## 11. Decision records

- [ADR-0018: Zod for schema validation](adr/0018-zod-over-joi.md)
- [ADR-0019: `.strict()` schemas everywhere — mass-assignment defence](adr/0019-strict-schemas.md)
- [ADR-0020: Sanitise on input, escape on output](adr/0020-sanitise-on-input.md)
