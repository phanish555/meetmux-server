# ADR-0020: Sanitise on input, escape on output

**Status:** Accepted  ·  **Date:** 2026-07-25

## Context

An API returning JSON isn't itself XSS-vulnerable — the injection happens when a browser renders unescaped strings. So does an API need any HTML sanitisation at all?

## Decision

**Yes — as defence in depth, not the primary defence.** Two categories of harm:

1. **Stored XSS.** A payload like `<img src=x onerror=alert(1)>` saved today can execute in any UI that renders it unescaped later (admin dashboards, email digests, PDF exports). Sanitising on write means those downstream renderers can't accidentally introduce a vulnerability.
2. **Invisible payload smuggling.** Control characters and zero-width joiners in a name field bypass blocklists, split log lines, and confuse terminal-based admin tools. `primitives.cleanString` strips them before storage.

The frontend still MUST escape on output. Server-side sanitisation reduces blast radius; it does not remove the client-side obligation.

Prototype pollution (`__proto__`) is stripped from every JSON body by `src/shared/middleware/sanitiseBody.js` — same defence-in-depth argument, and cheap.

## Consequences

- Rich-text fields (job descriptions) can only contain the tag allowlist in `sanitise.safeHtml` — currently `p, br, strong, em, ul, ol, li, a`. Everything else is stripped.
- Plain-text fields get `stripHtml`. If a legitimate use case ever needs markup, it must be an explicit opt-in per field, not global.
- Verified: `tests/validation.test.js` includes a prototype-pollution attempt with an assertion that `Object.prototype` is unmodified afterwards.
