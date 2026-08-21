# HOOMA ULTIMATE — Database

Status: **Target data architecture and migration policy**

## 1. Source of durable truth

PostgreSQL is the durable source of business truth. Redis/Valkey is transient. Object storage owns media bytes.

The final schema is normalized from both sources; it is not a concatenation of their Prisma files.

## 2. Migration baseline

HOOMA ULTIMATE must preserve the Source A migration chain unchanged when targeting the existing Railway database:

1. `20260816141614_init`
2. `20260816190000_add_teams`
3. `20260818153000_add_watch_fanhub_association`
4. `20260818170000_add_places_and_owner_claims`
5. `20260819090000_add_profile_audience`
6. `20260819152000_add_pitch_listings`
7. `20260819184500_add_platform_admin_authority`
8. `20260820123500_make_telegram_user_id_optional`
9. `20260820140500_add_email_password_auth`
10. `20260820213000_add_profile_identities`
11. `20260821094000_add_profile_presentation`

Rules:

- never edit an already-deployed migration;
- never replace this chain with V3's fresh-init strategy;
- never use `prisma db push` as production migration strategy;
- every HOOMA ULTIMATE schema change gets a forward migration;
- data backfills are idempotent/auditable where possible;
- clean-database and Source-A-upgrade paths converge to the same final schema.

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

Legacy Source A auth/user fields may remain temporarily during migration, but only with an explicit backfill/removal plan.

### Global authority

- `PlatformRoleAssignment`

Only global role: `PLATFORM_ADMIN`.

### HOOMA Communities

- `Community`
- `CommunityMembership`
- `CommunityInvite`

Target roles: FOUNDER, COACH, MEMBER. Legacy scoped ADMIN values require explicit data migration.

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

- `RideOffer`
- `RideRequest`
- `RideMatch`
- `RideLocationPing` where fully implemented
- `RideRating` where retained and fully implemented

Public projections must not expose exact location data.

### FundMe

- `Fundraiser`
- `FundContribution`

Payment execution belongs to Payments, not FundMe.

### Payments

Preserve/normalize Source A mature models and runtime needs for:

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

## 6. Place migration/backfill

The Place normalization migration must inventory existing Source A Place, Pitch listing, Watch/FanHub venue relationships and map them to one canonical physical Place.

Required approach:

1. add new nullable linkage/capability fields/tables;
2. backfill deterministically using existing identifiers, not list positions;
3. detect possible duplicates for manual review rather than silently collapsing uncertain rows;
4. preserve historical Event snapshots where current Place edits would otherwise rewrite history;
5. validate all new foreign keys before old relationships are removed;
6. remove legacy duplicate structures only after application reads/writes and tests use the canonical path.

## 7. Identity/auth migration

Do not destructively rename Source A auth fields first.

Safer sequence:

1. create final identity/session tables;
2. backfill Telegram identity from existing Telegram user IDs;
3. backfill Web credential/session state where compatible;
4. normalize usernames/emails before adding stricter constraints;
5. dual-read only if necessary during a short transition;
6. switch application ownership to final tables;
7. verify representative production-like data;
8. remove deprecated columns/tables in a later forward migration.

No automatic Web/Telegram account merge is permitted.

## 8. Community role migration

Legacy `OWNER/ADMIN/MEMBER` must not survive as final scoped Admin terminology.

The migration must map legacy rows using verified Source A semantics. Likely mappings must be confirmed by source trace before SQL is written; do not guess globally that every `ADMIN` is a Coach without validating how that role is used in current production paths.

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

- entire chain builds a clean database from zero;
- representative Source A schema/data upgrades through all new migrations;
- clean and upgraded paths match the expected final schema;
- no existing required records disappear unexpectedly;
- role/identity/Place backfills are correct;
- required unique/FK/check constraints hold;
- downgrade is not assumed; rollback strategy is forward-fix/restore according to deployment policy.
