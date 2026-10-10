# HOOMA — Durable Progress Ledger

Status: **HISTORICAL / NON-AUTHORITATIVE EVIDENCE**

This file retains durable implementation milestones that are useful across sessions. It is not a branch-status board, release queue, roadmap, or source of product/architecture authority.

Canonical authority remains in `requirements.md`, `structure.md`, `docs/DECISIONS.md`, and `docs/CANONICAL_MODEL.md`. Working discipline remains in `AGENTS.md` and `docs/LIVING_BUILD_PLAN.md`.

Do not store current branch heads, pull-request state, commit SHAs, CI run IDs, deployment IDs, temporary candidates, sequencing gates, or “next task” roadmaps here. When a task depends on mutable repository/runtime state, inspect that state live.

---

## Current durable implementation milestones

### Home and navigation

- Permanent bottom navigation is `Home | Play | Watch | HOOMA | Athletes`.
- Home exposes the six source-backed gateways `HOOMA | Teams | Pitch | Places | Ride | Requests`.
- Pitch remains an independent `/pitch` product even though Athletes owns the fifth permanent navigation slot.
- Gamers remains an independent `/gamers` route family and is not a Home gateway.
- FundMe and Donations are represented inside the Help/Requests navigation family rather than as Home gateways.

### Identity and authentication

- HOOMA uses one canonical User with separate Web and Telegram authentication transports.
- Web passwords use Argon2id.
- WebSession activity remains Identity-owned and is not generic online/offline presence.
- Telegram-backed Web password recovery remains Identity-owned and does not create a second user/account authority.
- Server-side authorization is authoritative; UI visibility is never the security boundary.

### Communities, Teams and Play

- HOOMA Community creation remains Communities-owned.
- Team creation remains Teams-owned and uses a canonical HOOMA Community context where required.
- Teams owns its roster, lineup/published-lineup, player-offer, Team challenge and TeamGame lifecycles.
- Current Team challenge creation/acceptance does not contain a separate five-active-player plus published-lineup readiness gate. Such a rule must not be inferred from old documentation.
- Play remains responsible for its own discovery/orchestration while Teams and Events retain their owning-domain lifecycle truth.

### Athletes

- Athletes is an independent HOOMA-connected domain with its own community, membership and join-request lifecycle.
- Athletes has member-authorized Whistle integration through the shared Whistle engine.
- Athletes owns a private Founder-curated Photo Board with durable metadata and object-storage image bytes.
- Athletes owns its private Calendar and Calendar RSVP lifecycle independently from generic Event RSVP.
- Athletes member presentation may project Identity-owned WebSession last-seen data without creating real-time presence or a second profile model.
- Athletes Requests is a projection of canonical Requests data, not separate Requests persistence.

### Requests / Help

- Requests is implemented as one canonical `HelpRequest` domain.
- Request Type is exactly `SPORT | COMMUNITY`; standalone “All Requests” is an unfiltered presentation/query state, not a third type.
- Requests has server-backed text search, taxonomy/filtering, current REQUESTS/PLAY/ATHLETES projections, create/detail/lifecycle presentation, requester identity projection, Request media, and private response coordination.
- Optional precise `fullAddress` is persisted but not exposed through current public/member Request read DTOs.
- FundMe and Donations tabs exist as placeholders only. Their presence does not prove durable Fundraising, Donations, claims, contributions, payments, or provider integration.

### Ride

- Ride has domain-owned offers, requests, participation, compensation terms, destination/reference policy, private meeting-point handling and vehicle-photo metadata.
- Ride supports Community-targeted Request projection without transferring RideRequest ownership to Communities or HOOMA NOW.
- Ride uses the shared Whistle engine through Ride-owned authorization rather than a separate chat/message store.
- Ride cash terms are advertised Ride terms; Ride does not become a payment processor merely because a record mentions cash.

### Gamers

- Gamers owns a persisted game catalog, game-specific GamerProfile records, discovery, challenge lifecycle and accepted global Arena projection.
- Direct Gamer Whistle uses the shared Whistle engine through server-derived Gamer pair authorization.
- EA SPORTS FC Mobile has a bounded match-session/result-verification bridge over accepted Gamer challenges.
- HOOMA does not claim to observe external gameplay that it does not actually receive.
- Future Gamer ranking or Squad behavior must not be reported as implemented unless current source proves it.

### Whistle

- HOOMA has one shared Whistle engine.
- Current shared invariants include the bounded grapheme limit, global UTC-day send quota, next-UTC-midnight expiry, Redis-only body storage and PostgreSQL metadata only.
- Product domains authorize their own supported Whistle contexts; no domain may create a parallel durable chat merely to reuse Whistle presentation.

### Storage and persistence

- PostgreSQL is durable business truth.
- Redis/Valkey is used only for explicitly transient/disposable state.
- Managed media bytes live in S3-compatible object storage while owning domains retain their business metadata/authorization.
- Place metadata saves preserve canonical gallery identities, URLs and order; legacy gallery fields are rejected by the metadata contract. Edit Place and Pitch management use the same Places-owned media controls and existing narrower media permissions. Initial four-URL Place suggestion remains separate.
- Durable schema changes use committed migrations; production `prisma db push` is not a migration strategy.
- Durable asynchronous side effects use the established outbox/Worker pattern where required.

### Payments boundary

- There is no current live Payments domain; documentation must not invent active rails, providers, rollout plans, or settlement behavior.
- The retained historical Payments design names `CASH | TELEGRAM_STARS` as initial rails unless a later explicit Payments decision changes them.
- FundMe's target Cash/Crypto contribution coordination is Fundraising-owned and does not make Crypto a Payments rail or authorize card/provider checkout.

---

## Evidence discipline

A durable milestone belongs here only when it remains useful after branch heads, pull requests, CI runs and deployments change.

For present-tense questions such as “what is open?”, “what is deployed?”, “what is the current head?”, or “what should merge next?”, inspect the live repository/runtime instead of reading this ledger.

For behavior claims, trace the current owning source, contracts, migrations, tests and runtime evidence as appropriate. If the current implementation contradicts this ledger, the live implementation proves what exists and this ledger must be corrected without inventing replacement behavior.
