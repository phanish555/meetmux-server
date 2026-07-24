# PlaceMux API

Node.js/Express backend for the PlaceMux placement platform. Postgres-backed via Prisma, with a feature-module architecture, strict layer boundaries, a shared query parser, and full architecture + data-model docs.

## Requirements

- Node.js 18 or higher
- npm 9 or higher
- PostgreSQL 14+ (native or via `docker compose up -d`)

## Setup

```bash
git clone <your-repo-url>
cd placemux-server
npm install
cp .env.example .env         # edit DATABASE_URL for your local Postgres
# Option A — Docker:
docker compose up -d
# Option B — native Postgres:  createdb placemux
npm run db:migrate           # applies migrations
npm run db:seed              # seeds skills, companies, jobs, students, applications, interviews
npm run dev
```

## Environment variables

| Variable       | Description                                    | Default      |
| -------------- | ---------------------------------------------- | ------------ |
| `PORT`         | Port the server listens on                     | 3000         |
| `NODE_ENV`     | `development` or `production`                  | development  |
| `APP_NAME`     | Display name in responses                      | PlaceMux API |
| `DATA_SOURCE`  | `postgres` (default) or `mock` (in-memory)     | postgres     |
| `DATABASE_URL` | Postgres connection string; required if `DATA_SOURCE=postgres` | — |
| `DB_POOL_SIZE` | Max connections in the pool                    | 10           |
| `DB_POOL_TIMEOUT` | Seconds to wait for a free connection       | 20           |
| `DB_CONNECT_TIMEOUT` | Seconds to wait for the initial connect  | 10           |
| `DB_SLOW_QUERY_MS` | Log a warning above this many ms           | 100          |
| `JWT_ACCESS_SECRET` | Signing secret for access tokens (≥32 chars) | required   |
| `JWT_REFRESH_SECRET` | Signing secret for refresh tokens (≥32 chars; must differ from access) | required |
| `JWT_ACCESS_TTL` | Access token lifetime                          | 15m          |
| `JWT_REFRESH_TTL` | Refresh token lifetime                        | 7d           |
| `PASSWORD_PEPPER` | Application-level pepper for bcrypt (≥32 chars) | required   |
| `JWT_ISSUER` / `JWT_AUDIENCE` | JWT claim values                    | placemux-api / placemux-web |
| `CORS_ORIGINS` | Comma-separated allow-list                     | localhost:5173,localhost:3000 |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Running

```bash
npm run dev              # development, auto-restart
npm start                # production
npm run demo:service          # service layer runs with no HTTP server
npm run check:layers          # grep-fails if a service/repo touches req./res.
npm run check:prisma-boundary # grep-fails if any non-repo file imports prisma
npm test                      # jest suite against placemux_test
npm run db:migrate            # create + apply pending migrations (dev)
npm run db:deploy             # apply pending migrations only (prod)
npm run db:seed               # idempotent seed
npm run db:reset              # DEV ONLY — wipes + re-seeds
npm run db:studio             # opens Prisma Studio (browser)
npm run db:constraints        # runs 11 bad writes; each rejected by the DB
npm run db:injection          # runs 6 SQL-injection payloads; each inert
```

- Interactive docs (Swagger UI): **http://localhost:3000/api/docs**
- Base API URL: **http://localhost:3000/api/v1**

## Architecture & data model

- **[`src/docs/ARCHITECTURE.md`](src/docs/ARCHITECTURE.md)** — ERD, invariants INV-1..INV-8, layer contract, route conventions R1..R10
- **[`docs/DATA-MODEL.md`](docs/DATA-MODEL.md)** — tables, FK cascade choices, all 11 constraints with the bad-data they block, index plan, normalisation walkthrough
- **[`docs/PERSISTENCE.md`](docs/PERSISTENCE.md)** — repository boundary, transaction rules, injection safety, connection pooling, error translation, test coverage matrix
- **[`docs/SECURITY.md`](docs/SECURITY.md)** — threat model, password storage, JWT + refresh-rotation, role/ownership authz, defence layers, route permission matrix
- **[`docs/VALIDATION.md`](docs/VALIDATION.md)** — Zod middleware, primitive vocabulary, sanitisation, endpoint schema matrix, coverage test that fails CI on any unvalidated route

