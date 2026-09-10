# ADR-056 — Athletes Founder Photo Board

Status: **ACCEPTED PRODUCT/ARCHITECTURE CONTRACT — IMPLEMENTED ON `phase-0-foundation` AND EXTENDED BY PRODUCT-OWNER DECISION 2026-09-10**

## Context

Athletes is an independent HOOMA-connected sports-community domain. Its merged foundation includes `AthletesCommunity`, `AthletesMembership`, `AthletesJoinRequest`, public discovery/detail, membership/management lifecycle, a member-private Whistle Board through the shared transient Whistle engine, and the Founder-curated Photo Board governed by this ADR.

The Photo Board is deliberately narrow: durable managed photos curated by the Founder for active members. The product owner explicitly extended this contract on 2026-09-10 to allow the active same-community Founder to delete Photo Board photos and to optimize uploaded photos before durable object-storage persistence. This extension does not turn Photo Board into a social feed or generic Media domain.

## Decision

### Product access

- The Photo Board belongs to one `AthletesCommunity`.
- Only an **active FOUNDER membership in that same active Athletes community** may upload or delete photos.
- Active `MODERATOR` and `MEMBER` memberships may view the board but may not upload or delete.
- Outsiders and public/anonymous viewers may not view the board.
- Membership in a different Athletes community grants no access.
- An archived Athletes community does not expose its private Photo Board through active member routes. Archive is an access-state boundary, not destructive media deletion.

### Product scope

The Photo Board is a private, Founder-curated durable gallery for Athletes members. It is **not** a social feed.

The current capability has no:

- captions;
- likes or reactions;
- comments or replies;
- follower mechanics;
- albums;
- manual ordering tools;
- photo-count limit invented by this phase;
- moderator upload or deletion;
- member upload or deletion;
- public board.

Founder deletion is curation authority over Photo Board media only; it does not add general moderation or generic media ownership.

### Whistle separation

Photo Board and Whistle remain separate concepts and persistence paths.

- Photo Board metadata is durable.
- Photo bytes are durable managed media in object storage.
- Whistle body content remains transient under the shared Whistle engine and its existing Redis-only body-content boundary.
- Photo bytes, metadata, captions, or identifiers must not be encoded into Whistle bodies as a substitute for Photo Board persistence.
- Photo Board implementation must not change Whistle quota, expiry, contexts, authorization, or persistence.

A visual refresh of the shared Whistle action may be applied across its existing UI surfaces, but it does not alter Whistle domain behavior.

### Data and storage ownership

Athletes owns Photo Board business policy and durable photo metadata. The shared `packages/storage` / `ObjectStorage` abstraction owns binary-object transport; it does not own Athletes authorization or photo lifecycle policy.

The persistence split remains:

```text
Athletes domain -> durable Photo Board metadata -> PostgreSQL
Athletes application/infrastructure -> ObjectStorage -> S3-compatible object bytes
```

Do not create a generic Media domain, generic MediaAsset authority, second storage client, or cross-domain media repository for this feature. Ride/Gamers may be inspected as technical precedent only; they do not become Athletes dependencies or business owners.

Metadata remains metadata; image bytes do not belong in PostgreSQL or Redis.

### Upload and optimization policy

Incoming Photo Board uploads remain:

- accepted MIME types: `image/jpeg`, `image/png`, `image/webp`;
- maximum request body size: **5 MiB**;
- maximum decoded input: **40 megapixels**;
- binary upload parsing is route-scoped.

After successful validation, the API normalizes the durable stored object before persistence:

- auto-orient from source orientation;
- preserve aspect ratio;
- maximum width/height envelope **1600 × 1600 px** with no enlargement;
- encode durable object bytes as **WebP quality 82, effort 4**;
- do not keep a second original object;
- metadata records the stored descriptor returned by `ObjectStorage`, including stored `contentType` and `sizeBytes`.

This optimization is server-owned so Web and Telegram uploads receive the same durable-storage policy and clients cannot bypass it.

### Founder deletion and consistency

Founder deletion is a full server-authorized lifecycle operation:

1. The service requires an active same-community `FOUNDER`.
2. Under the existing Athletes community lifecycle lock, the repository rechecks Founder authority and resolves the exact photo by `(athletesCommunityId, photoId)`.
3. In one PostgreSQL transaction, durable `AthletesPhoto` metadata is removed and an `OutboxEvent` is created for the existing `ATHLETES_PHOTO_RECONCILE_TOPIC` with that photo's exact object key.
4. The existing Worker reconciliation handler sees that no durable photo metadata owns the object and removes the object through shared `ObjectStorage`.
5. Worker retry semantics preserve eventual cleanup if object storage is temporarily unavailable.

Deletion must not perform an untracked best-effort object delete after removing metadata. No new deletion table, generic media worker, or second storage abstraction is introduced.

### Archive semantics

Archiving an `AthletesCommunity` denies active private Photo Board access but does **not** delete its durable photo metadata or object bytes. Archive remains preservation, not retention cleanup.

## Consequences

- The feature stays Athletes-owned and member-private.
- Founder upload and deletion are enforced server-side; UI hiding is never sufficient authorization.
- PostgreSQL and object storage retain distinct responsibilities.
- Uploaded photos consume less durable object storage because only the bounded normalized WebP is retained.
- Existing transactional outbox and Worker infrastructure own reliable object cleanup after Founder deletion.
- Archive semantics preserve durable data while closing active private access.
- Photo Board remains non-social and does not expand into Ride, Whistle, or generic Media ownership.

## Verification history

The original governance phase was documentation-only. Subsequent phases implemented authorization, contracts, metadata persistence, repository/service/storage orchestration, authenticated HTTP routes, frontend integration, image validation, cursor paging, lazy binary loading, and orphan reconciliation. PR #265 supplied production-readiness hardening and object-storage recovery semantics.

The 2026-09-10 extension adds bounded server-side WebP normalization and Founder-only deletion using the existing Athletes metadata + outbox + Worker architecture. Runtime deployment remains a separate verification step from source completion.
