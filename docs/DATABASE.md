# HOOMA — Database

Status: **ACTIVE DATABASE OWNERSHIP + MIGRATION POLICY**

## 1. Source of durable truth

PostgreSQL is the durable source of business truth. Redis/Valkey is transient. Object storage owns media bytes.

The final schema is normalized from both sources; it is not a concatenation of their Prisma files.

## 2. Migration policy

HOOMA owns its database schema and migration history.

Rules:

- current merged/applied migration history is treated as forward-only;
- every durable schema change uses a committed forward Prisma migration;
- never rewrite an applied historical migration to make a new feature fit;
- never use `prisma db push` as the production migration strategy;
- clean-database migration from zero is a required CI/release check;
- donor migrations/schemas remain read-only reference evidence and are never copied into HOOMA history;
- any future pre-release baseline/squash operation is a separate explicitly authorized migration-history task with clean-database and deployed-state proof; it is not routine feature work;
- historical donor data, if ever imported, uses explicit ETL/import scripts and reconciliation rather than application migration compatibility.

## 3. Current persistence ownership

The model names below describe the merged foundation. Prisma is split across the root schema and bounded domain schema files; the generated client is one database contract.

### Identity / security

Current durable models:

- `User`
- `UserPresentation`
- `PlayerProfile`
- `TelegramIdentity`
- `WebCredential`
- `PasswordRecoveryChallenge`
- `WebSession`
- `UserSanction`

`User` is canonical identity. Authentication transports are separate records. Presentation is not authorization. Password-recovery secrets are never stored in plaintext.

### Global authority / operations

Current durable models include:

- `PlatformRoleAssignment`
- `AppManagerGrant`
- `AuditLog`
- `OutboxEvent`
- `UserNotification`

Only global platform authority uses `PLATFORM_ADMIN`. App-manager capabilities are explicit grants and do not create another generic Admin role.

### HOOMA Communities

Current durable models:

- `Community`
- `CommunityMembership`
- `CommunityJoinRequest`

Current roles are `FOUNDER | COACH | MEMBER`. No scoped Community `ADMIN` or `OWNER` role is authoritative.

### Athletes

Current durable models:

- `AthletesCommunity`
- `AthletesMembership`
- `AthletesJoinRequest`
- `AthletesPhoto`
- `AthletesCalendarEntry`
- `AthletesCalendarRsvp`

Athletes is independent from HOOMA Communities and Teams while reusing canonical User identity.

### Teams

Current durable models:

- `Team`
- `TeamPlayer`
- `TeamPlayerOffer`
- `TeamResponsibilityAssignment`
- `TeamCapabilityGrant`
- `TeamLineup`
- `TeamLineupSlot`
- `TeamChallenge`
- `TeamChallengeMessage`
- `TeamGame`

Team management remains Team-owned. Do not replace Team responsibilities/capabilities with generic Community membership.

### Events / Play / Watch

Current durable models include:

- `Event`
- `PlayEventDetails`
- `WatchEventDetails`
- `WatchCulturalEventDetails`
- `EventRsvp`
- `EventPlayerInvite`
- `Formation`
- `FormationSlot`
- `EventCheckIn`
- `EventChatRoom`
- `EventChatMessage`

Events owns canonical lifecycle. Play/Watch add their own bounded projections/details rather than duplicating Event.

### Places / Pitch

Current durable models:

- `Place`
- `PlaceMenuItem`
- `PlaceImage`
- `PlaceOwnershipClaim`
- `PlaceOwnership`
- `PlaceCapability`
- `PlaceCapabilityApplication`

One canonical Place is reused by Places, Watch and Pitch. Pitch uses the canonical `PITCH` capability/application path rather than a duplicate venue table.

### Gamers

Current durable models:

- `GamerGame`
- `GamerProfile`
- `GamerChallenge`
- `GamerMatchSession`
- `GamerMatchSubmission`

Do not report unimplemented Gamer Squad/handle/result models as current persistence merely because older plans described them.

### Play player discovery

Current durable model:

- `PlayPlayerListing`

This remains Play-owned discovery state and is not a Team/Community membership record.

### Requests / Help Taxonomy

Current canonical Requests persistence is owned by Requests:

- `HelpRequest`
- `HelpRequestResponse`
- `HelpTaxonomySubcategory`
- `HelpTaxonomyNeed`
- `HelpTaxonomyNeedSurface`

`HelpRequest` owns publisher/audience references, lifecycle, user-entered title/description, sport/taxonomy links, optional custom need, location metadata, supported product metadata, needed-by/expiry state, and the legacy `category`/`itemKind` compatibility fields that remain during the taxonomy transition.

