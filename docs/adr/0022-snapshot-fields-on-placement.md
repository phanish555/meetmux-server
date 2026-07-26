# ADR-0022: Snapshot fields on Placement (deliberate denormalisation)

**Status:** Accepted  ·  **Date:** 2026-07-26

## Context

A placement's package and title live on the Job. If we join through Job to read them, we get the *current* values — but the *historical* fact is what the student was offered at the time of placement. If the job's package changes next year, our record of what was actually offered would silently change with it.

## Decision

Copy `offeredCtcPaise` and `titleAtOffer` onto the placement row at creation time. This is deliberate denormalisation — the "point-in-time snapshot" pattern (Task 4 Part 3.6).

The rule: **if the source changes, should this change too? If no, copy it deliberately and comment why.**

## Consequences

- **Positive:** placement records are historical truth — they never contradict what actually happened.
- **Positive:** package analytics ("2026 batch avg CTC") stay stable even if jobs are updated retroactively.
- **Negative:** these fields will diverge from `jobs.stipendPaise` if the job is updated after placement. That's the intent, but reviewers seeing the values differ may need to check this ADR.
- Uses `BigInt` for `offeredCtcPaise` because annual CTC in paise easily exceeds JS's safe-integer range (₹5 crore = 5,000,000,000 paise, fits in `Int` but multiplied out is uncomfortable — `BigInt` future-proofs it).
