# ADR-0026: Socket.io over raw WebSockets

**Status:** Accepted  ·  **Date:** 2026-07-28

## Context

Node has a `ws` package for raw WebSockets, and Socket.io on top of it. Reasonable to ask why not just use raw.

## Decision

**Socket.io**, because it packages the things we would otherwise build:

- **Automatic reconnection** with exponential backoff (client)
- **Rooms** — named groups of sockets we can target instead of tracking sockets manually
- **Acknowledgements** — request/response inside a persistent connection
- **Fallback transports** — HTTP long-polling when WebSockets are blocked by a proxy
- **Connection State Recovery** — buffered replay across short blips
- **Cross-instance delivery** via a swappable adapter (Redis for us)

Each of those is a real amount of work in raw `ws`. The abstraction cost is a slightly larger protocol overhead per message and a client library.

## Consequences

- Client is coupled to Socket.io's client library (small, well-maintained).
- Room-based targeting maps naturally onto our Task 6 authorization scopes.
- The Redis adapter contract is stable across versions — the scaling story works without custom code.
