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
  lastSeenAt          Updated at session-resolution boundary with 60s throttle
```

Rules:

- `lastSeenAt` is the sole source of truth for web user activity;
- touched at Identity session-resolution boundary only, minimizing database writes;
- 60-second throttle per session to prevent burst write load;
- a session is active only when unrevoked (`revokedAt IS NULL`) and unexpired (`expiresAt > now()`);
- if a user has no active sessions, they are not considered active.

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

# 3A. Athletes

Athletes is a separate HOOMA-connected sports-community domain that reuses canonical `User` identity and owns its own lifecycle.

## AthletesCommunity

```text
AthletesCommunity
  id
  slug                         unique
  name
  sport                        CYCLING | RUNNING | SWIMMING | FOOTBALL | BASKETBALL | TENNIS | PADEL | GYM_FITNESS | OTHER
  description?
  city?
  houma?
  logoUrl?
  bannerUrl?
  visibility                   PUBLIC | PRIVATE
  joinPolicy                   OPEN | APPROVAL_REQUIRED
  status                       ACTIVE | ARCHIVED
  createdByUserId              canonical User
  createdAt
  updatedAt
```

## AthletesMembership

```text
AthletesMembership
  id
  athletesCommunityId
  userId                       canonical User
  role                         FOUNDER | MODERATOR | MEMBER
  joinedAt
  leftAt?
```

## AthletesJoinRequest

```text
AthletesJoinRequest
  id
  athletesCommunityId
  userId                       canonical User
  status                       PENDING | APPROVED | DECLINED | CANCELLED
  requestedAt
  resolvedAt?
  resolvedByUserId?
```

## AthletesPhoto

```text
AthletesPhoto
  id
  athletesCommunityId
  objectKey                    unique internal object-storage key
  contentType
  sizeBytes
  uploadedByUserId             canonical User
  createdAt
  updatedAt
```

Rules:

- Athletes records never live in `Community`, `CommunityMembership`, Team, or generic membership tables;
- creation atomically creates the AthletesCommunity and active FOUNDER membership;
- active membership means `leftAt == null`;
- active FOUNDER can manage settings, join requests, direct-adds, member removals, and moderator role changes in this foundation;
- MODERATOR authority is intentionally minimum-safe in this foundation: it may review join requests, direct-add users, and remove MEMBER records, but it may not manage settings, archive, manage founders, or manage moderators;
- MEMBER has no management authority;
- public discovery/detail is privacy-safe and independent from authenticated membership actions;
- AthletesPhoto belongs to one AthletesCommunity; PostgreSQL stores Photo Board metadata and shared object storage stores image bytes;
- only an active same-community FOUNDER may upload or delete Photo Board images;
- active same-community FOUNDER, MODERATOR, and MEMBER memberships may list/read Photo Board content; MODERATOR and MEMBER may not upload or delete; outsiders, cross-community memberships, and archived Athletes communities are denied active Photo Board access;
- accepted JPEG/PNG/WebP uploads up to 5 MiB are normalized server-side to WebP with a maximum 1600px edge and no enlargement before object persistence, and AthletesPhoto metadata records the stored optimized descriptor;
- Founder deletion removes the canonical AthletesPhoto metadata under the Athletes lifecycle lock and creates the existing Athletes object-reconciliation OutboxEvent so Worker cleanup owns eventual object removal;
- Photo Board API metadata does not expose internal `objectKey` or `uploadedByUserId`;
- Photo Board is separate from Whistle; Photo Board bytes are never stored in Redis and Whistle body/storage behavior is unchanged;
- the current Photo Board has no captions, likes/reactions, comments/replies, albums, manual ordering, moderator/member curation, or public board;
- Founder Photo Board deletion is scoped curation authority only and does not create a generic Media ownership model or social-feed lifecycle;
- equipment, Events, marketplace, Ride/Requests/FundMe integration, ULTRAS and generic community abstractions are not part of this foundation;

## Active Athletes list

Active Athletes displays only users with active, unrevoked, unexpired web sessions. Member rows show:

- avatar (from UserPresentation.photoUrl);
- display name (from UserPresentation.displayName);
- `@username` (from UserPresentation.username);
- role (FOUNDER, MODERATOR, or MEMBER);
- text-formatted last-seen timestamp (from WebSession.lastSeenAt).

If a user has no active sessions, they do not appear in the Active Athletes list.

Athletes uses Identity's batched `UserLastSeenReader` to fetch multiple users' last-seen timestamps in a single query, avoiding N+1 queries. No Redis presence, Telegram activity fallback, online/offline dots, or new presence table exists.

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
  userId            required canonical HOOMA User link
  shirtNumber?
  positions[]
  joinedAt
  leftAt?
```

