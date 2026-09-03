# HOOMA ULTIMATE — Database

Status: **Target data architecture and migration policy**

## 1. Source of durable truth

PostgreSQL is the durable source of business truth. Redis/Valkey is transient. Object storage owns media bytes.

The final schema is normalized from both sources; it is not a concatenation of their Prisma files.

## 2. Greenfield migration baseline

HOOMA ULTIMATE owns a fresh database schema and migration history.

Rules:

- design the target schema from the final domain requirements, not from donor table compatibility;
- create and commit a real initial Prisma migration for HOOMA ULTIMATE;
- Source A migrations and Source B schema are read-only reference evidence only;
- do not copy Source A migration directories into the target history;
- do not repeat Source B's zero-migration/fresh-schema-without-SQL state;
- never use `prisma db push` as the production migration strategy;
- once HOOMA ULTIMATE ships, every schema change gets a committed forward migration;
- clean-database migration from zero is a required CI/release check;
- historical donor data, if ever imported, uses explicit ETL/import scripts and reconciliation rather than application migration compatibility.

## 3. Core model ownership

### Identity

Target concepts:

- `User`
- `TelegramIdentity`
- `WebCredential`
- `WebSession`
- `UserPresentation`
- `UserProfileIdentity`
- `PlayerProfile`
- `PublicContact`

`User` is canonical identity. Authentication transports are separate records. Presentation is not authorization.

### Global authority

- `PlatformRoleAssignment`

Only global role: `PLATFORM_ADMIN`.

### HOOMA Communities

- `Community`
- `CommunityMembership`
- `CommunityInvite`

Target roles: FOUNDER, COACH, MEMBER. No scoped ADMIN value exists in the new target schema.

### Teams

- `Team`
- `TeamPlayer`
- `TeamResponsibilityAssignment`
- `TeamCapabilityGrant`
- `TeamLineup`
- `TeamLineupSlot`
- `TeamChallenge`
- `TeamChallengeMessage`
- `TeamGame`

Do not replace mature Team state with generic Community membership.

### Events

- `Event`
- `EventRsvp`
- `Formation`
- `FormationSlot`
- `CheckIn`
- `EventChatRoom`
- `EventChatMessage`

Keep mature capacity/waitlist/completion semantics from Source A.

### Places

- `Place`
- `PlaceSuggestion`
- `PlaceOwnerClaim`
- `PlaceOwnership`
- `PlacePhoto`

Capability/profile records attach to `Place`, including Lounge/Cafe representation, `WatchVenueApplication`, `WatchVenueProfile`, `PitchApplication`, `PitchProfile`.

FanHub uses canonical Place plus discovery/publication metadata rather than a duplicate physical venue table.

### ULTRAS

Independent models:

- `UltrasGroup`
- `UltrasMembership`
- `UltrasInvite`
- `UltrasJoinRequest`
- `UltrasGameDay`
- `UltrasGameDayAttendance`

Every group references a canonical football entity of type CLUB or NATIONAL_TEAM.

### Gamers

Independent models:

- `GamerGame`
- `GamerProfile`
- `GamerHandle`
- `GamerSquad`
- `GamerSquadMembership`
- `GamerChallenge`
- `GamerResultSubmission`

### Requests

- `Request`
- `RequestClaim`

Claiming must preserve concurrency-safe database invariants/locking behavior.

### Ride

Current canonical Ride persistence is single-purpose and owned by Rides:

- `RideOffer`
- `RideRequest`
- `RideRequestCommunityAudience`
- `RideParticipation`
- `RideMeetingPoint`
- `RideOfferWaypoint`
- `RideOfferVehiclePhoto`

Public projections must not expose exact private pickup or meeting-point data. Future matching, location-ping and rating concepts require their own explicit slices before models such as `RideMatch`, `RideLocationPing`, or `RideRating` are added or reported as implemented.

### FundMe

- `Fundraiser`
- `FundContribution`

Payment execution belongs to Payments, not FundMe.

### Payments

Design the payment models to support the verified mature runtime needs for:

- PaymentIntent;
- provider attempts/charges where present;
- CashSettlement;
- Telegram Stars provider state;
- provider webhook receipt/processing;
- DigitalEntitlement where used;
- idempotency.

Do not simplify the final model to only `TelegramStarPayment` if doing so loses mature runtime semantics.

### Whistle

`Whistle` stores metadata only.

**Forbidden:** any durable Whistle message-body column.

Body lives in Redis/Valkey and expires by the locked TTL rules.

### Media

- `MediaAsset`

PostgreSQL stores status, ownership, storage key, type, metadata and variant references. Object storage stores bytes.

### Replay

- `Replay`
- `ReplayPhoto`

Replay references completed Event state rather than duplicating Event lifecycle.

### Operations

- `AuditLog`
- `IdempotencyRecord`
- `OutboxEvent`
- `AdminNotification`

Every model must have a runtime owner or be explicitly documented as foundational; schema-only models are never reported as feature completion.

## 4. Canonical football entity

Create/normalize a canonical football entity model capable of representing at least CLUB and NATIONAL_TEAM. ULTRAS official identity must reference it. Player favorites and Watch match identity should migrate toward the same catalog where practical without breaking historical data.

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

## 6. Greenfield canonical Place design

The target schema must model one canonical physical `Place` from the first migration. Watch, Pitch, FanHub and Lounge/Cafe capabilities attach to that Place through explicit profile/application relationships. No legacy duplicate venue tables are required in the target.

If donor data is imported later, duplicate detection and deterministic reconciliation belong to a separate import tool with review output; they are not part of the target schema migration chain.

## 7. Greenfield identity design

Create the final identity model directly: canonical User, TelegramIdentity, WebCredential, WebSession and profile/presentation records. No legacy auth columns or dual-read transition is required in the new application.

No automatic Web/Telegram account merge is permitted.

## 8. Scoped role vocabulary

The target schema must never introduce legacy scoped `ADMIN` terminology. Communities use `FOUNDER/COACH/MEMBER`; Teams use `COACH/ASSISTANT/PLAYER`; ULTRAS use `LEADER/MODERATOR/MEMBER`; global application authority uses `PLATFORM_ADMIN`.

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

- the entire HOOMA ULTIMATE chain builds a clean database from zero;
- the generated schema matches the expected target architecture;
- required unique/FK/check constraints hold;
- seed/dev fixtures do not weaken production invariants;
- no donor migration compatibility is assumed;
- downgrade is not assumed; rollback strategy is forward-fix/restore according to deployment policy.

If a future donor-data import is approved, that import receives its own fixture set, reconciliation assertions, row-count/invariant checks, and acceptance report separate from normal schema migration tests.
