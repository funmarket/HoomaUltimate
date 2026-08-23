# HOOMA ULTIMATE — CANONICAL MODEL

Status: **ACTIVE DATA + AUTHORITY CONTRACT**  
Scope: domains already implemented or currently being normalized.  
Do not add frozen future-domain models here until their vertical slice begins.

---

## 0. Purpose

This document is the canonical contract for the current HOOMA ULTIMATE implementation.

During normalization, the following must agree with this file:

```text
Prisma schema
migration SQL
repository ports
Prisma repositories
application services
authorization policies
contracts
integration tests
Web/Telegram projections
```

If implementation disagrees with this document, implementation is wrong until this document is explicitly changed by a newer product decision.

---

# 1. Identity and authentication

## User

One canonical application identity.

```text
User
  id
  createdAt
  updatedAt
```

Authentication identities attach to User; they do not replace User.

## UserPresentation

Canonical user-facing presentation identity.

```text
UserPresentation
  userId
  username            public/display username
  displayName
  photoUrl?
  bio?
  createdAt
  updatedAt
```

Login username and presentation username are conceptually separate.

## WebCredential

```text
WebCredential
  userId
  loginUsername       unique
  passwordHash        Argon2id
  email?              unique when present
  failedLoginCount
  lockedUntil?
  lastLoginAt?
  createdAt
  updatedAt
```

## WebSession

```text
WebSession
  id
  userId
  tokenHash           unique; raw token never persisted
  expiresAt
  revokedAt?
  createdAt
  lastSeenAt
```

## TelegramIdentity

```text
TelegramIdentity
  userId
  telegramUserId      unique
  telegramUsername?
  firstName?
  lastName?
  photoUrl?
  languageCode?
  isPremium
  lastAuthenticatedAt
  createdAt
  updatedAt
```

## Auth conflict

Valid Web session -> User A plus valid Telegram initData -> User B returns:

```text
AUTH_CONFLICT
```

No heuristic merge.

---

# 2. Global platform authority

## PlatformRoleAssignment

Current global role:

```text
PLATFORM_ADMIN
```

No scoped domain role may be named `ADMIN`.

## AuditLog

Durable sensitive-operation history.

At minimum:

```text
id
actorUserId?
action
entityType
entityId?
requestId?
metadata?
createdAt
```

Never store secrets, password material, session tokens, Telegram bot token, or Whistle body content in audit metadata.

## OutboxEvent

Foundation async-delivery record.

Business mutation and outbox creation must eventually share a transaction where an async side effect is required.

---

# 3. HOOMA Community

## Community

```text
Community
  id
  slug
  name
  description?
  city?
  houma?
  status             ACTIVE | ARCHIVED
  createdByUserId
  createdAt
  updatedAt
```

## CommunityMembership

```text
CommunityMembership
  id
  communityId
  userId
  role               FOUNDER | COACH | MEMBER
  joinedAt
  leftAt?
```

Rules:

- no scoped `ADMIN`;
- active membership means `leftAt == null`;
- one membership identity per Community/User;
- leaving/rejoining may reactivate the canonical membership record unless a future audit/history requirement explicitly changes that design;
- Founder owns ultimate Community authority;
- Coach is a Community-scoped manager, not App Admin.

---

# 4. Team

## Team

```text
Team
  id
  communityId        required
  slug
  name
  motto?
  city?
  houma?
  badgeUrl?
  status             ACTIVE | INACTIVE
  isPublic
  acceptingChallenges
  createdByUserId
  createdAt
  updatedAt
```

Rules:

- Team is a separate entity from Community;
- every current V1 Team belongs to one Community;
- a Community may have a maximum of one ACTIVE Team in V1;
- persistence must not make historical/inactive Team rows impossible;
- public discovery requires `status == ACTIVE && isPublic == true`;
- Team names are presentation, never identity;
- `houma` remains the neighborhood/local-area field.

---

# 5. Team roster

## TeamPlayer