Rules:

- Team may exist without players;
- TeamPlayer always belongs to an existing canonical HOOMA User; no placeholder/offline roster identity exists;
- public visitors may browse Team pages without an account, but authentication/account creation is required before a protected join or membership action can create a TeamPlayer;
- `userId` is never globally unique;
- the same User may not be linked twice to the same Team roster;
- Team-specific roster data belongs on TeamPlayer; display name, username, photo, bio and other canonical presentation remain owned by User/UserPresentation and are not duplicated here;
- removal/deactivation should preserve history through `leftAt` unless an explicit delete operation is required;
- active roster membership means `leftAt == null`;
- public roster returns only data intentionally exposed by the Team public projection.

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
  proposedAt?
  proposedEndsAt?
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
- if `proposedEndsAt` is supplied, `proposedAt` is required and `proposedEndsAt` must be later than `proposedAt`;
- challenge timing is explicit input; Team format is never used to guess match duration;
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
  endsAt?
  venueName?
  matchFormat?
  status             SCHEDULING | CONFIRMED | COMPLETED | CANCELLED
  createdAt
  updatedAt
```

Rules:

- accepting a Challenge creates/gets exactly one TeamGame;
- creation is idempotent;
- accepted challenge timing is copied into the canonical TeamGame as `scheduledAt` and `endsAt`;
- missing or incomplete timing remains `SCHEDULING`; never invent date/time/duration/venue;
- the current challenge-acceptance path transitions a Game to `CONFIRMED` only when both explicit `scheduledAt` and `endsAt` exist;
- `endsAt` is canonical timing truth for live read models such as HOOMA NOW; consumers must not infer duration from football format;
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

## PlayPlayerListing

Player-looking discovery is a Play-owned durable concept separate from Event, Team, Community, and Gamers membership.

```text
PlayPlayerListing
  id
  userId             unique canonical HOOMA User owner
  lookingFor         GAME | TEAM
  createdAt
  updatedAt
```

Rules:

- one canonical listing per User;
- an authenticated canonical User may create/update/remove the listing even with no Team, Community, ULTRAS, or Gamer membership;
- public discovery is privacy-safe and projects only deliberately public listing state plus canonical UserPresentation fields;
- `userId` is ownership data and is not exposed by the public listing projection;
- display name, username, photo and bio remain owned by User/UserPresentation and are never duplicated into PlayPlayerListing;
- updating reuses the same canonical listing rather than creating parallel posts;
- PlayPlayerListing does not create Event, Team, Community, GamerProfile, or shadow membership records.

## TeamPlayerOffer recruitment handoff

`TeamPlayerOffer` remains a Teams-owned durable lifecycle even when the action begins on the Play Players feed.

```text
TeamPlayerOffer
  id
  teamId
  targetUserId
  offeredByUserId
  message?
  status             PENDING | ACCEPTED | DECLINED
  createdAt
  respondedAt?
  updatedAt
```

Rules:

- Play resolves a current `TEAM` PlayPlayerListing to its canonical target User and passes that target through a narrow application boundary; Teams infrastructure must not query Play-owned persistence directly;
- Teams authorizes the actor with its canonical `MANAGE_ROSTER` policy and owns offer persistence;
- one canonical offer identity exists per Team/target User and resend reuses that identity according to Team lifecycle policy;
- acceptance creates or reactivates the canonical TeamPlayer through Teams; decline does not create roster membership;
- Play persists no duplicate offer state and public Play discovery never exposes target User IDs for this workflow.

## EventPlayerInvite

Game invitations are Events-owned durable state reached through Play discovery orchestration.

```text
EventPlayerInvite
  id
  eventId
  targetUserId
  invitedByUserId
  status             PENDING | ACCEPTED | DECLINED | CANCELLED
  createdAt
  respondedAt?
  updatedAt
