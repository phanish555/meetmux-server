# ADR-0027: Redis adapter + sticky sessions for horizontal scaling

**Status:** Accepted  ·  **Date:** 2026-07-28

## Context

Socket.io rooms are stored in each instance's memory. With multiple instances behind a load balancer, an emit on instance A can't reach a socket connected to instance B. This is invisible on a laptop and 1/N-broken in production.

## Decision

**Both** parts of the fix are required:

1. **Redis adapter** (`@socket.io/redis-adapter`) — instances share room membership and forward emits via Redis pub/sub. Requires two Redis connections (one for pub, one for sub — a subscribed connection can't publish).

2. **Sticky sessions** on the load balancer (nginx `ip_hash` or equivalent). Socket.io's initial handshake may involve multiple HTTP requests during the polling → WebSocket upgrade. If those land on different instances, the handshake fails.

Adapter alone: the connection breaks. Sticky alone: rooms don't cross instances. Only together do they work.

## Implementation

`src/realtime/io.js` wires the Redis adapter automatically when `REDIS_URL` is set. If it's not set, the app runs single-instance and Socket.io works normally on that one instance.

Sticky sessions must be configured at the load-balancer layer — no application code required, but it MUST be there in production. Documented in `docs/REALTIME.md` §7.

## Consequences

- **Positive**: three instances behave like one from the client's perspective.
- **Positive**: graceful degradation — no Redis = single instance = still works.
- **Negative**: Redis becomes a shared dependency in production. Same Redis is used for caching (Task 9), so no new operational surface.