```text
TeamPlayer
  id
  teamId
  userId?            optional canonical HOOMA User link
  displayName        required
  shirtNumber?
  position?
  photoUrl?
  isActive
  createdAt
  updatedAt
```

Rules:

- Team may exist without players;
- TeamPlayer may exist without a HOOMA account;
- `userId` is never globally unique;
- if `userId` is present, the same User may not be linked twice to the same active Team roster;
- removal/deactivation should preserve history unless an explicit delete operation is required;
- public roster returns only data intentionally exposed by the Team public projection;
- no fake player portrait is generated; use a neutral fallback when photo is absent.

Canonical football positions should be represented by one Team player-position enum/contract, not arbitrary duplicate strings in different layers.

---

# 6. Team authority

## TeamResponsibilityAssignment

```text
TeamResponsibilityAssignment
  id
  teamId
  userId
  role               COACH | ASSISTANT
  assignedAt
  revokedAt?
```

Rules:

- only one active identical Team/User/role assignment;
- revoked history may remain;
- direct COACH has full Team authority;
- ASSISTANT role by itself grants no business capability.

## TeamCapabilityGrant

```text
TeamCapabilityGrant
  id
  teamId
  userId
  capability
  grantedByUserId
  grantedAt
  revokedAt?
```

Canonical capabilities:

```text
EDIT_TEAM
MANAGE_ROSTER
MANAGE_LINEUP
CREATE_CHALLENGE
RESPOND_TO_CHALLENGE
MANAGE_TEAM_EVENTS
```

Rules:

- only one active identical Team/User/capability grant;
- grant/revoke requires Coach-equivalent authority, never Assistant self-escalation;
- revoked history may remain.

## Effective Team authority

For an operation requiring capability `X`:

```text
Direct Team COACH
  => allowed

Active Community FOUNDER/COACH for Team.communityId
  => allowed through the explicit mature fallback policy

Direct Team ASSISTANT + active capability X
  => allowed

otherwise
  => denied
```

This resolution must live in one Team authorization policy/service path.

Do not use generic "managed Team" membership as proof of every capability.

---

# 7. Team lineup

## TeamLineup

```text
TeamLineup
  id
  teamId
  createdByUserId
  name
  formation
  matchFormat
  isCurrent
  isPublished
  createdAt
  updatedAt
```

## TeamLineupSlot

```text
TeamLineupSlot
  id
  lineupId
  teamPlayerId?
  role
  x                  0..100
  y                  0..100
  isStarter
  sortOrder
```

Rules:

- slots link to TeamPlayer, not directly to User;
- TeamPlayer must belong to the same Team as the lineup when assigned;
- formation is a football formation label/preset, not a replacement for actual slot coordinates;
- matchFormat supports smaller-sided football; no hardcoded eleven-player assumption;
- setting a lineup current clears prior current state transactionally;
- public API returns only `isPublished == true` lineups;
- authorized management API may return drafts/unpublished lineups;
- unpublished lineup data must not leak through public Team/Game DTOs.

---

# 8. Team challenge

## TeamChallenge

```text
TeamChallenge
  id
  challengerTeamId
  challengedTeamId
  createdByUserId
  status             PENDING | ACCEPTED | DECLINED | CANCELLED | EXPIRED
  proposedStartsAt?
  proposedVenue?
  proposedFormat?
  message?
  acceptedByUserId?
  declinedByUserId?
  cancelledByUserId?
  acceptedAt?
  declinedAt?
  cancelledAt?
  expiresAt?
  createdAt
  updatedAt
```

Rules:

- `challengerTeamId != challengedTeamId` enforced in service and database;
- only one PENDING challenge may exist for an unordered Team pair;
- challenge creation requires `CREATE_CHALLENGE` on challenger Team;
- challenged Team must be active/eligible/accepting challenges;
- accept/decline requires `RESPOND_TO_CHALLENGE` authority on challenged Team;
- cancel requires challenge authority on challenger Team;
- state transitions are atomic;
- terminal challenge states are not rewritten back to PENDING.

## Challenge visibility

