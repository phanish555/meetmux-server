# PlaceMux API — Architecture

**Version:** 1.0  ·  **Status:** Phase 1  ·  **Owner:** phanish555

## 1. Purpose and scope

Backend API for a campus placement platform. Covers companies, jobs, students, applications and interviews. Data is currently served from in-memory mocks behind a repository interface; persistence lands in a later task without contract changes.

## 2. Resource model

### 2.1 Entities

| Resource      | Description                                | Owns          |
| ------------- | ------------------------------------------ | ------------- |
| `Company`     | An employer                                | Jobs          |
| `Job`         | An opening at a company                    | Applications  |
| `Student`     | A candidate                                | Applications  |
| `Application` | A student applying to a job (assoc. entity)| Interviews    |
| `Interview`   | A scheduled round for an application       | —             |

### 2.2 Relationship diagram

```
┌─────────────────┐
│    Company      │
├─────────────────┤
│ id       PK     │
│ name            │
│ industry        │
│ location        │
│ verified        │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────┴────────┐         ┌─────────────────┐
│      Job        │         │    Student      │
├─────────────────┤         ├─────────────────┤
│ id       PK     │         │ id       PK     │
│ companyId FK ───┘         │ name            │
│ title           │         │ email  UNIQUE   │
│ type            │         │ branch          │
│ stipend  NULL   │         │ graduationYear  │
│ deadline        │         │ cgpa     NULL   │
└────────┬────────┘         └────────┬────────┘
         │ 1                          │ 1
         │                            │
         │ N                          │ N
         └──────────┬─────────────────┘
                    │
          ┌─────────┴─────────┐
          │   Application     │
          ├───────────────────┤
          │ id          PK    │
          │ studentId   FK    │
          │ jobId       FK    │
          │ status            │
          │ appliedAt         │
          │ UNIQUE(studentId, │
          │        jobId)     │
          └─────────┬─────────┘
                    │ 1
                    │ N
          ┌─────────┴─────────┐
          │    Interview      │
          ├───────────────────┤
          │ id            PK  │
          │ applicationId FK  │
          │ round             │
          │ scheduledAt       │
          │ outcome           │
          └───────────────────┘
```

### 2.3 Relationships

| From        | To           | Cardinality | Notes                                                    |
| ----------- | ------------ | ----------- | -------------------------------------------------------- |
| Company     | Job          | 1:N         | A job belongs to exactly one company                     |
| Student     | Application  | 1:N         |                                                          |
| Job         | Application  | 1:N         |                                                          |
| Student     | Job          | N:M         | Realised through `Application` (associative entity)      |
| Application | Interview    | 1:N         | Unique per round                                         |

### 2.4 Invariants

An invariant is a rule that must always hold. Listed here with enforcement location.

| ID     | Rule                                                             | Enforced in                        |
| ------ | ---------------------------------------------------------------- | ---------------------------------- |
| INV-1  | `Job.companyId` must reference an existing Company               | Service (`job.service.createJob`)  |
| INV-2  | `Application` references must exist (student and job)            | Service (`application.service`)    |
| INV-3  | `(studentId, jobId)` unique across Applications                  | Service now, DB constraint later   |
| INV-4  | `Application.status` follows the transition graph                | Service (`ALLOWED_TRANSITIONS`)    |
| INV-5  | `Student.email` unique, case-insensitive                         | Service now, DB constraint later   |
| INV-6  | `Job.deadline` must be in the future at creation time            | Service (`job.service.createJob`)  |
| INV-7  | A Company with open Jobs cannot be deleted (no DELETE in v1)     | Not yet enforced (no delete route) |
| INV-8  | `Interview.round` unique per Application                         | Service (`interview.service`)      |

## 3. Layering

```
route → controller → service → repository → data source
```

| Layer      | Responsibility                                    | Must not                     |
| ---------- | ------------------------------------------------- | ---------------------------- |
| Route      | Map URL + method to a handler                     | Contain any logic            |
| Validator  | Check input shape and format                      | Query data                   |
| Controller | Parse request, call service, format response      | Contain business rules       |
| Service    | Business rules, invariants, orchestration         | Know about HTTP              |
| Repository | Data access                                       | Contain business rules       |
| DTO        | Choose what leaves the system                     | Contain logic                |

**Dependency rule:** dependencies point downward only. A service must be runnable from a CLI script with no server running — see [`scripts/demo-service.js`](../../scripts/demo-service.js). Run `npm run demo:service` to prove it. Run `npm run check:layers` to verify no `req.`/`res.` references leak into service or repository files.