Key ADRs:
- [ADR-001](src/docs/adr/0001-layered-architecture.md) — feature-module organisation
- [ADR-002](src/docs/adr/0002-offset-pagination.md) — offset over cursor for v1
- [ADR-003](src/docs/adr/0003-strict-query-parsing.md) — reject unknown filters
- [ADR-004](src/docs/adr/0004-flat-canonical-paths.md) — flat writes, one-level nested reads
- [ADR-0004 (data)](docs/adr/0004-cuid-primary-keys.md) — cuid PKs
- [ADR-0005](docs/adr/0005-soft-deletes.md) — soft deletes
- [ADR-0006](docs/adr/0006-money-as-integer-paise.md) — money as integer paise
- [ADR-0007](docs/adr/0007-fk-restrict-by-default.md) — FK RESTRICT by default
- [ADR-0008](docs/adr/0008-application-events-table.md) — append-only application_events
- [ADR-0009](docs/adr/0009-repository-boundary.md) — only repositories touch Prisma
- [ADR-0010](docs/adr/0010-transaction-client-injection.md) — optional `client` param on every method
- [ADR-0011](docs/adr/0011-pool-sizing.md) — connection pool sizing
- [ADR-0012](docs/adr/0012-optimistic-vs-pessimistic-locking.md) — atomic ops + constraints over locks
- [ADR-0013](docs/adr/0013-password-hashing.md) — bcryptjs cost 12 + application pepper
- [ADR-0014](docs/adr/0014-jwt-access-plus-db-refresh.md) — short JWT + DB refresh
- [ADR-0015](docs/adr/0015-refresh-token-rotation.md) — refresh rotation + family revocation on reuse
- [ADR-0016](docs/adr/0016-404-over-403.md) — 404 (not 403) for records you can't see
- [ADR-0017](docs/adr/0017-user-enumeration-tradeoff.md) — the register-conflict trade-off
- [ADR-0018](docs/adr/0018-zod-over-joi.md) — Zod for schema validation
- [ADR-0019](docs/adr/0019-strict-schemas.md) — `.strict()` everywhere for mass-assignment defence
- [ADR-0020](docs/adr/0020-sanitise-on-input.md) — sanitise on input, escape on output

### The layer contract

```
route → controller → service → repository → data source (mock | Postgres via Prisma)
```

- Route files contain **no logic** — just URL → handler mapping
- Controllers **never** contain business rules — parse → call service → format
- Services **never** touch `req`/`res` — enforced by `npm run check:layers`
- `src/modules/<name>/<name>.repository.js` is a one-line dispatcher between `<name>.mock.repository.js` and `<name>.db.repository.js` based on `DATA_SOURCE`. Nothing above the repository line changed between Tasks 2 and 4.

## API Contract

### Response envelope

Success: `{ "success": true, "data": ..., "meta": ... }`
Error:   `{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }`

### Status codes

| Code | Meaning |
| ---- | ---- |
| 200  | Read, update, or idempotent replay |
| 201  | Resource created |
| 400  | Malformed parameter or bad reference |
| 404  | Resource or route not found |
| 409  | Conflict, duplicate, or illegal state transition |
| 422  | Body failed validation |
| 500  | Unhandled server error |

### Error codes

`ROUTE_NOT_FOUND`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `INVALID_STATE_TRANSITION`, `VALIDATION_FAILED`, `BAD_REQUEST`, `MALFORMED_JSON`, `INTERNAL_SERVER_ERROR`

Branch on `error.code`, never on `error.message`.

### Endpoints (all under `/api/v1`)

| Method | Path                                        | Codes                    |
| ------ | ------------------------------------------- | ------------------------ |
| GET    | `/health`, `/ready`                         | 200                      |
| GET    | `/students`                                 | 200, 400                 |
| POST   | `/students`                                 | 201, 409, 422            |
| GET    | `/students/:id`                             | 200, 404                 |
| PATCH  | `/students/:id`                             | 200, 404, 422            |
| GET    | `/students/:id/applications`                | 200, 404                 |
| GET    | `/companies`                                | 200, 400                 |
| POST   | `/companies`                                | 201, 409, 422            |
| GET    | `/companies/:id`                            | 200, 404                 |
| PATCH  | `/companies/:id`                            | 200, 404, 422            |
| GET    | `/companies/:id/jobs`                       | 200, 400, 404            |
| GET    | `/jobs`                                     | 200, 400                 |
| POST   | `/jobs`                                     | 201, 400, 422            |
| GET    | `/jobs/:id`                                 | 200, 404                 |
| PATCH  | `/jobs/:id`                                 | 200, 404, 422            |
| GET    | `/jobs/:id/applications`                    | 200, 400, 404            |
| GET    | `/applications`                             | 200, 400                 |
| POST   | `/applications`                             | 201, 200, 400, 409, 422  |
| GET    | `/applications/:id`                         | 200, 404                 |
| PATCH  | `/applications/:id/status`                  | 200, 404, 409, 422       |
| POST   | `/applications/:id/withdrawal`              | 201, 404, 409            |
| GET    | `/applications/:id/interviews`              | 200, 400, 404            |
| GET    | `/interviews`                               | 200, 400                 |
| POST   | `/interviews`                               | 201, 400, 409, 422       |
| GET    | `/interviews/:id`                           | 200, 404                 |

