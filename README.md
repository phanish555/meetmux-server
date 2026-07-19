# PlaceMux API — Mock Server

Node.js/Express backend for the PlaceMux placement platform. Serves a fully documented mock of the v1 API so the frontend can build against a stable contract before real persistence lands.

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
npm run dev     # development, auto-restarts on save
npm start       # production
```

Server starts at `http://localhost:3000`.

- Interactive docs (Swagger UI): **http://localhost:3000/api/docs**
- Base API URL: **http://localhost:3000/api/v1**

## API Contract (Mock — v1)

### Response envelope

Every success:
```json
{ "success": true, "data": {}, "meta": {} }
```

Every error:
```json
{ "success": false, "error": { "code": "...", "message": "...", "details": [] } }
```

`meta` is present on paginated list responses.

### Status codes

| Code | When |
| ---- | ---- |
| 200  | Successful read, update, or idempotent replay |
| 201  | Resource created |
| 400  | Malformed body, bad query/path parameter, or invalid reference |
| 404  | Resource or route does not exist |
| 409  | Resource already exists (natural-key duplicate) |
| 422  | Request body failed field validation |
| 500  | Unhandled server error |

### Error codes

`ROUTE_NOT_FOUND`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`,
`VALIDATION_FAILED`, `BAD_REQUEST`, `MALFORMED_JSON`, `INTERNAL_SERVER_ERROR`

Branch on `error.code`, never on `error.message` — messages may be reworded without notice.

### Endpoints

| Method | Path                     | Query / headers                                                   | Codes                    |
| ------ | ------------------------ | ----------------------------------------------------------------- | ------------------------ |
| GET    | `/health`                | —                                                                 | 200                      |
| GET    | `/ready`                 | —                                                                 | 200                      |
| GET    | `/students`              | page, limit, status, branch, graduationYear, skill, search        | 200, 400                 |
| GET    | `/students/:id`          | —                                                                 | 200, 404                 |
| POST   | `/students`              | —                                                                 | 201, 409, 422            |
| GET    | `/companies`             | page, limit, industry, verified, search                           | 200, 400                 |
| GET    | `/companies/:id`         | —                                                                 | 200, 404                 |
| GET    | `/jobs`                  | page, limit, companyId, type, location, minStipend, skill         | 200, 400                 |
| GET    | `/jobs/:id`              | `expand=company`                                                  | 200, 404                 |
| GET    | `/applications`          | page, limit, studentId, jobId, status                             | 200, 400                 |
| POST   | `/applications`          | header: `Idempotency-Key`                                         | 201, 200, 400, 409, 422  |
| PATCH  | `/applications/:id`      | —                                                                 | 200, 400, 404, 422       |

All paths are prefixed with `/api/v1`.

### Pagination

All list endpoints paginate. Default `limit` is `20`, maximum `100`.

`meta` carries `page`, `limit`, `total`, `totalPages`, `hasNext`, `hasPrev`.

### Idempotency

`POST /applications` accepts an optional `Idempotency-Key` header. Reusing a key returns **200** with the original record instead of creating a duplicate. Applying twice to the same job without a key returns **409**.

### Application status state machine

```
submitted    → under-review, rejected
under-review → shortlisted, rejected
shortlisted  → offered, rejected
offered      → (terminal)
rejected     → (terminal)
```

Illegal transitions return **400** with the list of allowed next states.

## Mock data

All responses are served from `src/mocks/`. Data resets on every restart. Reads defensively copy records so callers cannot mutate the source arrays.

## Swapping mocks for real data

Data access is isolated behind `src/services/repositories/`. To move to a real database:

1. Add `student.db.repo.js` (etc.) implementing the same async methods (`findAll`, `findById`, `findByEmail`, `create`, …) with identical signatures.
2. Update the exports in `src/services/repositories/index.js` to point at the new implementations when `DATA_SOURCE !== 'mock'`.
3. Set `DATA_SOURCE=postgres` in `.env`.

No controller, route, validator, or response shape changes. The contract holds.

## Postman

Import `postman/PlaceMux.postman_collection.json` into Postman. The collection ships with test scripts that assert status codes, envelope shape, and the idempotency replay behavior. Set (or leave) the `baseUrl` collection variable at `http://localhost:3000/api/v1`.

## Project structure

```
src/
├── config/          Environment loading and validation
├── mocks/           Fake domain data (students, companies, jobs, applications)
├── routes/          URL → controller mapping
├── controllers/     Request/response wiring
├── services/        Business logic
│   └── repositories/  Data-access layer (swap point for a real DB)
├── validators/      Input validation
├── utils/           apiResponse, ApiError, asyncHandler, paginate
├── middleware/      Central error handling + logging
├── docs/            openapi.yaml (served at /api/docs)
├── app.js           Express app assembly
└── server.js        Server bootstrap
```

## Notes

- `.env` is gitignored. Copy `.env.example` and fill it in.
- `helmet` and `cors` are enabled by default.