## 4. Directory layout

Organised **by feature**, not by layer. Each module in `src/modules/<name>/` owns its routes, controller, service, repository, validator, DTO, query schema and mock data.

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
│   ├── students/    (routes, controller, service, repository, validator, dto, queryschema, mock)
│   ├── companies/
│   ├── jobs/
│   ├── applications/
│   └── interviews/
├── docs/openapi.yaml
├── routes.js        (single mount point)
├── app.js
└── server.js
```

## 5. Route conventions

| ID  | Rule                                                                            |
| --- | ------------------------------------------------------------------------------- |
| R1  | Paths use plural, lowercase, hyphenated nouns                                   |
| R2  | HTTP method is the verb — never put verbs in paths                              |
| R3  | Every path is prefixed with `/api/v1`                                           |
| R4  | Collection = `/resource`; item = `/resource/:id`                                |
| R5  | Nesting is allowed to ONE level, only for owned sub-resources                   |
| R6  | Nested collection is read-only sugar; canonical write path is flat              |
| R7  | Non-CRUD operations become a sub-resource noun (e.g. `POST /:id/withdrawal`)    |
| R8  | Filtering, sorting, paging live in the query string, never the path             |
| R9  | PATCH = partial update, PUT = full replacement, DELETE = removal                |
| R10 | Response shape is identical across all resources                                |

### 5.1 Route table

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

`PATCH /applications/:id/status` (rather than a generic PATCH on the whole application) makes the status-transition constraint visible in the URL.

## 6. Shared conventions

### 6.1 Response envelope

Success: `{ "success": true, "data": ..., "meta": ... }`
Error:   `{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }`

### 6.2 Status codes

| Code | Meaning                                          |
| ---- | ------------------------------------------------ |
| 200  | Read, update, or idempotent replay               |
| 201  | Created                                          |
| 400  | Malformed parameter or bad reference             |
| 404  | Resource or route not found                      |
| 409  | Conflict, duplicate, or illegal state transition |
| 422  | Body failed validation                           |
| 500  | Unhandled server error                           |

### 6.3 Error codes

`ROUTE_NOT_FOUND`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `INVALID_STATE_TRANSITION`, `VALIDATION_FAILED`, `BAD_REQUEST`, `MALFORMED_JSON`, `INTERNAL_SERVER_ERROR`.

Clients branch on `error.code`. Messages may change without notice.

### 6.4 Pagination

Offset-based. `?page` (default 1), `?limit` (default 20, max 100). `meta.pagination` carries `page`, `limit`, `total`, `totalPages`, `hasNext`, `hasPrev`. See [ADR-002](adr/0002-offset-pagination.md) for the tradeoff.

### 6.5 Filtering

Allow-listed per module in `<module>.queryschema.js`. Unknown filters return **400** with the list of valid filters — silent ignoring is forbidden ([ADR-003](adr/0003-strict-query-parsing.md)).

### 6.6 Sorting

`?sort=-createdAt,title`. Leading `-` means descending. Allow-listed per module.

### 6.7 Sparse fieldsets and expansion

`?fields=id,title` restricts the payload. `?expand=company` inlines a related resource. Both are allow-listed. Expansion is opt-in and never nested more than one level.

### 6.8 Naming

Paths: plural, lowercase, hyphenated. Fields: `camelCase`. Timestamps: ISO 8601 UTC. IDs: prefixed strings (`job_001`). Money: integer in smallest unit, never a formatted string.

## 7. Versioning and change policy

All routes live under `/api/v1`.

**Non-breaking** (ship freely): adding an endpoint, adding an optional query parameter, adding a new field to a response.

**Breaking** (requires `/api/v2`): removing or renaming a field, changing a type, changing a status code for an existing case, making an optional parameter required.

## 8. Extension points

- **Auth** — middleware slot between logging and routing; services will take an optional `actor` argument
- **Persistence** — swap the repository files per module; `DATA_SOURCE` env var selects
- **Caching** — belongs in the repository layer, transparent to services
- **Events** — services are the natural emit point (e.g. `application.status.changed`)

## 9. Known limitations

- In-memory data resets on restart
- No authentication or authorisation
- Filtering and sorting are O(n) in memory
- No rate limiting
- Offset pagination is unstable under concurrent inserts (accepted; see ADR-002)
