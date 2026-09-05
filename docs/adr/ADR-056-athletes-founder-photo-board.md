# ADR-056 — Athletes Founder Photo Board

Status: **ACCEPTED PRODUCT/ARCHITECTURE CONTRACT — IMPLEMENTED ON `phase-0-foundation`**

## Context

Athletes is an independent HOOMA-connected sports-community domain. Its current merged foundation includes `AthletesCommunity`, `AthletesMembership`, `AthletesJoinRequest`, public discovery/detail, membership/management lifecycle, a member-private Whistle Board through the shared transient Whistle engine, and the Founder-curated Photo Board governed by this ADR.

The Photo Board was approved as a deliberately narrow Founder-curated durable media capability. This ADR originally locked the product and ownership boundary before authorization, contracts, schema, repository, storage orchestration, routes, or frontend implementation began.

The bounded Photo Board source vertical slice has since been implemented on `phase-0-foundation`. This decision records that merged repository state and does not claim that any specific deployment has object-storage credentials or configuration.

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

## Historical governance boundary

At the time this ADR was accepted, its governance-only phase did **not itself** authorize implementation of:

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

The bounded Photo Board implementation phases have since completed on `phase-0-foundation`. This historical list does not mean the implemented Photo Board layers are absent today, and it still does not authorize generic Media infrastructure, Ride changes, or Whistle behavior changes.

## Consequences

- The feature stays Athletes-owned and member-private.
- Founder curation is enforced server-side; UI hiding is never sufficient authorization.
- PostgreSQL and object storage retain distinct responsibilities.
- Existing shared storage infrastructure can be reused without creating a generic Media domain.
- Archive semantics preserve durable data while closing active private access.
- The implemented vertical slice remains bounded by this contract and cannot invent social mechanics.

## Verification history

The original governance phase was documentation-only and intentionally introduced no Photo Board code, schema, or routes. Subsequent approved implementation phases supplied the bounded authorization, contracts, metadata persistence, repository/service/storage orchestration, authenticated HTTP routes, frontend integration, and behavioral verification. Phase 16 synchronizes this ADR to that merged repository state while preserving the original product constraints and without making a claim about any specific deployment's object-storage configuration.
