# PlaceMux API — Mock Server

Node.js/Express backend for the PlaceMux placement platform. Task 3 organises the code into feature modules with strict layer boundaries, standardises pagination/filtering/sorting behind a shared query parser, and ships architecture docs (ERD, invariants, ADRs).

## Requirements

- Node.js 18 or higher
- npm 9 or higher

## Setup

```bash
git clone <your-repo-url>
cd placemux-server
npm install
cp .env.example .env
```

## Environment variables

| Variable      | Description                          | Default       |
| ------------- | ------------------------------------ | ------------- |
| `PORT`        | Port the server listens on           | 3000          |
| `NODE_ENV`    | `development` or `production`        | development   |
| `APP_NAME`    | Display name in responses            | PlaceMux API  |
| `DATA_SOURCE` | `mock` today, `postgres` (etc) later | mock          |

## Running

```bash
npm run dev            # development, auto-restart
npm start              # production
npm run demo:service   # runs the service layer with no HTTP server (proof of decoupling)
npm run check:layers   # fails if a service/repository imports req./res.
```

- Interactive docs (Swagger UI): **http://localhost:3000/api/docs**
- Base API URL: **http://localhost:3000/api/v1**

## Architecture

See **[`src/docs/ARCHITECTURE.md`](src/docs/ARCHITECTURE.md)** for the full picture — ERD, relationships, invariants (INV-1…INV-8), layer contract, route conventions (R1…R10), and directory layout.

Key ADRs:
- [ADR-001](src/docs/adr/0001-layered-architecture.md) — feature-module organisation
- [ADR-002](src/docs/adr/0002-offset-pagination.md) — offset over cursor for v1
- [ADR-003](src/docs/adr/0003-strict-query-parsing.md) — reject unknown filters
- [ADR-004](src/docs/adr/0004-flat-canonical-paths.md) — flat writes, one-level nested reads

### The layer contract

```
route → controller → service → repository → data source
```

- Route files contain **no logic** — just URL → handler mapping
- Controllers **never** contain business rules — parse → call service → format
- Services **never** touch `req`/`res` — enforced by `npm run check:layers`
- Repositories only do data access; every method is `async`, ready for a real DB

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

## Data-source swap path

Data access lives in `src/modules/<name>/<name>.repository.js`. Every method is `async`. To move to a real database:

1. Replace `<module>.repository.js` with a DB-backed implementation using the same method names.
2. Set `DATA_SOURCE=postgres` in `.env`.

No controller, route, validator, or response shape changes. The contract holds.

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
