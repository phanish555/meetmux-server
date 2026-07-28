# ADR-0028: Real-time is best-effort — the database is the source of truth

**Status:** Accepted  ·  **Date:** 2026-07-28

## Context

Real-time can feel like a guarantee ("the client will see this event") when it's actually a probabilistic optimisation. A user in a lift, on flaky Wi-Fi, or with an expired token can miss events. Treating real-time as guaranteed delivery creates hard-to-debug bugs.

## Decision

Real-time events are a **best-effort optimisation over polling**. The **database is the source of truth**; clients reconcile against it.

Concretely:

- **Emit after commit, never inside a transaction.** Rolling back a transaction after emitting creates phantom events for state that doesn't exist.
- **Emit failures are caught and logged**, never propagated — a broken realtime layer must not break a REST request.
- **Clients reconnect + re-fetch.** On reconnect they should call the REST API with a `since=` cursor to catch up on anything missed. Connection State Recovery handles the short-blip case automatically; anything longer needs REST catch-up.
- **No delivery acknowledgement expected.** If a downstream must be sure it saw an event, it polls the REST API — not the socket.

## Consequences

- **Positive**: the system is honest about its guarantees. A dropped connection doesn't corrupt state.
- **Positive**: the REST API remains the canonical way to read data — real-time is a UX optimisation on top of it.
- **Negative**: clients that only listen and never reconcile will occasionally miss updates. Docs explicitly call this out.
- Reviewers evaluating the feature will not find "guaranteed delivery" claims anywhere — because we don't have that.
