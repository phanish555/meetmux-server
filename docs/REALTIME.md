# PlaceMux — Real-time

## 1. Why WebSockets

Everything else in this API is request/response: the client asks, the server answers, the connection closes. The server has no way to speak first. That's fine for "load a page", useless for "show me new applications the moment they arrive."

Three historical answers:
- **Polling** — client asks every N seconds. Wasteful and up to N seconds stale.
- **Long polling** — server holds the request open until something changes. Better; awkward.
- **WebSockets** — one persistent connection either side can speak over. The right tool.

**Socket.io** sits on top of WebSockets and adds what you'd otherwise build: automatic reconnection, room-based targeting, acknowledgements, and cross-instance delivery via an adapter.

## 2. Connection & authentication

Socket.io attaches to the **same** `http.Server` that Express uses ([`src/server.js`](../src/server.js)). One port, one address to load-balance.

Every connection is authenticated in the **handshake** by [`src/realtime/middleware/authenticate.js`](../src/realtime/middleware/authenticate.js), which:
- reads the JWT from `socket.handshake.auth.token`
- runs the **same** `verifyAccessToken` used by the REST auth middleware (Task 6)
- rejects the connection with `UNAUTHENTICATED` if the token is missing/invalid/expired
- honours `passwordChangedAt` — a socket presenting a token issued before a password change is refused (same rule as REST)
- attaches the identity to `socket.data.user`

One auth system, two transports. The authenticated identity is what determines room membership; the client cannot claim to be someone they're not.

## 3. Rooms & targeting

A **room** is a named bucket of sockets. Emit to a room, and only its members receive the event. **Never `io.emit(...)` to everyone** — that's the event-flood pitfall in a single line.

### Room scheme

Mirrors the Task 6 authorization scopes. A socket joins only the rooms its authenticated identity is allowed into.

| Room | Who joins | What lands here |
| --- | --- | --- |
| `user:{userId}` | The user themself, all their devices | Direct notifications |
| `student:{studentId}` | A student (own studentId only) | Their own application updates |
| `staff` | PLACEMENT_OFFICER + ADMIN | Dashboard events, `stats:batch` |
| `recruiters` | RECRUITER + ADMIN | Recruiter dashboards |
| `job:{jobId}` | Anyone who opts in via `subscribe:job` | Live updates on that job |

The `subscribe:job` handler validates the ID shape and rate-limits (60 per minute per socket) to defeat spam.

## 4. Event catalogue

Real-time equivalent of the OpenAPI spec — the contract for what the server emits.

| Event | Direction | Payload | Emitted from | Room(s) |
| --- | --- | --- | --- | --- |
| `application:new` | server → client | `{ id, jobId, studentId, jobTitle, appliedAt }` | `application.service.createApplication` (after commit) | `staff`, `job:{jobId}`, `student:{studentId}` |
| `application:status` | server → client | `{ id, status, updatedAt }` | `application.service.updateStatus` | `student:{studentId}`, `job:{jobId}` |
| `stats:batch` | server → client | `{ [jobId]: count }` | Batched per second by `bumpStat` | `staff` |
| `subscribe:job` | client → server + ack | `jobId` | Client | — |
| `unsubscribe:job` | client → server + ack | `jobId` | Client | — |

## 5. Emit-after-commit rule

**Never emit inside a transaction.** If the transaction rolls back and you've already told clients about the event, you've created phantom state that's extremely hard to debug.

The pattern used throughout `src/modules/*/service.js`:

```js
const created = await repo.create(application);   // committed
try {
  emitApplicationCreated({ application: created, job });
} catch (e) {
  // realtime is best-effort — a broken emit must not break the request
  console.warn(...);
}
```

The `try/catch` around the emit is the second half of the rule: real-time is best-effort. If the socket layer breaks, the REST request still succeeds. The database is the source of truth.

## 6. Reconnection

**Auto-reconnect gets you the connection back. It does NOT recover events emitted while you were offline.** Three layers of defence:

1. **Automatic rejoin.** On reconnect, the `connection` handler runs again, so identity rooms are re-joined automatically.
2. **Connection State Recovery** (Socket.io built-in, configured in [`io.js`](../src/realtime/io.js)) — buffers missed events for up to 2 minutes on a quick blip.
3. **REST re-fetch** (client responsibility) — for longer gaps, the client reconciles by calling the REST API with a `since=` timestamp.

**The honest position:** real-time is a best-effort optimisation over polling. The database is the source of truth; clients reconcile against it. See [ADR-0028](adr/0028-realtime-is-best-effort.md).

Token expiry during a live connection is handled client-side — a `connect_error: UNAUTHENTICATED` triggers the client to refresh the access token via `/api/v1/auth/refresh` and reconnect. Without this, a user whose token expires mid-session silently stops receiving updates.

## 7. Scaling plan — the single-instance trap

**Rooms live in the memory of one instance.** With three servers behind a load balancer:

- Student's socket is on **instance A**.
- Recruiter's socket is on **instance B**.
- Student applies. Instance A calls `io.to('company:X').emit(...)`.
- Instance A looks in *its own memory* — recruiter isn't there.
- **Recruiter never gets the event.**

Works ≈ 1/N of the time. Worst kind of bug.

### The two-part fix

1. **Redis adapter** (`@socket.io/redis-adapter`) — instances share room membership and forward emits via Redis pub/sub. Wired in [`io.js`](../src/realtime/io.js) automatically if `REDIS_URL` is set.
2. **Sticky sessions** on the load balancer — a client's HTTP requests (during the polling→websocket upgrade handshake) must land on the same instance. `ip_hash` in nginx or equivalent.

**Both** are required. Adapter alone: handshake can fail across instances. Sticky alone: rooms don't cross instances. See [ADR-0027](adr/0027-redis-adapter-scaling.md).

## 8. Flood prevention

- **Rooms instead of `io.emit`** — every emit targets specific rooms.
- **Batching for high-frequency events** — `bumpStat` coalesces into one `stats:batch` per second, not one per application.
- **Client rate limits** — `subscribe:job` is 60 per minute per socket.
- **Payload validation** — client-emitted IDs are shape-checked before use.

## 9. Test coverage (5 tests, all passing)

`tests/realtime.test.js`:

| Test | Proves |
| --- | --- |
| Socket without token → `UNAUTHENTICATED` | Handshake rejects unauthenticated |
| Socket with garbage token → `UNAUTHENTICATED` | JWT verification runs |
| Socket with valid token connects | Handshake accepts valid |
| Student receives `application:new` for their submission | Emit-from-service reaches the right room |
| **Student A does NOT receive student B's `application:new`** | Rooms actually isolate — the privacy guarantee |

That last test is the important one. Without room isolation, real-time is a privacy leak.

## 10. Manual test client

Serve [`public/realtime-test.html`](../public/realtime-test.html) (open it in a browser or `npx serve public`). Paste an access token, connect, then trigger an application in another tab or with `curl` — the event arrives instantly. That cross-tab moment is the whole task working.

## 11. Decision records

- [ADR-0026: Socket.io over raw WebSockets](adr/0026-socketio-over-raw-ws.md)
- [ADR-0027: Redis adapter + sticky sessions for scaling](adr/0027-redis-adapter-scaling.md)
- [ADR-0028: Real-time is best-effort — DB is source of truth](adr/0028-realtime-is-best-effort.md)