`HelpRequestResponse` owns one responder/request message and status. The current implementation does **not** use a `RequestClaim` quantity-allocation model.

Help Taxonomy owns subcategory/need/surface eligibility. Main Requests, Play Requests and Athletes Requests query the same canonical Request rows through server-side surface policy; projections never create copied Request tables.

### Ride

Current canonical Ride persistence is owned by Rides:

- `RideOffer`
- `RideOfferVehiclePhoto`
- `RideRequest`
- `RideRequestCommunityAudience`
- `RideParticipation`
- `RideMeetingPoint`
- `RideOfferWaypoint`

Public projections must not expose exact private pickup or meeting-point data.

### Whistle

Current durable model:

- `WhistleMetadata`

Whistle body content is Redis-only. PostgreSQL may store metadata/context/quota/expiry truth according to the Whistle contract but must never store the Whistle message body.

### Future owners, not current persistence

These remain separate future or partially frozen domains unless a newer explicit slice implements them:

- ULTRAS supporter-community persistence;
- Fundraising / FundMe persistence;
- Payments provider/settlement persistence;
- generic MediaAsset persistence;
- Replay persistence/read models;
- additional HOOMA NOW durable read models.

Do not document future target model names as though they already exist.

## 4. Future canonical football entity direction

The current merged Prisma model set does not yet contain a standalone canonical football-entity table. Older plans require a future catalog capable of representing at least CLUB and NATIONAL_TEAM for product areas that need it.

Do not report such a model as implemented and do not add it opportunistically. When explicitly authorized, preserve existing Team/Watch/Gamers ownership and migrate consumers deliberately rather than creating another duplicate football catalog.

## 5. Key constraints

Enforce invariants at the strongest appropriate layer.

Required examples:

- unique normalized Web login username;
- unique display username if final product policy requires uniqueness;
- optional email uniqueness only when non-null, with normalization rules;
- unique Telegram platform user ID in `TelegramIdentity`;
- session token hash uniqueness;
- Team cannot challenge itself;
- one active Team responsibility per role/scope where business rules require;
- capability grants reference an active Assistant responsibility;
- verified Place ownership uniqueness according to ownership policy;
- ULTRAS target references a canonical football entity;
- one Gamer profile per user where required;
- Whistle has no body field;
- foreign keys for Event/Watch/Pitch -> Place associations;
- useful query indexes on public discovery and active-status paths.

## 6. Current canonical Place design

The merged schema uses one canonical physical `Place`. Place ownership, images/menu data and capability/application records attach to that same Place. Watch and Pitch consume canonical Place identity rather than creating duplicate venue tables.

If donor data is ever imported, duplicate detection/reconciliation belongs to a separate import tool with review output; it is not normal migration compatibility.

## 7. Current identity design

The merged identity model uses canonical `User` plus `TelegramIdentity`, `WebCredential`, `WebSession`, `UserPresentation`, `PlayerProfile` and related Identity-owned security records.

No heuristic Web/Telegram account merge is permitted.

## 8. Scoped role vocabulary

Current schema must not reintroduce legacy scoped `ADMIN` terminology. Communities use `FOUNDER/COACH/MEMBER`; Teams use `COACH/ASSISTANT/PLAYER`; Athletes uses `FOUNDER/MODERATOR/MEMBER`; global application authority uses `PLATFORM_ADMIN`. Future domains define their own scoped vocabulary only when implemented.

## 9. Whistle transactional design

PostgreSQL stores metadata/authorization context. Redis stores body and quota state.

Quota enforcement must be concurrency-safe so simultaneous sends cannot exceed 11/day. The exact mechanism may use Redis atomic scripts/transactions or a durable coordination strategy, but integration tests must prove the invariant.

The first authorized reveal must atomically transition body TTL to exactly 60 seconds without re-extending it on later reads.

## 10. Outbox locking

Worker claim query uses transaction-safe `FOR UPDATE SKIP LOCKED` semantics. Claiming and attempt state must prevent two workers from executing the same event concurrently while still allowing safe retry after failure.

## 11. Idempotency

Mutations exposed to retries/provider callbacks use scoped idempotency records or naturally unique provider keys. Telegram payment callbacks and other provider webhooks must be duplicate-safe.

## 12. Test requirements

Migration tests must prove:

- the entire HOOMA chain builds a clean database from zero;
- the generated schema matches the expected target architecture;
- required unique/FK/check constraints hold;
- seed/dev fixtures do not weaken production invariants;
- no donor migration compatibility is assumed;
- downgrade is not assumed; rollback strategy is forward-fix/restore according to deployment policy.

If a future donor-data import is approved, that import receives its own fixture set, reconciliation assertions, row-count/invariant checks, and acceptance report separate from normal schema migration tests.
