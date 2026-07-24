# ADR-0013: bcryptjs (cost 12) with an application-level pepper

**Status:** Accepted  ·  **Date:** 2026-07-24

## Context

Passwords must never be recoverable, not even by us. Storage options:

| Option | Verdict |
| --- | --- |
| Plaintext / SHA-256 / MD5 | Catastrophic. GPU cracks minutes of eight-char passwords. |
| PBKDF2 | Acceptable, but GPU-friendly. |
| bcrypt / bcryptjs | Solid; memory-cheap. Silently truncates > 72 bytes (mitigated by our 128-char cap). |
| argon2id | Best. Memory-hard, defeats GPUs and ASICs. Requires native compilation. |

## Decision

**bcryptjs cost 12**, plus an application-level pepper HMAC-SHA256'd into the plaintext before bcrypt. Pepper lives in `PASSWORD_PEPPER` env, never in the DB — a DB dump without the server config yields useless hashes.

argon2id would be stronger and is the preferred choice given a working toolchain. We deferred it to avoid the native-compile friction (this project must set up cleanly on any dev laptop and inside CI without Windows Build Tools / clang).

## Consequences

- Login costs ~100ms — deliberate; makes offline brute force uneconomical
- Salt is generated automatically by bcrypt and stored inside the hash string
- Rehash-on-login: if we raise `COST` later, existing users are upgraded transparently on their next successful login (see `password.needsRehash`)
- 12–128 char length cap; 128 also prevents "10MB password" DoS against the hashing call
- Reviewers who require argon2 can swap `password.service.js`; the interface stays the same
