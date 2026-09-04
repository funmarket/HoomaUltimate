# ADR-055 — Athletes Founder Photo Board

Status: **ACCEPTED PRODUCT/ARCHITECTURE CONTRACT — IMPLEMENTATION PHASES FOLLOW**

## Context

Athletes is an independent HOOMA-connected sports-community domain. Its current shipped foundation includes `AthletesCommunity`, `AthletesMembership`, `AthletesJoinRequest`, public discovery/detail, membership/management lifecycle, and a member-private Whistle Board through the shared transient Whistle engine.

The approved next durable media capability is a deliberately narrow Founder-curated **Photo Board**. This ADR locks the product and ownership boundary before authorization, contracts, schema, repository, storage orchestration, routes, or frontend implementation begins.

This decision does not claim that Photo Board code is already shipped.

## Decision

### Product access

- The Photo Board belongs to one `AthletesCommunity`.
- Only an **active FOUNDER membership in that same active Athletes community** may upload photos.
- Active `MODERATOR` and `MEMBER` memberships may view the board but may not upload.
- Outsiders and public/anonymous viewers may not view the board.
- Membership in a different Athletes community grants no access.
- An archived Athletes community does not expose its private Photo Board through active member routes. Archive is an access-state boundary, not destructive media deletion.

### Product scope

The Photo Board is a private, Founder-curated durable gallery for Athletes members. It is **not** a social feed.

The initial capability has no:

- captions;
- likes or reactions;
- comments or replies;
- follower mechanics;
- albums;
- manual ordering tools;
- photo-count limit invented by this phase;
- moderator upload;
- member upload;
- public board;
- user-facing delete feature.

A future product decision may add a capability only by explicitly changing the governing contract; implementation must not infer one from storage primitives.

### Whistle separation

Photo Board and Whistle remain separate concepts and persistence paths.

- Photo Board metadata is durable.
- Photo bytes are durable managed media in object storage.
- Whistle body content remains transient under the shared Whistle engine and its existing Redis-only body-content boundary.
- Photo bytes, metadata, captions, or identifiers must not be encoded into Whistle bodies as a substitute for Photo Board persistence.
- Photo Board implementation must not change Whistle quota, expiry, contexts, or persistence.

### Data and storage ownership

Athletes owns Photo Board business policy and durable photo metadata. The shared `packages/storage` / `ObjectStorage` abstraction owns binary-object transport; it does not own Athletes authorization or photo lifecycle policy.

The intended persistence split is:

```text
Athletes domain -> durable Photo Board metadata -> PostgreSQL
Athletes application/infrastructure -> ObjectStorage -> S3-compatible object bytes
```

Do not create a generic Media domain, generic MediaAsset authority, second storage client, or cross-domain media repository for this feature. Ride/Gamers may be inspected as technical precedent only; they do not become Athletes dependencies or business owners.

Metadata must remain metadata; image bytes do not belong in PostgreSQL or Redis.

### Initial upload policy

The initial Photo Board upload policy follows the verified current Ride managed-photo precedent unless a later explicit product decision changes it:

- accepted MIME types: `image/jpeg`, `image/png`, `image/webp`;
- maximum body size: **5 MiB**;
- binary upload parsing must be route-scoped rather than changing the whole API body parser.

The precedent is technical only. Athletes must implement its own domain authorization and metadata lifecycle.

### Deletion and archive semantics

There is no user-facing Photo Board delete capability in the initial product.

Archiving an `AthletesCommunity` must deny active private Photo Board access but must not be treated as destructive deletion of its durable photo metadata or object bytes. Any future retention, administrative cleanup, legal deletion, or hard-delete policy requires a separate explicit decision and must include object/metadata consistency rules.

Internal cleanup of an object that was uploaded but whose metadata transaction failed is reliability behavior, not a user-facing delete feature.

## Explicitly not authorized by this ADR

This governance phase does **not** authorize implementation of:

- Founder photo authorization code;
- Photo Board contracts/DTOs;
- Prisma models or migrations;
- photo repositories;
- photo services/storage orchestration;
- HTTP photo routes;
- frontend binary transport changes;
- frontend Photo Board API methods;
- Photo Board UI/components;
- generic Media infrastructure;
- changes to Ride;
- changes to Whistle behavior.

Those changes must occur only in their approved later phases and pass their own test/score/merge gates.

## Consequences

- The feature stays Athletes-owned and member-private.
- Founder curation is enforced server-side when implementation begins; UI hiding will never be sufficient authorization.
- PostgreSQL and object storage retain distinct responsibilities.
- Existing shared storage infrastructure can be reused without creating a generic Media domain.
- Archive semantics preserve durable data while closing active private access.
- Later implementation phases have a bounded contract and cannot invent social mechanics.

## Verification for this governance phase

Review/CI must prove that this change is documentation-only, introduces no Photo Board code/schema/routes, and remains compatible with repository architecture/documentation checks. Later phases must provide behavioral tests for the capabilities they implement.