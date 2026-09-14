# ADR-060 — Athletes member and join-request pagination

Status: Accepted
Date: 2026-09-14

## Context

Athletes community detail originally loaded every active membership and every pending join request in one request. The member projection also batched Identity last-seen data for the entire active roster. That behavior was correct for small communities but created unbounded database, API, and frontend work as communities grew.

Athletes already owns its membership and join-request persistence. Reusing a generic Event, Team, or community pagination source would blur that ownership and create another source of truth.

## Decision

Athletes member and pending join-request reads use bounded, opaque cursor pagination owned by the Athletes domain.

- Member and pending join-request list endpoints default to 50 rows and accept at most 100 rows per page.
- Repositories fetch `limit + 1` rows to determine whether another page exists.
- Active members are ordered by `role ASC`, `joinedAt ASC`, then membership `id ASC`.
- Pending join requests are ordered by `requestedAt ASC`, then request `id ASC`.
- The returned cursor is opaque to clients and identifies the last returned persistence row. Clients must not derive ordering semantics from its value.
- Member last-seen data remains owned by Identity and is batched only for user IDs present in the current Athletes member page.
- The frontend maintains independent member and join-request page state, errors, retries, and load-more actions.
- Membership mutations refresh only projections affected by that mutation. They do not reset Calendar, Photo Board, Whistle, or unrelated Athletes detail state.
- Pagination indexes are evidence-gated. Existing indexes are retained unless a representative PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` workload demonstrates that an additional forward-only index is justified.
- Calendar pagination is not part of this decision and remains a separate hardening slice.

## Verification

Regression coverage must prove:

- bounded query contracts reject limits above 100;
- pages are traversed without duplicate or omitted rows;
- member ordering remains deterministic when many rows share the same `joinedAt` timestamp;
- request ordering remains deterministic when many rows share the same `requestedAt` timestamp;
- current-page member last-seen batching does not query users outside that page;
- independent frontend loaders append pages without duplicating already loaded rows;
- real PostgreSQL pagination is exercised with more than 1,000 memberships and more than 1,000 pending join requests;
- query plans are inspected before introducing any new index.

## Consequences

- Large Athletes communities no longer require unbounded membership or pending-request reads.
- Identity last-seen work scales with the visible member page rather than total community size.
- Stable tie-breaking prevents cursor drift when timestamps are equal.
- Athletes retains one authoritative membership and join-request model without introducing a generic pagination subsystem.
- Index changes remain tied to measured database behavior instead of speculative schema growth.