Public product surfaces may show only the deliberately public match/challenge presentation required by Teams/Games.

Private management detail and leader conversation are member-authorized data.

---

# 9. Team challenge coordination

## TeamChallengeMessage

```text
TeamChallengeMessage
  id
  challengeId
  senderUserId
  senderTeamId
  body
  createdAt
```

Rules:

- available only when Challenge is ACCEPTED;
- sender Team must be one of the two participating Teams;
- sender must be Team Coach-equivalent or Assistant with `RESPOND_TO_CHALLENGE` for sender Team;
- ordinary Player/Member/public caller cannot read or write;
- message belongs to this match-coordination context only;
- no general public Team chat is implied.

---

# 10. TeamGame

## TeamGame

```text
TeamGame
  id
  challengeId        unique
  homeTeamId
  awayTeamId
  scheduledAt?
  venueName?
  matchFormat?
  status             SCHEDULING | CONFIRMED | COMPLETED | CANCELLED
  createdAt
  updatedAt
```

Rules:

- accepting a Challenge creates/gets exactly one TeamGame;
- creation is idempotent;
- missing schedule remains `SCHEDULING`; never invent date/time/venue;
- once enough scheduling data is confirmed, Game may transition to `CONFIRMED`;
- public Game DTO excludes private leader messages;
- public upcoming Game sorting uses scheduled date/time where present; unscheduled accepted Games are grouped as scheduling rather than assigned fake times.

A future game-specific lineup association may be added deliberately; it is not created speculatively in the normalization schema.

---

# 11. Event / Play

## Event

During normalization, the creation path supports:

```text
PLAY
```

only.

WATCH is not creatable until the canonical Places + Watch vertical slice is implemented.

Canonical Event lifecycle:

```text
PUBLISHED | CANCELLED | COMPLETED
```

A later Watch slice may expand/adjust event presentation/lifecycle deliberately through a migration and decision.

Core Event properties:

```text
id
communityId
createdByUserId
type               PLAY in current creation flow
status
title
description?
startsAt
endsAt?
timezone
venueName?
address?
capacity?
waitlistEnabled
entryFeeMinor
currency
createdAt
updatedAt
```

Current paid Event execution is not enabled until Payments exists. A request requiring unsupported payment behavior must fail explicitly rather than creating fake paid state.

---

# 12. PlayEventDetails

```text
PlayEventDetails
  eventId
  pitchType
  skillLevel
  format
```

Play-specific fields belong here or in the canonical Play/Event contract rather than contaminating unrelated future Watch details.

---

# 13. Event RSVP / waitlist

## EventRsvp

```text
EventRsvp
  id
  eventId
  userId
  status
  waitlistSequence?
  checkedInAt?
  createdAt
  updatedAt
```

Current statuses must support at least confirmed/waitlisted/cancelled/attended/no-show semantics required by implemented behavior.

Rules:

- one canonical RSVP per Event/User;
- capacity decision occurs transactionally with a database row lock or equivalent safe mechanism;
- simultaneous RSVP requests cannot overbook capacity;
- leaving/cancelling promotes next eligible waitlisted participant transactionally;
- frontend going counts are projections, never concurrency authority.

---

# 14. Event Formation

## Formation

```text
Formation
  id
  eventId
  createdByUserId
  name
  format
  published
  createdAt
  updatedAt
```

## FormationSlot

```text
FormationSlot
  id
  formationId
  userId?
  team              A | B
  position
  label
  x                 0..100
  y                 0..100
```

Rules:

- Event formation is separate from Team lineup;
- coordinates are normalized;
- participant eligibility and organizer authority are server-side.

---

# 15. Event check-in

## EventCheckIn

```text
EventCheckIn
  id
  eventId
  userId
  latitude?
  longitude?
  createdAt
```

Rules:

- one check-in per Event/User;
- check-in authorization and timing follow Event service policy;
- no public leakage of precise private location beyond intended product behavior.

---

# 16. Temporary Event chat

## EventChatRoom

