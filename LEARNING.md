# PlaceMux — What You Learned Across 7 Tasks

A tour through every concept you've hit so far, with pointers into your own code. Read top-to-bottom the first time. After that, use it as a reference — every section is self-contained.

---

## Contents

1. [How the 7 tasks connect](#0-how-the-7-tasks-connect)
2. [Task 1 — The server starts talking](#task-1--the-server-starts-talking)
3. [Task 2 — The API becomes a contract](#task-2--the-api-becomes-a-contract)
4. [Task 3 — Architecture: features, layers, conventions](#task-3--architecture-features-layers-conventions)
5. [Task 4 — A real database](#task-4--a-real-database)
6. [Task 5 — The persistence layer](#task-5--the-persistence-layer)
7. [Task 6 — Authentication & security](#task-6--authentication--security)
8. [Task 7 — Validation & sanitisation](#task-7--validation--sanitisation)
9. [The whole vocabulary in one place](#the-whole-vocabulary-in-one-place)

---

## 0. How the 7 tasks connect

Think of the backend as a series of concentric rings around your data. Each task added one ring.

```
┌──────────────────────────────────────────────────────────────┐
│  Task 6 + 7  Validation, sanitisation, auth, authorization   │  ← who can call, what shape
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Task 3           Routes → Controllers → Services      │  │  ← layer contract
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  Task 5   Repositories, transactions, pooling    │  │  │  ← safe DB access
│  │  │  ┌────────────────────────────────────────────┐  │  │  │
│  │  │  │  Task 4   PostgreSQL, schema, constraints  │  │  │  │  ← storage
│  │  │  └────────────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │  Task 2           Response envelope, status codes      │  │  ← contract
│  └────────────────────────────────────────────────────────┘  │
│  Task 1           Node.js + Express server                   │  ← process
└──────────────────────────────────────────────────────────────┘
```

Each ring depends only on the rings inside it. Your `authenticate` middleware (Task 6) doesn't know about Postgres — it just calls the user repository. The user repository doesn't know about auth — it just runs a query. This decoupling is the whole point of "layered architecture" and it's the single biggest idea across all 7 tasks.

---

# Task 1 — The server starts talking

**Goal:** Get a Node.js process running that answers HTTP requests. Everything else in the track lives inside this process.

## Vocabulary

| Term | Meaning |
|---|---|
| **Node.js** | A runtime that lets JavaScript run outside a browser. It's the OS-level process your server is. |
| **npm** | Node's package manager. `package.json` is the manifest; `node_modules/` is where downloaded code lives. |
| **Express** | A tiny library that maps "URL + HTTP method" to "function that runs". Not opinionated — you assemble the pieces. |
| **Route** | The pair `(method, path)` that triggers a handler. `GET /health`. |
| **Handler** | The function that runs when a route matches. Takes `(req, res, next)`. |
| **Middleware** | A function that runs between the request arriving and your handler responding. Chains: `logger → parser → auth → your handler`. |
| **Port** | A number (3000) your server listens on. Only one process per port at a time. |
| **Environment variable** | A config value set outside the code — `process.env.PORT`. Kept in `.env` locally, in a secrets manager in production. Never hard-code secrets. |
| **dotenv** | The library that reads `.env` into `process.env`. |
| **Nodemon** | A dev helper that restarts the server automatically on file save. |

## The mental model

A request arrives → Express matches it against your routes → runs any middleware in order → runs the handler → the handler writes a response → done.

```js
GET /api/v1/health
       ↓
[helmet] → [cors] → [json parser] → [logger] → [route handler] → response
```

Each function calls `next()` to pass control to the next one, or writes a response to end the chain.

## What you built

- **[src/server.js](src/server.js)** — the entry point. Boots the app on a port, handles graceful shutdown on `SIGINT`.
- **[src/app.js](src/app.js)** — assembles the Express app: middleware stack, routes, error handler.
- **[src/config/env.js](src/config/env.js)** — the *only* file that reads `process.env`. Everything else imports from here. This is a discipline; it stops config from being scattered across 40 files.
- **[.env](/.env)** vs **[.env.example](/.env.example)** — real values (gitignored) vs a blank template (committed). The example file is what a teammate copies to bootstrap.

## Key concepts explained

### Why we split routes, controllers, services

Even at Task 1 we didn't put everything in one file. Reason: **each layer has one job**.

- **Routes** — "when someone calls `GET /health`, run this function". No `if`, no data, no logic. Just wiring.
- **Controllers** — unpack the request, call a service, format the response. Never contain business rules.
- **Services** — the actual thinking. Given clean inputs, produce a result. Never touches `req` or `res`.

You'll appreciate why this matters in Task 3 (when you have 25 endpoints) and Task 5 (when you can call services from a script with no HTTP server running, and it still works). See [`scripts/demo-service.js`](scripts/demo-service.js).

### `.env` and `.gitignore` — the security habit

`.env` holds secrets. Committing it to git leaks them to anyone who can read the repo (including yourself six months later on a public GitHub gist you forgot about). `.env` in `.gitignore` + `.env.example` committed = the correct pattern. Every language and framework has this same pattern; internalise it once.

### Error handling from day one

Your `notFound` and `errorHandler` middleware go **last** in the chain. Express calls them when nothing else matched. If you put them at the top, they intercept every request. This is a common bug — remember: error handlers run at the end.

### Graceful shutdown

Pressing Ctrl+C sends `SIGINT`. If your server just dies, in-flight requests get cut off and open connections leak. The pattern:

```js
process.on('SIGINT', () => {
  server.close(() => process.exit(0));  // stop accepting new requests, finish in-flight, then exit
});
```

You extended this in Task 4 to also disconnect from the database.

## The one thing to remember from Task 1

**Config lives in one place, secrets never in git, layers separate from day one.** Even for a "hello world" server. The habits scale; the shortcuts don't.

---

# Task 2 — The API becomes a contract

**Goal:** Serve fake data that looks and behaves *exactly* like real data will, so a frontend team can start building against it today.

## Vocabulary

| Term | Meaning |
|---|---|
| **Contract** | The agreement about what URLs exist, what shapes you send/receive, and which status codes appear. Breaking it costs your teammates a day. |
| **Envelope** | A wrapper around every response so all responses parse the same way. Ours: `{ success, data, meta? }` or `{ success, error }`. |
| **Status code** | 3-digit number that categorises the response: 2xx success, 4xx your fault, 5xx my fault. |
| **Idempotency** | Doing the same thing twice gives the same result as doing it once. Critical when a client retries. |
| **OpenAPI / Swagger** | A standard file format for describing an API. Feed it to a tool → browsable, executable docs. |
| **Pagination** | Returning results 20 at a time instead of all 50,000. |
| **Filter / sort / expand** | Query-string features so the client only asks for what it wants. |
| **Mock** | Fake data that looks real. Not `"test123"` — real names, real cities. |

## The mental model

The frontend team can't wait for the database. So you promise them:

> "Here's the URL, here's the shape you'll get back, here are the exact status codes. This works today with fake data; it'll work the same way with real data in a few weeks."

That promise is the **API contract**. Once it's written down and running, other teams can build against it in parallel.

## What you built

- **[src/modules/*/](src/modules/)** — per-resource routes, controllers, services, repositories, validators
- **[src/shared/http/apiResponse.js](src/shared/http/apiResponse.js)** — the `success()` helper that formats every response identically
- **[src/shared/errors/ApiError.js](src/shared/errors/ApiError.js)** — one class for every error, with static helpers (`ApiError.notFound(...)`, `ApiError.conflict(...)`, etc.)
- **[src/shared/middleware/errorHandler.js](src/shared/middleware/errorHandler.js)** — one function turns any thrown `ApiError` (or unknown error) into a properly-formatted response
- **[src/docs/openapi.yaml](src/docs/openapi.yaml)** — the machine-readable contract, served at `/api/docs` as an interactive Swagger UI
- **[postman/PlaceMux.postman_collection.json](postman/PlaceMux.postman_collection.json)** — pre-canned requests so the frontend team can click through your API

## Key concepts explained

### HTTP status codes — the vocabulary you actually use

You don't need to memorise all 60 codes. This handful covers 99% of everything:

| Code | Meaning | When |
|---|---|---|
| **200 OK** | It worked | Reads, updates, idempotent retries |
| **201 Created** | New resource made | Successful POST that created something |
| **204 No Content** | Worked, nothing to say | Successful DELETE |
| **400 Bad Request** | You sent me nonsense | Malformed query, unknown filter |
| **401 Unauthorized** | I don't know who you are | Missing/bad token |
| **403 Forbidden** | I know who you are, you can't do this | Wrong role |
| **404 Not Found** | No such thing | Bad URL or nonexistent record |
| **409 Conflict** | State collision | Duplicate email, illegal state transition |
| **422 Unprocessable Entity** | Well-formed but semantically invalid | Body failed validation |
| **429 Too Many Requests** | Slow down | Rate limit |
| **500 Internal Server Error** | I broke | Bug on the server |
| **503 Service Unavailable** | I can't help right now | Database down |

**Rule of thumb**: any 4xx is the client's problem, any 5xx is yours. If you're returning 500 for something the client could have avoided (bad input, duplicate email), you're miscategorising the error.

### The response envelope — why every response has the same shape

Compare these two client experiences:

```js
// Without an envelope — every endpoint invents its own shape
GET /students → [{ ... }, { ... }]                    // array
GET /students/1 → { id: 1, ... }                       // object
GET /students?error → { message: "bad request" }       // different object

// With an envelope — one shape everywhere
GET /students → { success: true, data: [ ... ], meta: { ... } }
GET /students/1 → { success: true, data: { ... } }
GET /students?error → { success: false, error: { code, message, details } }
```

The client writes one parser, not one per endpoint. When something changes (say, adding pagination), old clients keep working because the shape is consistent.

### Error codes vs error messages

```json
{ "success": false, "error": { "code": "RESOURCE_NOT_FOUND", "message": "Student stu_999 was not found" } }
```

The **code** is stable, machine-readable, and used by the client to decide what to do (`if (code === 'RESOURCE_NOT_FOUND') showEmptyState()`). The **message** is for humans and can be reworded any time.

Bad code:
```js
// ❌ Fragile — a typo fix breaks the client
if (error.message === 'Student not found') { ... }
```

Good code:
```js
// ✅ Stable
if (error.code === 'RESOURCE_NOT_FOUND') { ... }
```

### Idempotency — the client double-click problem

A user clicks "Apply". The button doesn't respond fast enough. They click again. Now they've applied twice.

Solution: the client sends an `Idempotency-Key` header. The server records it. Second time it sees the same key, it returns the original response instead of doing the work again.

```
POST /applications              Idempotency-Key: abc-123  →  201 { id: app_42 }
POST /applications              Idempotency-Key: abc-123  →  200 { id: app_42 }  (same!)
POST /applications  (no key, same body)                    →  409 (natural-key duplicate)
```

You implemented all three cases. See [src/modules/applications/application.service.js](src/modules/applications/application.service.js) → `createApplication`.

**Why two 200s and not 201s on replay?** 201 means "I created something new". Since you didn't, 200 is the honest answer.

### Pagination that doesn't break under real data

Even in the mock you paginate. Reason: if you don't, the frontend never builds pagination controls, and when 50,000 records land in production, the frontend has to be rewritten.

Your `meta.pagination` shape:
```json
{ "page": 1, "limit": 20, "total": 42, "totalPages": 3, "hasNext": true, "hasPrev": false }
```

Everything the frontend needs to draw "Page 1 of 3" + prev/next buttons.

### OpenAPI / Swagger — self-documenting the contract

`openapi.yaml` describes the API in a standard format. `swagger-ui-express` renders it as an interactive HTML page at `/api/docs`. Now the API isn't just documented — it's *explorable*: click a route, fill in the params, hit "Try it out", see the response.

This becomes essential the moment a second team consumes your API.

## The one thing to remember from Task 2

**Contracts are what make parallel work possible.** Once you've published a route table with response shapes and status codes, other people can build against it without waiting for you. Breaking that contract later is expensive; getting it right up front is cheap.

---

# Task 3 — Architecture: features, layers, conventions

**Goal:** Reorganise everything so it stays comprehensible at 50 endpoints, 5 engineers, 6 months from now.

## Vocabulary

| Term | Meaning |
|---|---|
| **Resource** | A noun the API exposes: students, jobs, companies. Roughly, anything with an ID. |
| **Cardinality** | The count on each side of a relationship: 1:1, 1:N, N:M. |
| **Layer** | A horizontal slice of the code with one responsibility. Route, controller, service, repository. |
| **Separation of concerns** | Each layer does its job and nothing else. |
| **Coupling** | How much one piece depends on another. Low coupling = you can change one thing without touching five others. |
| **Cohesion** | How related the things inside one module are. High cohesion = good. |
| **Convention** | A rule everyone follows so nobody has to think. |
| **Offset pagination** | `?page=2&limit=20`. Simple; unstable under concurrent inserts. |
| **Cursor pagination** | `?cursor=abc&limit=20`. Stable; slightly harder. |
| **ADR** | Architecture Decision Record. A short note explaining *why* you chose X over Y. |
| **DTO** | Data Transfer Object. The shape you send out — which is *not* the shape you store. |

## The mental model

Two organisational choices are always available:

**By layer:**
```
routes/       ← all routes
controllers/  ← all controllers
services/     ← all services
```

**By feature (which is what you switched to):**
```
modules/
  students/
    student.routes.js
    student.controller.js
    student.service.js
    ...
  companies/
    ...
```

The layered organisation looks tidy at 5 endpoints and becomes a nightmare at 50 — adding one feature touches 6 different folders. Feature modules keep everything about one thing in one place: **high cohesion, low coupling** made physical.

## What you built

- **[src/modules/](src/modules/)** — one folder per resource, each holding its 7-file family
- **[src/shared/](src/shared/)** — cross-cutting code (errors, http helpers, middleware, query parser)
- **[src/shared/query/queryParser.js](src/shared/query/queryParser.js)** — one function that handles pagination, filtering, sorting, sparse fields, expansion for every list endpoint
- **[src/routes.js](src/routes.js)** — the single mount point; adding a new resource is a one-line change here
- **[src/docs/ARCHITECTURE.md](src/docs/ARCHITECTURE.md)** — the ERD, invariants (INV-1..INV-8), route conventions (R1..R10), layer contract
- **[src/docs/adr/](src/docs/adr/)** — the "why" behind each decision
- **[scripts/demo-service.js](scripts/demo-service.js)** — runs your service layer with no HTTP server, *proving* the layer boundary is real
- `npm run check:layers` — a grep-based CI check that fails if a service or repository imports `req`/`res`

## Key concepts explained

### The layer contract, one more time

```
route → controller → service → repository → data source
   ↑         ↑          ↑           ↑            ↑
 mapping   parse    business     data          storage
            +req    rules       access
```

Rules that make this real:

- Route files contain **no logic** — just URL → handler mapping.
- Controllers **never** contain business rules. Parse → call service → format response. Same four moves every time.
- Services **never** touch `req` or `res` — that's the test: could you call this from a script? Yes → boundary clean.
- Repositories only access data. No business rules. Every method `async` for future DB compatibility.

`npm run check:layers` fails the build if you break it. `npm run demo:service` proves it works.

### The "dependencies point downward" rule

```
route  →  service   ✓
service → repository ✓
service → route      ✗  (cycle!)
repository → service ✗  (backwards!)
```

Two services can call each other, but keep it shallow and one-directional. Cycles are a sign that your abstractions are wrong — extract the shared piece into a third module.

### Route conventions (R1..R10) — the rulebook

Rules can be checked; taste can't. Excerpts:

| Rule | Example |
|---|---|
| R1: Plural, hyphenated nouns | `/students`, `/interview-rounds` — never `/getStudents` |
| R2: HTTP method is the verb | `POST /applications`, not `POST /createApplication` |
| R3: Version prefix everywhere | `/api/v1/...` |
| R5: Nesting to ONE level, for owned children | `/companies/:id/jobs` ✓, `/companies/:id/jobs/:id/applications/:id` ✗ |
| R6: Nested collection is a *read-only* convenience. Canonical write path is flat | `POST /applications` (with jobId in body), not `POST /jobs/:id/applications` |
| R7: Non-CRUD actions become a sub-resource noun | `POST /applications/:id/withdrawal` |
| R8: Filters/sort/paging in query string, not path | `/jobs?type=internship`, not `/jobs/internships` |
| R9: PATCH partial, PUT full replace, DELETE remove | |
| R10: Response shape identical across resources | The envelope |

**Why nesting is dangerous.** `/companies/:id/jobs/:id/applications` looks organised until you realise applications *also* belong to students. Now `/students/:id/applications/:id` is a second URL for the same thing, and clients disagree about which is canonical. **One canonical, flat path per resource for writes. One level of nested reads for convenience.**

### The shared query parser

Every list endpoint accepts:

```
?page=1&limit=20              # pagination
?sort=-createdAt,name         # sorting, `-` = descending
?status=seeking&branch=CS     # filters (allow-listed per module)
?fields=id,name               # sparse fieldsets
?expand=company               # inline related resource
?search=aarav                 # free text
```

All of that runs through one function ([`queryParser.js`](src/shared/query/queryParser.js)). Each module declares what it supports in a schema file:

```js
// src/modules/jobs/job.queryschema.js
module.exports = {
  filterable: ['companyId', 'type', 'location', 'minStipend', 'skill'],
  sortable: ['createdAt', 'deadline', 'stipend', 'title'],
  selectable: [...],
  expandable: ['company'],
};
```

**Unknown filters return 400** with the list of valid ones. Silent tolerance is a bug — if someone typos `?statuss=seeking`, they see a clear error rather than debugging why their filter "didn't work". This is ADR-003.

### Offset vs cursor pagination (ADR-002)

|  | Offset (`?page=2&limit=20`) | Cursor (`?cursor=abc`) |
|---|---|---|
| Easy to implement | ✓ | Moderate |
| Jump to page 47 | ✓ | ✗ |
| Show total count | ✓ | Usually not |
| Stable during concurrent inserts | ✗ (rows shift, duplicates or gaps) | ✓ |
| Fast at 100k+ rows | Degrades | Constant |

You chose offset for v1 because the UI needs page numbers. `meta.pagination` is a nested object, so cursor fields (`nextCursor`, `prevCursor`) can be added later without breaking existing clients — additive change, not breaking.

### DTOs — separating stored shape from sent shape

Storage shape: `{ id, name, ..., idempotencyKey, deletedAt, __internalNotes }`
Sent shape: `{ id, name, ... }`  ← no internal fields

The `<module>.dto.js` file is the boundary. Without it, adding an internal field silently leaks it to every client.

## The one thing to remember from Task 3

**Structure is a rule, not taste.** Feature modules, layer boundaries, route conventions — all of them are enforceable by tests (`check:layers`, coverage checks). Rules you can enforce are the ones that survive contact with reality.

---

# Task 4 — A real database

**Goal:** Replace the in-memory arrays with PostgreSQL. Make the database itself refuse bad data — not just the app.

## Vocabulary

| Term | Meaning |
|---|---|
| **Table** | A spreadsheet-like collection of rows. Roughly, one per entity. |
| **Row / record** | One student, one job. |
| **Column / field** | One attribute with a fixed type. |
| **Primary key (PK)** | The column that uniquely identifies a row. Never null, never reused. |
| **Foreign key (FK)** | A column pointing at another table's PK. The DB enforces the target exists. |
| **Constraint** | A rule the DB refuses to break: NOT NULL, UNIQUE, CHECK, FK. |
| **Normalisation** | Organising data so each fact is stored exactly once. |
| **Anomaly** | Update / insert / delete anomaly — the four bugs you get from un-normalised data. |
| **Index** | A lookup structure that makes reads fast at the cost of slower writes and more disk. |
| **Migration** | A versioned SQL file that changes the schema. Your DB's git history. |
| **Cascade / restrict** | What happens to child rows when the parent is deleted. |
| **ORM** | Object-Relational Mapper. Prisma lets you write JS instead of SQL. |
| **Seed** | A script that fills a fresh DB with starter data. |
| **cuid** | A style of primary key: globally unique, monotonic by creation time, unguessable. |
| **Soft delete** | Mark deleted with a `deletedAt` timestamp instead of actually removing the row. |
| **Timestamptz** | PostgreSQL timestamp WITH timezone. Never use the one without. |

## The mental model

Your app can validate all it wants — but the app isn't the only thing that touches the database. Migrations, seed scripts, admin SQL sessions, analytics jobs all bypass it. So:

- **App validation** → helpful error messages ("cgpa must be 0-10").
- **DB constraint** → *guarantee* that the value will never enter storage no matter who tries.

Both are needed. This is **defence in depth**.

## What you built

- **[prisma/schema.prisma](prisma/schema.prisma)** — 10 tables + 4 enums declared in Prisma's schema language
- **[prisma/migrations/20260722070516_init/migration.sql](prisma/migrations/20260722070516_init/migration.sql)** — the generated SQL, hand-augmented with 10 CHECK constraints, 4 custom indexes, `pg_trgm` extension
- **[prisma/seed.js](prisma/seed.js)** — idempotent seed (upserts throughout — running it twice creates nothing new)
- **[scripts/prove-constraints.js](scripts/prove-constraints.js)** — fires 11 intentionally-bad writes directly through Prisma, all rejected by the DB with the API bypassed entirely
- **[docs/DATA-MODEL.md](docs/DATA-MODEL.md)** — the ERD, FK cascade table, all 11 constraints with the bad-data each blocks, normalisation walkthrough

## Key concepts explained

### Why hashing beats encryption for passwords (jumps ahead — but relevant here)

You don't want to *ever* be able to read passwords. Encryption is reversible (that's the point). Hashing is one-way. See Task 6 for the full story.

### Why to hash for password *storage* and NOT for row IDs

- Password storage: hash so nobody (not even you) can read the plaintext.
- Row IDs: pick a scheme that's global-unique + unguessable + fast-to-generate. That's what **cuid** does.

Three options, why cuid won (ADR-0004):

| | Pros | Cons |
|---|---|---|
| `SERIAL` (1, 2, 3, ...) | Small, readable | Leaks how many rows exist; guessable in URLs |
| `UUID v4` | Global unique, random | 16 bytes; random order hurts DB index performance |
| **`cuid`** | Global unique + unguessable + **sortable by creation time** | Slightly larger than integer |

Sortable IDs matter because new rows append to the end of the DB's B-tree indexes rather than scattering — meaningfully better performance at scale.

### Normalisation, worked through

Beginner instinct: put everything in one big table.

```
| app_id | student_name | student_email | job_title | company_name | company_city | skills            | status |
| 1      | Aarav        | aarav@x       | Backend   | Nimbus       | Bengaluru    | Node.js,SQL       | ...    |
| 2      | Aarav        | aarav@x       | Frontend  | Nimbus       | Bengaluru    | Node.js,SQL       | ...    |
| 3      | Diya         | diya@x        | Backend   | Nimbus       | Bengaluru    | React             | ...    |
```

Now find the bugs — the **four anomalies**:

- **Update anomaly**: Nimbus moves to Pune. You have to update 3 rows. Miss one → the DB now claims Nimbus is in two cities.
- **Insert anomaly**: New company hasn't posted a job yet. There's no row you can put it in without inventing a fake application.
- **Delete anomaly**: Delete app 3 and Diya vanishes from the system entirely.
- **Repeating group**: `skills = "Node.js, SQL"` breaks queries — `LIKE '%SQL%'` matches "NoSQL" too.

Fix these with three normal forms:

- **1NF** — one atomic value per cell. Split `skills` into a `skills` table plus a `student_skills` join table.
- **2NF** — every non-key column depends on the *whole* primary key. (Only matters with composite PKs — irrelevant here except for join tables.)
- **3NF** — no non-key column depends on another non-key. `company_city` depends on `company_name` (transitive). Fix: companies get their own table; jobs reference them.

**Stop at 3NF for 95% of apps.** Higher forms exist and you will essentially never need them.

### When to deliberately *un-normalise*

**Point-in-time snapshots.** When a student is placed, record salary + title on the placement row even though those live on the job. Not redundancy — a historical fact. If the job's salary changes next year, the placement record must not change with it.

**Counters (deferred).** `companies.job_count` avoids a `COUNT(*)` per list request — but drifts out of sync. Don't add until you can measure it matters.

### Foreign keys and the RESTRICT vs CASCADE decision

For every FK you must answer: **when the parent is deleted, what happens to the children?**

| Behaviour | Meaning | Use when |
|---|---|---|
| **RESTRICT** | Refuse the delete while children exist | The children are valuable — deleting must be a conscious act |
| **CASCADE** | Delete the children too | The children are meaningless without the parent |
| SET NULL | Keep the children, null the link | The link is optional |

Your choices (ADR-0007):

- `jobs.company_id → companies` → **RESTRICT**. Deleting a company must not silently vaporise its job history.
- `applications.job_id → jobs` → **RESTRICT**. An application is a record of a real action.
- `student_skills.student_id → students` → **CASCADE**. Skill link is meaningless without the student.
- `interviews.application_id → applications` → **CASCADE**. Interview only exists as part of an application.

**Rule of thumb**: cascade join/attachment rows; restrict anything a human would be upset to lose.

### Constraints — what the DB itself refuses

| Constraint | Example | Stops |
|---|---|---|
| **NOT NULL** | `email NOT NULL` | Half-created records |
| **UNIQUE** | `email UNIQUE` | Two accounts on one email |
| **Composite UNIQUE** | `(student_id, job_id)` | Applying to the same job twice |
| **CHECK** | `cgpa BETWEEN 0 AND 10` | CGPA of 47 |
| **CHECK across columns** | `status='WITHDRAWN'` iff `withdrawn_at IS NOT NULL` | Two columns disagreeing |
| **ENUM** | `status IN ('submitted', ...)` | Status of `'shortlissted'` |
| **FK** | `job_id → jobs(id)` | Applications to jobs that don't exist |

Your `chk_applications_withdrawn_consistency` is the star example — it spans two columns, so no amount of field-level validation could express it. Only the database can. That's the reason DB constraints exist.

Prove it: `npm run db:constraints` fires 11 bad writes with the API bypassed; all 11 rejected.

### Indexes — plan from queries, not intuition

An index is a sorted lookup structure. It makes reads faster but every insert/update/delete must also maintain the index. **So**:

- Index a column only if a query actually filters/sorts on it.
- Composite index order matters: **equality columns first, then range/sort**. `(city, type, deadline)` serves `WHERE city=? AND type=? AND deadline > ?` but not `WHERE type=?` alone.
- **Partial indexes** filter the index itself: `WHERE deleted_at IS NULL` means the index only covers live rows — smaller and faster.
- Prove an index helps: run `EXPLAIN ANALYZE` before and after at realistic data volume.

### Migrations — the DB's git history

Rules:
1. Every schema change is a migration file, committed to git.
2. Applied migrations are **immutable** — once merged, never edit. Write a new one instead.
3. `migrate deploy` (never `reset`) in production. Reset drops the database.
4. Name descriptively: `add_application_events`, not `update2`.

### The "expand and contract" pattern for breaking changes

Renaming a column `name → first_name/last_name` in one migration breaks every running instance the moment it runs. Instead:

1. **Expand** — add the new columns as nullable. Old code ignores them.
2. **Backfill + dual-write** — a migration copies data; app writes both.
3. **Contract** — once nothing reads the old column, drop it.

Not needed in Phase 1, but knowing the pattern is a big-vs-small deal at scale.

### Money and timestamps

- **Money as INTEGER paise**, never a float. `0.1 + 0.2 !== 0.3` in floating point. Accumulate a few thousand of those and payroll disagrees with itself.
- **`@db.Timestamptz`**. Never `timestamp` (no timezone) — you'll get bugs the moment users are in two zones. Store UTC, format on the client.

## The one thing to remember from Task 4

**The database is your last line of defence.** The API can validate, sanitise, authorize all it wants — but the constraints in the schema are the guarantees that survive when everything else fails.

---

# Task 5 — The persistence layer

**Goal:** Make the code that talks to the database safe, atomic, and bounded — under concurrency, under attack, under load.

## Vocabulary

| Term | Meaning |
|---|---|
| **SQL injection** | An attacker sends input that becomes *part of the query* instead of data. OWASP top-10 forever. |
| **Parameterised query** | Query template and values sent separately. The fix for injection. |
| **Transaction** | A group of writes that all succeed or all fail. No half-states. |
| **ACID** | Atomicity, Consistency, Isolation, Durability — the four guarantees. |
| **Rollback** | Undo everything in the transaction as if it never happened. |
| **Isolation level** | How strictly the DB prevents transactions from seeing each other's uncommitted work. |
| **Connection pool** | A fixed set of reusable DB connections shared between requests. |
| **Connection leak** | A connection borrowed and never returned. Enough of them → app freezes. |
| **Race condition** | Two requests interleave badly and produce a result neither would alone. |
| **Optimistic lock** | Assume no conflict; detect at write via a version number. |
| **Pessimistic lock** | Lock the row up front (`SELECT ... FOR UPDATE`). |
| **N+1 query** | Fetching a list, then one extra query per item. 1 + N when 2 would do. |
| **Integration test** | Test that runs against a real DB, not a fake. |

## The mental model

Task 4 built the vault. Task 5 is the procedure for opening it — who's allowed in, what happens if the power cuts halfway through, how many people can be inside at once.

## What you built

- **[src/shared/prisma.js](src/shared/prisma.js)** — one singleton PrismaClient for the process, with pool config from env
- **[src/shared/transactions.js](src/shared/transactions.js)** — `runInTransaction(fn)` — the *only* way for a service to compose transactions across repositories
- **[src/shared/dbErrorTranslator.js](src/shared/dbErrorTranslator.js)** — Prisma error codes → your API error catalogue
- **[src/shared/middleware/queryCounter.js](src/shared/middleware/queryCounter.js)** — warns on any request that runs > 10 queries (N+1 canary)
- **[src/modules/*/*.db.repository.js](src/modules/)** — every method takes an optional trailing `client` param for transaction composition
- **[scripts/prove-injection-safe.js](scripts/prove-injection-safe.js)** — 6 hostile payloads; all inert
- `npm run check:prisma-boundary` — grep fails if any non-repo file imports prisma

## Key concepts explained

### SQL injection — the classic, and why parameterisation kills it

**Vulnerable:**

```js
const email = req.query.email;    // "' OR '1'='1"
db.query(`SELECT * FROM students WHERE email = '${email}'`);
// →  SELECT * FROM students WHERE email = '' OR '1'='1'
// →  returns every row
```

**Safe:**

```js
db.query('SELECT * FROM students WHERE email = $1', [email]);
```

The query template and the values travel separately. Postgres parses the query first (its structure is fixed forever), then plugs values into slots. `' OR '1'='1` becomes a literal search string. Zero rows returned. Exactly right.

**Escaping is the wrong fix.** Escaping is a blocklist — you're trying to enumerate every dangerous character, and someone always finds the encoding you missed. Parameterisation is structural: there's no path from data to code.

### Prisma parameterises automatically — except one place

- `prisma.student.findMany({ where: { email } })` → safe
- `prisma.$queryRaw\`... email = ${email}\`` → safe (tagged template — Prisma intercepts `${}` and turns it into a parameter)
- `prisma.$queryRawUnsafe('... email = "' + email + '"')` → **VULNERABLE**. Banned in your codebase.

### The one thing you can't parameterise

Identifiers — table names, column names, sort direction. `ORDER BY $1` doesn't work. **Solution**: allowlist. Never take a sort column from the user directly; match it against a fixed list first.

You already had this in Task 3's `queryParser` — same lesson.

### The repository boundary (ADR-0009)

**Rule**: only `*.repository.js` files may import Prisma. Every service must reach the DB through a repository.

Enforced by `npm run check:prisma-boundary`:

```bash
grep -rl "@prisma/client\|shared/prisma" src/modules | grep -v ".repository.js"
```

If that produces any output, the check fails.

**Why**: swapping the ORM (or the DB itself) later means changing the repository files, not the entire codebase. Also, services stay testable without spinning up a full Prisma client.

**Legitimate exceptions**: transaction composition needs *something* like `prisma.$transaction`. Encapsulated in `runInTransaction(fn)` inside `shared/`, not in a module. Same for the `/ready` DB probe — lives in `health.repository.js`, not the service.

### Transactions — when to reach for one

> If a single logical operation writes to more than one row, it needs a transaction.

In your app:

| Operation | Writes | Why atomic |
|---|---|---|
| Apply to a job | `applications` + `application_events` | An application with no audit trail is corrupt |
| Accept an offer | The accepted app + N withdrawn apps + student status + job openings | Half of this leaves a student both placed and still applying |
| Register | `users` + `students` | User without a student profile is dangling |

**Without a transaction:**

```js
const app = await appRepo.create({...});
// crash here → app exists with no event, forever silently corrupt
await eventRepo.create({...});
```

**With:**

```js
await runInTransaction(async (tx) => {
  const app = await appRepo.create({...}, tx);
  await eventRepo.create({...}, tx);
});
// crash anywhere → Postgres rolls back both
```

### Transaction composability — the `client` param pattern (ADR-0010)

Every repository method takes an optional trailing `client` param defaulting to the singleton:

```js
findById: async (id, client = prisma) => { ... }
create: async (data, client = prisma) => { ... }
```

A service starts a transaction and passes `tx` down to any repo call:

```js
await runInTransaction(async (tx) => {
  const app = await appRepo.findById(id, tx);        // uses tx
  await appRepo.update(id, { status: 'x' }, tx);      // uses tx
  await studentRepo.update(studentId, { ... }, tx);   // uses tx (different repo!)
});
```

Repos neither know nor care whether they're in a transaction. Same interface either way.

### Transaction rules

- **Short.** Every open transaction holds locks + a connection.
- **No external calls inside.** A slow HTTP call holds the lock for its whole duration.
- **Throw to roll back.** Never catch-and-swallow inside — catching means "handled", so it commits.
- **Explicit timeout.** Prisma defaults to 5s. Raise deliberately.

### Isolation levels (very briefly)

|  | Prevents | Cost |
|---|---|---|
| **Read Committed** (Postgres default) | Dirty reads | Low |
| Repeatable Read | + non-repeatable reads | Medium |
| **Serializable** | + phantom reads; behaves as if txs ran one at a time | Highest; must handle retry |

You default to Read Committed. Serializable only for check-then-act sequences that must be exact — usually a DB constraint (like your composite UNIQUE) or an atomic increment is simpler.

### Concurrency — the lost update, and three defences

Two recruiters accept a candidate for a 1-opening job. Both read `openings: 1`. Both write `openings: 0`. You've made two offers for one seat. 

Three defences (ADR-0012):

1. **Atomic DB operation** — `data: { openings: { decrement: 1 } }`. Single UPDATE, no read-modify-write. Combined with `CHECK (openings > 0)`, over-allocation becomes structurally impossible.

2. **Composite UNIQUE** — `(student_id, job_id)`. Two concurrent identical POSTs → exactly one succeeds, others rejected with P2002.

3. **Optimistic version column** (deferred) — `UPDATE ... WHERE id=? AND version=?` bumps a version. Zero rows updated = someone else got there first → 409, client retries.

You chose 1 and 2 for Phase 1 (verified in `tests/concurrency.test.js`). Optimistic locking added later if a hot row surfaces a lost-update bug.

### Connection pooling

Opening a Postgres connection costs 20–50ms (TCP + auth + session). One per request would be ruinous. Instead: a **pool** opens N connections once, lends them out.

**Sizing** — start with `(cores × 2) + spindles`. For a 4-core SSD dev box: ~10. Then:

```
instances × pool_size < max_connections − reserve_for_admin_tools
```

Postgres default `max_connections = 100`. 4 instances at 25 = exactly 100 → your next `psql` login fails. 4 at 15 leaves headroom. Configurable via `DB_POOL_SIZE`.

**Three ways people leak connections**:

- `new PrismaClient()` inside a handler → new pool per request → exhausts `max_connections` within minutes
- Long transaction with an HTTP call inside → holds a connection for seconds
- No `$disconnect()` on shutdown → connections linger

Your singleton in `shared/prisma.js` handles the first. Your graceful shutdown (`server.close(...)` → `prisma.$disconnect()`) handles the third. Order matters: close server first (finish in-flight), then close pool.

### Error translation — never let a Prisma error reach the client

Raw Prisma errors leak table names, column names, sometimes values. Translated in one place ([`dbErrorTranslator.js`](src/shared/dbErrorTranslator.js)):

| Prisma code | → | API |
|---|---|---|
| P2002 (unique violated) | | 409 `RESOURCE_CONFLICT` |
| P2003 (FK violated) | | 400 `BAD_REQUEST` |
| P2025 (record not found) | | 404 `RESOURCE_NOT_FOUND` |
| Postgres 23514 (CHECK failed) | | 422 `VALIDATION_FAILED` |

**Two rules**:
1. Never let a raw driver error reach the client.
2. Translate in one place — every service catching individually gives inconsistent messages.

### N+1 — the most common performance bug in web apps

```js
// ❌ 1 + N queries
const students = await prisma.student.findMany({ take: 20 });
for (const s of students) {
  s.skills = await prisma.studentSkill.findMany({ where: { studentId: s.id } });
}
// 21 queries for 20 students
```

```js
// ✅ 2 queries total, always
const students = await prisma.student.findMany({
  take: 20,
  include: { studentSkills: { include: { skill: true } } },
});
```

Your `queryCounter` middleware logs a warning above 10 queries per request. Cheap canary that catches this the day it's introduced.

### Testing (the part the brief actually cares about)

- **Separate test DB** (`placemux_test`). Never truncate your dev DB.
- **`jest --runInBand`** — file-by-file, not parallel. Parallel test files sharing a DB interfere.
- **Truncate children-before-parents** in `beforeEach` (FKs enforce the order).
- **Failure tests matter more than happy paths.** Duplicate, missing FK, missing record, CHECK, injection, rollback, concurrency.

Your matrix (21 tests, then 42, then 57 by Task 7): valid CRUD, P2002/P2003/P2025 failure paths, 6 injection payloads all inert, rollback discards partial writes, accept-offer cascade atomic, 5 concurrent applications → 1 succeeds, 5 concurrent decrements → openings never falls below 1.

## The one thing to remember from Task 5

**Safe, atomic, bounded.** Every DB interaction must be parameterised (safe), transactional if it writes to multiple rows (atomic), and use the pool with a hard cap (bounded). Every claim backed by a test.

---

# Task 6 — Authentication & security

**Goal:** Prove who's calling, and check what they're allowed to do — on every single request.

## Vocabulary

| Term | Meaning |
|---|---|
| **Authentication (authn)** | Who are you? Fails with 401. |
| **Authorization (authz)** | What are you allowed to do? Fails with 403. |
| **Hash** | One-way transformation. Compute forwards, never backwards. |
| **Salt** | Random data mixed into each password before hashing. Same password → different hash per user. |
| **Pepper** | A secret added to every password, stored in config (not the DB). |
| **Work factor / cost** | How deliberately slow the hash is. Higher = harder to brute-force. |
| **JWT** | JSON Web Token. Signed blob the client holds that proves who they are. |
| **Access token** | Short-lived (15 min). Sent with every request. |
| **Refresh token** | Long-lived (7 days). Only used to get a new access token. |
| **Bearer token** | A token where possession alone proves identity — like cash. |
| **RBAC** | Role-Based Access Control. Permissions attached to roles. |
| **Token rotation** | Issue a new refresh each time one is used, so stolen ones become detectable. |
| **Timing attack** | Learning secrets from how *long* a comparison takes. |
| **IDOR** | Insecure Direct Object Reference. Changing an ID in a URL to see someone else's data. OWASP #1 today. |
| **CSRF** | Trick a logged-in browser into making a request it didn't intend. |
| **XSS** | Injecting JavaScript into a page, which then steals tokens. |
| **Mass assignment** | An attacker adds `"role": "ADMIN"` to a signup body; your ORM writes it. |

## The mental model

authentication and authorization are **different questions asked at different frequencies**:

| authn | authz |
|---|---|
| **Who** are you? | **What** are you allowed to do? |
| Once at login | Every single request |
| Failure → 401 | Failure → 403 |

Confusing them is the second pitfall the brief calls out: a system with authn but no authz lets any logged-in student change an ID in the URL and read every other student's applications.

## What you built

- **User + RefreshToken models** in [prisma/schema.prisma](prisma/schema.prisma), migrated via [`add_auth_tables`](prisma/migrations/20260724072747_add_auth_tables/migration.sql)
- **[src/modules/auth/password.service.js](src/modules/auth/password.service.js)** — bcryptjs cost 12 + application pepper
- **[src/modules/auth/token.service.js](src/modules/auth/token.service.js)** — JWT + opaque refresh tokens
- **[src/modules/auth/auth.service.js](src/modules/auth/auth.service.js)** — register, login, refresh with rotation + reuse detection, logout
- **[src/shared/middleware/authenticate.js](src/shared/middleware/authenticate.js)** — verifies token on every request
- **[src/shared/middleware/authorize.js](src/shared/middleware/authorize.js)** — `requireRole`, `requirePermission`
- **[src/shared/middleware/rateLimit.js](src/shared/middleware/rateLimit.js)** — global, login, register limiters
- Helmet CSP, CORS allow-list, body size cap, cookie-parser in [src/app.js](src/app.js)
- **[docs/SECURITY.md](docs/SECURITY.md)** — threat model + route permission matrix

## Key concepts explained

### Why we hash and not encrypt

- **Encryption is reversible.** With the key you can decrypt. Someone steals the key → every password readable.
- **Hashing is one-way.** You can compute forwards, never backwards. Store `hash(password)`. At login, compute `hash(attempt)` and compare. You *never learn the password itself*, even legitimately.

### Why not SHA-256

Because SHA-256 is *fast*, and fast is what an attacker wants. A modern GPU computes billions of SHA-256 per second. An 8-char password falls in minutes.

Password hashing algorithms are **deliberately slow and memory-hungry**. bcrypt's cost 12 takes ~100ms per hash. That's imperceptible at login (once per session), but makes offline brute-force uneconomical.

### The password stack — bcryptjs + salt + pepper

```
password           → "CorrectHorseBatteryStaple"
+ pepper           → HMAC-SHA256(password, PASSWORD_PEPPER)  ← env-only secret
+ salt (bcrypt)    → random per-user, embedded in the hash
+ bcrypt cost 12   → 100ms of work
= stored hash      → "$2b$12$..."   (contains salt, cost, and hash)
```

**Salt**: same password across two users → different stored hashes. Prevents rainbow-table lookup and "crack once, unlock many".

**Pepper**: secret from server config, not stored in the DB. If someone dumps the DB but not the server config, the hashes are useless — they can't reproduce the hash even with the plaintext.

**argon2id** would be stronger (memory-hard, defeats GPU crackers). Deferred to bcryptjs because argon2 needs native compilation; you documented the tradeoff in ADR-0013.

### Password policy — length over complexity

- ≥12 characters (NIST recommendation)
- ≤128 (uncapped is a DoS — someone submits a 10MB password and your hash call becomes a denial-of-service)
- Blocklist of common passwords

Forced complexity (`Password1!`) produces predictable, weak passwords. Long passphrases are stronger and easier to remember.

### Tokens — access + refresh

|  | Access token | Refresh token |
|---|---|---|
| Format | JWT (signed) | Opaque random string |
| Lifetime | 15 minutes | 7 days |
| Storage on server | None (stateless) | DB row (hashed) |
| Sent on | Every request | Only to `/auth/refresh` |
| Purpose | Prove identity | Get a new access token |

This split gets you:
- **Statelessness** on the hot path (checking a JWT signature is cheap).
- **Revocability** where it matters (delete the refresh row → session dies).

### JWT anatomy

A JWT is three base64-encoded parts joined by dots: `header.payload.signature`.

- **Header**: `{ "alg": "HS256", "typ": "JWT" }`.
- **Payload** (claims): `{ "sub": userId, "role": "STUDENT", "iat": ..., "exp": ..., "iss": "placemux-api", "aud": "placemux-web" }`.
- **Signature**: HMAC over the first two parts using the server's secret. Anyone can *read* the payload; only the server can produce a valid signature.

### What goes IN a JWT — and what NEVER goes in

**In**: `sub`, `role`, `exp`, `iat`, `iss`, `aud`, `type: 'access'`. Small — travels on every request.

**Out**: password, hashes, personal data (phone, CGPA), anything you'd be unhappy to see published.

**A JWT is signed, not encrypted.** Anyone can paste it into jwt.io and read the payload. Signing proves it hasn't been altered — it does nothing to hide contents.

### The `alg: none` attack — and why we pin the algorithm

Old JWT spec quirk: header says `alg: none`, no signature. A naive verifier reads the header, sees "no algorithm", and accepts. Attacker forges any payload they like.

**Fix**: pin the algorithm server-side. `jwt.verify(token, secret, { algorithms: ['HS256'] })`. The token's header is ignored — you decide the algorithm.

Your `tests/auth.test.js` has a test that constructs an `alg: none` token and asserts the server rejects it.

### Refresh token rotation + reuse detection

This is the cleverest thing in the task and worth understanding fully.

**Setup**: every refresh token belongs to a `family` UUID.

**Normal flow**:

```
Client uses refresh A → server issues new refresh B (same family), revokes A → client stores B
```

**Attack — token theft**:

```
Attacker steals A, uses it → server issues C (attacker holds C)
Later, legitimate client uses A → server sees A is already revoked!
```

**Reaction**: revoke the *entire family*. Both C (attacker's) and any future refresh dies. The theft is **detected** instead of quietly ongoing for 7 days.

Without rotation, the attacker has silent access for the whole refresh lifetime. With rotation, the reuse becomes the alarm. See [`auth.service.js`](src/modules/auth/auth.service.js) → `refresh()`.

### Storing refresh tokens — hashed

`refresh_tokens.token_hash` stores SHA-256 of the token. If someone dumps the DB, they get useless hashes — same principle as password storage.

### `passwordChangedAt` and access-token revocation

Access tokens are stateless — you can't delete them individually. To force "log out everywhere" or invalidate after a password change:

- Bump `users.password_changed_at` to now
- The authenticate middleware checks `token.iat < user.passwordChangedAt` → 401 `TOKEN_REVOKED`

Every access token issued before that instant becomes invalid on next use.

### Login safety — no user enumeration, no timing leak

**User enumeration**: if "no such user" and "wrong password" return different messages, an attacker can map your entire user base before trying a single password.

Your login always returns `Invalid email or password`, and even hashes a **dummy** password when the user doesn't exist so the response *time* is the same. Both message and timing identical → no enumeration.

### Account lockout

After 5 failed logins → account locked 15 minutes (423 `ACCOUNT_LOCKED`). Bounds credential stuffing.

Trade-off: lets an attacker deliberately lock a known account (denial-of-service). Mitigated by short lock duration + login rate limiter. Not fully solved without behavioural signals.

### Authorization — the pitfall

```js
// ❌ Wrong: fetches first, checks later
const application = await appRepo.findById(id);
if (application.studentId !== req.user.studentId) throw forbidden();
```

Two problems:

1. **Timing leak** — the query runs whether you own it or not; response time reveals whether the record exists.
2. **404 vs 403 confusion** — a 403 confirms the record exists (leak); a 404 says nothing.

```js
// ✅ Right: scope is part of the query
async function getApplication(id, actor) {
  const app = await repo.findById(id);
  if (!app) throw notFound(...);
  if (actor.role === 'STUDENT' && app.studentId !== actor.studentId) {
    throw notFound(...);   // 404 — don't confirm existence to the wrong owner
  }
  return app;
}
```

Your `application.service.js` does this. `tests/auth.test.js` has an IDOR test: student A → student B's application → **404**, not 403.

### The 401/403/404 policy

|  | Code |
|---|---|
| Missing/invalid token | 401 |
| Valid token, wrong role for the *endpoint* | 403 |
| Valid token, right role, no such visible row | 404 |

### Rate limiting

Three limiters:

| Limiter | Window | Max | Keyed on |
|---|---|---|---|
| Global | 15 min | 300 | IP |
| Register | 1 hour | 3 | IP |
| Login | 15 min | 5 | **IP + email** |

**IP-only login limit** lets one attacker on a shared campus network lock out the whole institution. **Email-only** lets a distributed attack sail past. Combination gives you both bounds.

### Defence layers — helmet, CORS, body size

- **helmet**: security-related HTTP headers. CSP restricts where scripts may load from → XSS defence. HSTS forces HTTPS. X-Content-Type-Options stops MIME sniffing. X-Frame-Options stops clickjacking.
- **CORS allow-list**: explicit list of origins allowed to call your API. Never `origin: '*' + credentials: true` — browsers reject that combination anyway.
- **Body size cap** (`100kb`): a 500MB JSON body would be a one-request DoS.

### Boot-time secret validation

Server refuses to boot if any auth secret is:
- missing, or
- < 32 chars, or
- (for access + refresh) equal to each other

Better to fail loudly at startup than to boot into a quietly-insecure state.

## The one thing to remember from Task 6

**Identity is proven, access is scoped, tokens die.** Every request either passes an authentication middleware and an authorization gate, or gets a 401/403. Nothing has an infinite lifetime.

---

# Task 7 — Validation & sanitisation

**Goal:** Universal, provable input validation. Every route validated, every input surface validated, one consistent error shape, and a CI check that fails if you ever forget.

## Vocabulary

| Term | Meaning |
|---|---|
| **Schema** | Declarative description of valid input. |
| **Parse vs validate** | Validate returns yes/no. Parse returns a *cleaned, typed* value. Prefer parsing. |
| **Coercion** | Type conversion — `"25"` → `25`. Necessary because query params are always strings. |
| **Sanitisation** | Removing or neutralising dangerous content (HTML, control chars). |
| **Strict mode** | Rejecting unknown fields instead of ignoring them. |
| **Mass assignment** | Attacker adds `"role": "ADMIN"` to a signup body and your ORM writes it. |
| **Prototype pollution** | Injecting `__proto__` into JSON to alter every object in the process. |
| **Coverage guard** | A test that walks the router and confirms every route has validation. |

## The mental model

The three defence layers, all needed:

| Layer | Catches | Cost |
|---|---|---|
| **Validation middleware** (this task) | Wrong shape/type, unknown fields, hostile strings | 1ms — request rejected before any work |
| **Service rules** (Tasks 3, 5) | "Email taken", "can't move from rejected to offered" | DB read |
| **DB constraints** (Task 4) | Anything that reached the DB wrongly | Expensive but absolute |

Middleware is the outermost ring. Cheapest, catches most things, protects everything else.

## What you built

- **[src/shared/middleware/validate.js](src/shared/middleware/validate.js)** — parses body/query/params/headers through Zod
- **[src/shared/middleware/sanitiseBody.js](src/shared/middleware/sanitiseBody.js)** — strips `__proto__` at any depth
- **[src/shared/schemas/primitives.js](src/shared/schemas/primitives.js)** — reusable Zod validators (email, ID, cgpa, pagination, ...)
- **[src/shared/schemas/sanitise.js](src/shared/schemas/sanitise.js)** — DOMPurify wrappers (`stripHtml`, `safeHtml`)
- **[src/modules/*/*.schema.js](src/modules/)** — per-endpoint Zod schemas
- **[tests/validation-coverage.test.js](tests/validation-coverage.test.js)** — walks the router, asserts every non-exempt route has `validate` middleware
- **[tests/fuzz.test.js](tests/fuzz.test.js)** — 20 junk values × 5 fields → 0 responses ≥ 500
- **[docs/VALIDATION.md](docs/VALIDATION.md)** — the endpoint schema matrix + error contract

## Key concepts explained

### Parse, don't validate — the philosophy

```js
// ❌ Validate: check, then use raw input anyway
if (!isValidAge(req.body.age)) throw new Error();
const age = req.body.age;         // still a string! still untrusted!

// ✅ Parse: output is a new, typed, trusted value
const { age } = ageSchema.parse(req.body);   // number, guaranteed
```

After parsing, the raw input is discarded. Everything downstream works with a value the schema vouches for. Eliminates a whole class of bug where something's checked once and re-read raw somewhere else.

### Validate at the edge, once

Every request passes through validation before any business logic. Services then assume clean input and only check **rules** (email uniqueness, state transitions, ownership). Defensive `if (!x) return` scattered through services is a symptom of not trusting the edge.

### Allowlist, never blocklist

```js
// ❌ Blocklist — you'll always miss something
if (input.includes('<script>')) reject();      // <SCRIPT>, <img onerror=...>, ...

// ✅ Allowlist — define what's permitted
z.string().regex(/^[a-zA-Z0-9\s.-]+$/)
```

Same lesson as SQL injection. Enumerate the good, not the bad. There's always another encoding.

### Reject unknown fields — the mass-assignment defence

`.strict()` on every object schema. Consider:

```json
POST /auth/register
{ "email": "x@y", "password": "...", "role": "ADMIN", "emailVerified": true }
```

Without `.strict()`, if any code path does `prisma.user.create({ data: req.body })`, you just handed out an admin account. With `.strict()`, that request fails with `UNKNOWN_FIELD` before it reaches any handler.

Test: send `{"role": "ADMIN"}` in a register body → 422 `UNKNOWN_FIELD`. See [tests/validation.test.js](tests/validation.test.js).

### Fail with everything at once

Return all errors, not just the first. Forms that reveal one problem at a time are miserable to use, and it's a one-line difference in implementation.

Your test asserts that a body with 4 problems returns all 4 in `error.details`.

### The `req.query` Express-5 trap

In Express 5, `req.query` is a **getter** — assigning to it silently fails. If you do `req.query = validated`, no error is thrown, but `req.query` is still the raw string version. You then wonder why defaults never appear.

**Fix**: parsed output goes into `req.validated.query`. Add `req.validatedQuery = req.validated.query` as a convenience alias. `req.body` and `req.params` are safe to overwrite; `req.query` is not.

### Stable public issue codes

Zod's internal codes (`invalid_type`, `unrecognized_keys`, ...) are library implementation details. Your API maps them to your own vocabulary:

| Public code | Meaning |
|---|---|
| `INVALID_TYPE` | Wrong JS type |
| `INVALID_FORMAT` | Doesn't match required pattern |
| `INVALID_OPTION` | Not in the allowed enum |
| `TOO_SMALL` / `TOO_BIG` | Length/value out of range |
| `UNKNOWN_FIELD` | Extra field not permitted |
| `INVALID_VALUE` | Cross-field or custom refine() failed |

Now switching from Zod to Joi later doesn't break clients. Your API contract is yours.

### 400 vs 422 — the split

- **400 Bad Request** — malformed request (bad query string, bad path, bad header). Something structurally wrong.
- **422 Unprocessable Entity** — well-formed request, but semantically invalid body (email format wrong, CGPA out of range).

Your middleware splits: errors on `body` → 422, errors on `query/params/headers` → 400. Matches Task 3's original contract.

### Primitive vocabulary — build once, use everywhere

```js
// primitives.js
const email = z.string().trim().toLowerCase().email().max(255);
const cgpa = z.coerce.number().min(0).max(10);
const graduationYear = z.coerce.number().int().min(2020).max(2035);
const pagination = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
```

Every endpoint schema composes these. Don't rewrite the same email rule in nine files.

### Unicode-aware `personName`

```js
z.string().regex(/^[\p{L}\p{M}\s'.-]+$/u, ...)
```

`\p{L}` = any letter in any script. So "Ravi Iyer", "José García", "अरव शर्मा" all pass. An ASCII-only regex is a real bug that hits real users.

### Query-param coercion

Query strings are *always* strings. So `?limit=20` gives you `"20"` (string), not `20` (number).

```js
z.coerce.number()   // "20" → 20
```

The `z.coerce` prefix does the conversion before validation runs. Without it, every numeric query param would fail with `INVALID_TYPE`.

### Sanitisation — sanitise, then validate

Order matters. Sanitise first so validation sees the final value.

- **Control chars + zero-width joiners**: `primitives.cleanString` strips these. They're used for invisible payload smuggling, log-line splitting, terminal confusion.
- **HTML**: DOMPurify wrappers (`stripHtml`, `safeHtml`) — ready to `.transform()` into any text field.
- **Prototype pollution**: `sanitiseBody` middleware strips `__proto__`, `constructor`, `prototype` at any depth (max 20 as DoS cap).

### Where XSS actually lives (be honest)

An API returning JSON isn't XSS-vulnerable. The vulnerability is at the *render site* (browser DOM, admin dashboard, email digest). But stored XSS is real — save `<img src=x onerror=alert(1)>` today, some dashboard renders it next month.

Sanitising on input is **defence in depth**. The frontend still MUST escape on output. Server-side sanitisation reduces blast radius; it doesn't remove the client-side obligation.

### Prototype pollution

```json
{ "name": "x", "__proto__": { "isAdmin": true } }
```

If that reaches a deep-merge or `Object.assign` chain, you've modified the prototype of every object in the process. Suddenly `{}.isAdmin === true` everywhere.

Your middleware kills this before anything downstream sees it. Your test asserts `Object.prototype.isAdmin` is undefined after a request with a `__proto__` payload.

### The coverage guard — the deliverable that separates pass from redo

`tests/validation-coverage.test.js` walks the Express router and asserts every non-exempt route has `validate` in its middleware chain. The `EXEMPT` set is short and every entry is justified in a comment.

**Delete a `validate(...)` from any route → CI fails and names the route.** Add a new route without one → CI fails.

This is what turns "we validated most routes" into "we can prove no route slipped". Adding a new endpoint that forgets validation becomes structurally impossible.

### Never let internals leak in errors

Your test greps every response for:

- Stack trace pieces (`/src/`, `at Object.`, `node_modules`)
- Library names (`zod`, `prisma`, `postgres`)
- Schema names (`password_hash`, `SELECT`, `users.`)

None of them may appear in any client-facing error.

### Fuzz testing — the cleanest possible claim

```js
const FUZZ_VALUES = [null, undefined, 0, -1, Infinity, NaN, true, false,
                     '', ' ', 'null', '[]', '{}', [], {},
                     'a'.repeat(10000), '💥'.repeat(500)];

for (const value of FUZZ_VALUES)
  for (const field of FIELDS)
    expect(res.status).toBeLessThan(500);
```

**Nothing produces a 5xx.** That single assertion is the cleanest possible statement of "we don't trust client input". A 4xx (400/422) is fine — the server said "no" cleanly. A 5xx means validation didn't catch it and something crashed.

## The one thing to remember from Task 7

**Every route validated, provably.** Not just written down — checked by CI. Forgetting validation on a new route fails the build.

---

# The whole vocabulary in one place

## Web / HTTP

| Term | Definition |
|---|---|
| REST | Style of API where URLs are nouns (resources), HTTP methods are verbs. |
| Endpoint / route | A (method, path) pair. |
| Resource | A thing your API exposes (student, job). |
| Idempotent | Same request twice = same effect as once. |
| CORS | Rules deciding which browser origins can call your API. |
| CSRF | Trick a logged-in browser into unintended requests. |
| Bearer token | Token where possession alone proves identity. |
| Rate limit | Max requests per window; extras get 429. |

## Data

| Term | Definition |
|---|---|
| Schema | Structural description (of DB or of input). |
| Migration | Versioned schema change; committed to git. |
| Primary key | Row's unique identifier. |
| Foreign key | Column pointing at another table's PK. |
| Constraint | Rule the DB refuses to break. |
| Index | Sorted lookup structure; makes reads fast at write cost. |
| Composite index | Index on multiple columns; order matters. |
| Partial index | Index only over rows matching a filter. |
| Normalisation | Storing each fact once (1NF/2NF/3NF). |
| Denormalisation | Deliberately duplicating for perf or snapshots. |
| Cardinality | 1:1, 1:N, N:M. |
| ORM | Object-Relational Mapper (Prisma). |
| DTO | Data Transfer Object — the shape you send out. |

## Persistence & concurrency

| Term | Definition |
|---|---|
| Transaction | All-or-nothing group of writes. |
| ACID | Atomicity, Consistency, Isolation, Durability. |
| Isolation level | How strictly transactions are shielded from each other. |
| Rollback | Undo everything in a transaction. |
| Connection pool | Fixed reusable set of DB connections. |
| Connection leak | Connection borrowed and never returned. |
| Race condition | Two requests interleave badly. |
| Optimistic lock | Assume no conflict; detect at write via version. |
| Pessimistic lock | Lock the row up front (`SELECT ... FOR UPDATE`). |
| N+1 | 1 + N queries where 2 would do. |
| SQL injection | User input becomes SQL. |
| Parameterised query | Query template + values sent separately. |

## Auth & security

| Term | Definition |
|---|---|
| Authentication | Who are you? |
| Authorization | What are you allowed to do? |
| Hash | One-way, non-reversible. |
| Salt | Per-user random, stored with the hash. |
| Pepper | Per-server secret, stored in config. |
| JWT | JSON Web Token — signed, self-contained. |
| Claim | A field in a JWT. |
| Access token | Short-lived, sent every request. |
| Refresh token | Long-lived, only refreshes access. |
| Token rotation | New refresh each use; reuse = detection. |
| RBAC | Role-based access control. |
| IDOR | Insecure Direct Object Reference. |
| Mass assignment | Attacker adds a privileged field to a body. |
| CSP | Content Security Policy header. |
| HSTS | Force HTTPS via header. |
| XSS | Injecting JavaScript to run in a browser. |

## Validation

| Term | Definition |
|---|---|
| Schema (validation) | Declarative rules for valid input. |
| Parse | Validate + return the cleaned typed value. |
| Coercion | `"25"` → `25`. |
| Sanitisation | Neutralise dangerous content. |
| Strict schema | Reject unknown fields. |
| Prototype pollution | `__proto__` injection. |
| Fuzz test | Throw junk, assert no crash. |
| Allowlist / blocklist | Enumerate good vs enumerate bad. |

---

## How to keep learning

**Read your own code with this doc open.** Every concept above points at a real file. Open the file, understand what each line does, and re-read the concept.

**Break something and watch a test catch it.** Delete a `validate(...)`. Delete a `RESTRICT`. Change `authenticate` to `(req, res, next) => next()`. Run the tests. Put it back.

**Explain a concept out loud.** Idempotency, refresh rotation, why cascade vs restrict, why we hash and not encrypt. If you can explain it to someone else, you know it. If you can't, re-read the section.

**Next up (Task 8+):** caching (Redis), background jobs (BullMQ), file uploads (S3), observability (structured logs + metrics), deployment. All of those extend the rings that are already in place — no ring gets rewritten.