```

Rules:

- one canonical invitation identity exists per Event/target User;
- Play resolves only a current `GAME` PlayPlayerListing and passes the canonical target User to Events through a narrow application boundary;
- only a manager authorized by the existing Event management policy may invite, and only to a `PUBLISHED` `PLAY` Event;
- sending an invitation never creates an RSVP;
- only the target User may accept or decline;
- acceptance and RSVP allocation occur in one transaction using the same row-locked capacity/waitlist policy as ordinary Event Join;
- Event cancellation or completion closes pending invitations as `CANCELLED`;
- Play persists no duplicate invitation state and maps owning-domain pending records back to current listing IDs only for authenticated action readback.

---

# 12. PlayEventDetails

```text
PlayEventDetails
  eventId
  pitchType
  skillLevel
  format
  visibility: OPEN | PRIVATE
```

Play-specific fields belong here or in the canonical Play/Event contract rather than contaminating unrelated future Watch details. `visibility` is match-owned Play policy: `OPEN` is visible through authenticated Play Open Matches, while `PRIVATE` is hidden from unrelated accounts and direct IDs. Community privacy remains Community-owned and does not decide Play match discovery or grant private Community access to match viewers.

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

Whistle is one shared transient signal engine. PostgreSQL owns metadata only:

```text
WhistleMetadata
  id
  authorUserId
  contextType        COMMUNITY | EVENT | TEAM | RIDE | ULTRAS | GAMER_SQUAD | GAMER_DIRECT | USER_DIRECT
  contextId
  createdAt
  expiresAt
```

There is deliberately **no body column**.

Current rules:

- body lives only in Redis transient storage;
- maximum body length is 33 Unicode grapheme clusters, enforced server-side;
- each User may create at most 11 Whistles per UTC calendar day **globally across every enabled context**;
- quota enforcement is concurrency-safe at the durable metadata boundary;
- the Whistle session is the UTC calendar day from `00:00 UTC` to the next `00:00 UTC`;
- every Whistle expires at the next UTC midnight, not 24 hours after its individual creation time;
- unused daily quota never carries over; every new UTC day begins with all 11 sends available;
- authorized context members receive Whistle bodies directly in the feed; there is no Reveal operation or per-viewer reveal/seen state;
- Redis body TTL is the remaining lifetime until the next UTC midnight;
- expired PostgreSQL metadata is deleted by the Whistle cleanup path and is not permanent Whistle history;
- product visibility and quota reset take effect at UTC midnight even when physical PostgreSQL cleanup is triggered by a later list/send operation;
- `COMMUNITY` requires active Community membership;
- `EVENT` uses the existing Event member-content authorization boundary;
- `GAMER_DIRECT` uses its dedicated Gamer-specific server-derived direct-pair authorization and is never accepted through the generic raw-context route;
- `USER_DIRECT` is available only between two distinct authenticated canonical HOOMA Users through dedicated username-targeted routes;
- for `USER_DIRECT`, Identity owns username normalization and canonical User resolution, while Whistle receives only the resolved User identity through a narrow reader port;
- the `USER_DIRECT` context identity is the deterministic unordered pair of the two canonical User IDs, so reciprocal callers resolve to the same pair and username changes do not redefine that pair;
- clients never supply `senderUserId`, `targetUserId`, raw `contextId`, `pairKey`, or `contextType` for `USER_DIRECT` construction;
- `USER_DIRECT` is not accepted through `/api/v1/whistles/contexts/:contextType/:contextId`;
- no pair table, DirectMessage, Conversation, inbox, or second Whistle-body store exists for User Direct;
- `TEAM`, `RIDE`, `ULTRAS`, and `GAMER_SQUAD` remain disabled until their context-specific authorization slices are deliberately implemented;
- Whistle body content must never be copied into PostgreSQL, AuditLog metadata, OutboxEvent payloads, durable notifications, analytics, URLs, query strings, or server logs;
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

Platform Admin:

```text
/api/v1/admin/*
```

Every protected action is authorized server-side.