```text
EventChatRoom
  id
  eventId            unique
  opensAt
  closesAt
  createdAt
```

## EventChatMessage

```text
EventChatMessage
  id
  roomId
  userId
  body
  createdAt
  expiresAt
```

Rules:

- Event participation/authorization gates access;
- room has an explicit temporary window;
- expired messages are excluded from reads;
- Worker owns durable cleanup of expired rows once cleanup execution is enabled;
- Events cannot be marked fully complete until cleanup ownership is implemented and tested;
- this chat is separate from Whistle and from Team challenge coordination;
- the later Play communication direction is Event Whistle Board through the shared Whistle engine; Event Chat removal is a separate cleanup/migration slice.

---

# 17. Whistle

## WhistleMetadata

Whistle is one shared transient signal engine. PostgreSQL owns metadata only:

```text
WhistleMetadata
  id
  authorUserId
  contextType        COMMUNITY | EVENT | TEAM | RIDE | ULTRAS | GAMER_SQUAD
  contextId
  createdAt
  expiresAt
```

There is deliberately **no body column**.

Current rules:

- body lives only in Redis transient storage;
- body TTL is 24 hours from creation while unread;
- maximum body length is 33 Unicode grapheme clusters, enforced server-side;
- each User may create at most 11 Whistles per UTC calendar day **globally across every context**;
- quota enforcement is concurrency-safe at the durable metadata boundary;
- first authorized reveal creates one 60-second reveal window for that viewer;
- reads during the active reveal window do not extend it;
- after that viewer's reveal window expires, that viewer cannot restart it;
- another authorized viewer has an independent reveal window;
- active Community membership is required for the current `COMMUNITY` context;
- current enabled context is `COMMUNITY` only;
- `EVENT`, `TEAM`, `RIDE`, `ULTRAS`, and `GAMER_SQUAD` remain disabled until their context-specific authorization slices are deliberately implemented;
- Whistle body content must never be copied into PostgreSQL, AuditLog metadata, OutboxEvent payloads, durable notifications, analytics, URLs, query strings, or server logs;
- list endpoints expose metadata/presentation only; body retrieval happens only through the authorized reveal operation;
- Redis is disposable transient infrastructure; PostgreSQL metadata remains the durable source for quota/context indexes and expiry projections.

Redis keys are infrastructure details, not canonical product identity. Losing Redis may make remaining transient bodies unavailable; it must never cause a fallback to durable body storage.

---

# 18. Public/member boundary

Public reads:

```text
/api/public/v1/*
```

Authenticated/private actions:

```text
/api/v1/*
```

Global Platform Admin:

```text
/api/v1/admin/*
```

Rules:

- public Team DTO never includes unpublished lineup;
- public Game DTO never includes leader coordination messages;
- member management DTO may expose only data the authenticated principal is authorized to manage;
- Whistle Community reads, sends, and reveals are authenticated member-private operations;
- UI hiding is not authorization.

---

# 19. Frozen future concepts

The normalized initial schema must not add durable product tables for these until their vertical slice begins:

```text
Place/Watch/Pitch capability system
ULTRAS
Gamers
Requests
Ride
FundMe
Payments
MediaAsset beyond any truly required current foundation
Replay
HOOMA NOW read models
```

Whistle is explicitly unfrozen by ADR-039 and is therefore no longer in this list.

Foundation interfaces/packages may exist, but a speculative schema is not implementation.

---

# 20. Migration requirement

Before first HOOMA ULTIMATE release, all pre-release current migrations are replaced with one reviewed initial migration generated from the reconciled schema and augmented with intentional PostgreSQL constraints where required.

After first release, migration history becomes forward-only.

---

# 21. Completion rule

A model is not considered correct because this file exists.

Normalization for a current domain is complete only when:

```text
CANONICAL_MODEL
      =
schema.prisma
      =
initial migration result
      =
repository fields/constraints
      =
service policy
      =
contracts
      =
integration test behavior
      =
public/private UI projection
```

Any mismatch is a blocker, not a reason for a compatibility patch.