### Query behavior (identical across every list endpoint)

- **Pagination:** `?page=1&limit=20` (limit max 100). `meta.pagination` has `page/limit/total/totalPages/hasNext/hasPrev`.
- **Sorting:** `?sort=-createdAt,title` (`-` = descending). Allow-listed per module.
- **Filtering:** allow-listed per module in `<module>.queryschema.js`. **Unknown filters return 400**, not silently ignored (see ADR-003).
- **Sparse fields:** `?fields=id,title` restricts the payload to those keys.
- **Expansion:** `?expand=company` on `GET /jobs/:id` inlines the company object.
- **Search:** `?search=aarav` (free text over searchable fields).

Example that exercises all of them at once:

```
GET /jobs?type=internship&sort=-stipend&fields=id,title,stipend&limit=5
```

### Idempotency

`POST /applications` accepts an optional `Idempotency-Key` header. Reusing a key returns **200** with the original record; the natural-key duplicate (same student + job, no key) returns **409**.

### Application status state machine

```
submitted    → under-review, rejected
under-review → shortlisted, rejected
shortlisted  → offered, rejected
offered      → (terminal)
rejected     → (terminal)
withdrawn    → (terminal)
```

Illegal moves return **409** with error code `INVALID_STATE_TRANSITION`.

`POST /applications/:id/withdrawal` is a sub-resource action (rule R7) that transitions to `withdrawn` and stamps `withdrawnAt`.

## Data-source swap (Task 4 payoff)

Two implementations coexist per module:

- `<name>.mock.repository.js` — in-memory arrays (default in Task 2)
- `<name>.db.repository.js` — Prisma + Postgres (default now)

`<name>.repository.js` is a one-line dispatcher that picks one based on `DATA_SOURCE`. Flip the env var, restart, and the entire API keeps working with the identical wire contract. Nothing in the controller, service, validator, DTO, route, or OpenAPI spec changed to go from mock to Postgres.

## Database

- Schema in [`prisma/schema.prisma`](prisma/schema.prisma) — 10 tables, 4 enums, 10 CHECK constraints, 2 composite UNIQUEs, 4 partial/GIN indexes.
- Migrations in [`prisma/migrations/`](prisma/migrations/) — versioned SQL, immutable once applied.
- Seed in [`prisma/seed.js`](prisma/seed.js) — idempotent (upserts throughout).
- `npm run db:constraints` runs 11 intentionally-bad writes directly through Prisma; every one must be rejected by the database (bypassing the API entirely).
- `/api/v1/ready` genuinely probes the DB (`SELECT 1`) and returns 503 if it can't reach it.
- Prisma errors are mapped to the API's error catalogue in [`src/shared/middleware/errorHandler.js`](src/shared/middleware/errorHandler.js): `P2002` → 409, `P2025` → 404, `P2003` → 400.

## Postman

Import `postman/PlaceMux.postman_collection.json`. The collection tests status codes, envelope shape, and the idempotency replay behavior.

## Project structure

```
src/
├── config/env.js
├── shared/
│   ├── errors/ApiError.js
│   ├── http/{apiResponse,asyncHandler}.js
│   ├── query/{queryParser,listQuery}.js
│   └── middleware/{requestLogger,errorHandler}.js
├── modules/
│   ├── health/
│   ├── students/     (routes, controller, service, repository, validator, dto, queryschema, mock)
│   ├── companies/
│   ├── jobs/
│   ├── applications/
│   └── interviews/
├── docs/
│   ├── openapi.yaml       (served at /api/docs)
│   ├── ARCHITECTURE.md
│   └── adr/               (0001-0004)
├── routes.js               (single mount point)
├── app.js
└── server.js

scripts/
└── demo-service.js         (proof the service layer has no HTTP dependency)

postman/
└── PlaceMux.postman_collection.json
```

## Notes

- `.env` is gitignored. Copy `.env.example` and fill it in.
- `helmet` and `cors` are enabled by default.
- Data resets on every restart (mock repository).
