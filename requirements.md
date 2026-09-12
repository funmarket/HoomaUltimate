# HOOMA — REQUIREMENTS

Status: **Primary product acceptance contract**  
Repository/workspace: `funmarket/HoomaUltimate`  
Product name: **HOOMA**

`HoomaUltimate` is only the repository/workspace name used to distinguish this rebuild from older HOOMA codebases. The application, UI, API branding and product language are **HOOMA**.

This file defines product behavior and acceptance rules. It is not a progress ledger, freeze plan, implementation-order document, or proof that a future feature is already built.

For working rules, read `AGENTS.md` and `docs/LIVING_BUILD_PLAN.md`. Architecture belongs in `structure.md`; canonical data/authority belongs in `docs/CANONICAL_MODEL.md`; architectural decisions belong in `docs/DECISIONS.md`.

---

## 0. Product definition

HOOMA is a football/community activity platform delivered through:

- a normal Web application;
- a Telegram Mini App delivery surface;
- one shared API;
- one shared PostgreSQL database;
- Redis/Valkey for explicitly transient state;
- an asynchronous Worker where durable background work is required;
- S3-compatible object storage for managed media bytes used by current domain-owned media flows and any future generic Media architecture.

The older HOOMA repositories and uploaded historical implementations are read-only donors/reference material. They may inform behavior and visuals, but they do not define the new runtime, schema, migrations, auth architecture, or completion state.

---

# 1. Global product principles

## 1.1 Public first, authentication at the action boundary

Users must be able to browse meaningful privacy-safe public content without signing in.

Authentication is required when a user attempts a protected action such as:

- join;
- RSVP;
- create;
- edit;
- manage;
- claim;
- contribute/pay;
- challenge;
- send/read member-private Whistles;
- access member-private content.

Web guests attempting a protected action must be sent through a validated internal `returnTo` path. Telegram users authenticate through validated Mini App initData rather than the classic Web login flow.

## 1.2 One product, two authentication transports

HOOMA has one canonical User and one business-data source.

Web and Telegram are separate authentication transports into that same product:

```text
WebCredential/WebSession -> User
TelegramIdentity         -> User
```

No heuristic merge is allowed.

## 1.3 Admin means App Admin only

The word **Admin** is reserved for global application authority only.

Canonical global role:

```text
PLATFORM_ADMIN
```

Scoped domains use their own product terminology, such as:

- Founder;
- Coach;
- Assistant;
- Leader;
- Moderator;
- Member;
- Player;
- Owner.

A Team manager uses the **Coach Control Room**, never a generic Admin Dashboard.

## 1.4 One canonical source of truth per concept

There must be one authoritative owner for each durable concept, including:

- User identity/presentation;
- HOOMA Community;
- Team;
- Event;
- Place;
- payment state;
- ULTRAS group;
- Gamer squad;
- Whistle metadata;
- media metadata.

Different screens may project the same record but must not create competing physical entities or parallel role systems.

## 1.5 Product utility over social-feed mechanics

HOOMA is built around football activity, local community coordination and real-world participation.

Do not introduce permanent follower/feed/engagement mechanics merely to imitate a social network. Shared transient features such as Whistle must keep their explicit product rules and retention boundaries.

---

# 2. Locked navigation and information architecture

## 2.1 Permanent bottom navigation

Exactly:

```text
Home | Play | Watch | HOOMA | Athletes
```

`Athletes` is the fifth permanent bottom-navigation item and routes to `/athletes`.

Pitch remains a real standalone product at `/pitch` and a Home gateway. Removing Pitch from permanent bottom navigation does not remove, merge, or deprecate the Pitch domain.

## 2.2 Home gateway

Home contains these six primary product gateways in this exact current order:

```text
HOOMA | Teams | Pitch | Places | Ride | Requests
```

The visible Home label is `Places` for canonical Places discovery at `/places`. The source may retain an internal `spots` identifier for that gateway; that internal id does not create a second venue domain and does not make `Spots` the current visible Home label. Watch may still use `Spots` as Watch-owned product language independently.

Gamers, ULTRAS and FundMe are not Home discovery gateways in the current IA, but this does not delete those product concepts or their independent ownership.

Ride exposes its Ride-owned gateway and real frontend routes through its current vertical slice. Requests may expose only behavior actually implemented by its Requests-owned slices. Neither surface may fake backend completion, listings, matching, claims, payments or persistence.

## 2.3 HOOMA creation

`/hooma` is the Communities-owned product surface. It creates only canonical HOOMA neighborhood/local Communities through `/hooma/new`.

Teams and future supporter-community domains keep their own creation surfaces. A Team may exist with zero players.

A Team is created from `/teams/new`, where the user selects one eligible HOOMA community context before the Teams-owned create request is submitted. If the user must create that HOOMA first, Teams may send only the bounded `/hooma/new?after=team-create` continuation; successful HOOMA creation returns to `/teams/new?communityId=<created-id>`. Future supporter-community work must ship through its own domain route when authorized.

Do not implement this as one generic database `CommunityType`, one generic creator, or a selector that calls Team or future supporter domains "Community type" options inside the HOOMA page.

After successful creation, the canonical entity is discoverable in its own product feed:

- HOOMA Community -> `/hooma` HOOMA feed;
- Team -> `/teams` Teams feed.

No flow may duplicate one created entity into another domain merely to make it appear in a feed.

Gamers remains an existing independent product and route family, but it is not offered from the current Home gateway or HOOMA creation surface. FundMe is presented under Requests as a page tab until Fundraising/Payments are separately authorized.

## 2.4 Athletes foundation

Athletes is a separate HOOMA-connected sports-community domain inside the existing HOOMA application. It uses canonical `User` identity, its own `AthletesCommunity`, `AthletesMembership` and `AthletesJoinRequest` lifecycle, and its own `/athletes` product routes.

Athletes is not a HOOMA Community subtype, not a Team subtype, not a generic creator option, and not an authorization to create `CommunityKind.ATHLETES`, `CommunityType`, `Community.type`, `GenericMembership`, `GenericCommunity`, `CreateAnythingPage`, `CreationService`, or `createEntity`.

Current Athletes behavior includes public discovery/detail, create, update/archive, join/request/cancel, manager request approval/decline, member list, direct-add by canonical username, bounded member removal, and an Athletes member Whistle Board through the shared Whistle engine. Equipment, marketplace, Payments, Ride integration, Requests integration, FundMe and ULTRAS remain separate slices unless explicitly implemented by their owning domains.

Current Photo Board behavior is member-private and Founder-curated. Only an active `FOUNDER` membership in the same active Athletes community may upload or delete Photo Board photos. Active `MODERATOR` and `MEMBER` memberships may view but may not upload or delete. Outsiders, public/anonymous users, memberships from another Athletes community, and archived Athletes communities are denied active Photo Board access. Photo Board metadata is Athletes-owned durable PostgreSQL data, image bytes use shared object storage, and accepted JPEG/PNG/WebP uploads up to 5 MiB are normalized server-side to WebP with a maximum 1600px edge and no enlargement before durable storage. Founder deletion removes the canonical Athletes Photo Board record and queues the existing Athletes object-reconciliation cleanup path; it does not create a generic Media or social-feed authority. The current Photo Board has no captions, likes/reactions, comments/replies, albums, manual ordering, moderator/member curation, or public board.

Athletes is a permanent navigation destination at `/athletes`. It must not appear inside the HOOMA Community create section.

## 2.5 Places tabs

The Places directory exposes:

```text
LOUNGES/CAFES | PITCH | FANHUB
```

Default: `LOUNGES/CAFES`.

## 2.6 Core routes

At minimum, the product routing contract supports:

```text
/
/login
/register
/play
/watch
/hooma
/athletes
/pitch
/places
/teams
/gamers
/requests
/rides
/fundme
/profile
/settings
/admin
```

Feature-specific child routes are added only when their actual vertical slice requires them.

---

# 3. Visual and interaction requirements

## 3.1 Brand language

HOOMA uses a classy vintage-football identity:

- almost-black/deep-black primary backgrounds;
- warm cream typography;
- muted aged-gold borders/separators;
- lime-green accents for action/status emphasis;
- strong white football iconography;
- real football, venue, supporter and player photography where appropriate;
- subtle paper/print/heritage texture;
- restrained glow/distress treatment;
- modern mobile usability despite the vintage styling.

The product must not drift into a generic SaaS/dashboard aesthetic.

## 3.2 Mobile first

Web and Telegram must work cleanly on phone-sized layouts first.

Requirements include:

- no overlapping text;
- no unintentionally clipped panels/dialogs;
- no accidental horizontal scrolling;
- safe-area support;
- keyboard-safe forms;
- usable touch targets;
- readable type scales;
- responsive images/media;
- loading, empty, error, disabled, pending and success states for interactive flows.

## 3.3 Telegram experience

Even though Web and Telegram currently share the HOOMA frontend tree, Telegram must still behave as a genuine Mini App where relevant:

- validated initData;
- `Telegram.WebApp.ready()` lifecycle;
- viewport/expand behavior;
- safe-area handling;
- BackButton integration;
- Telegram theme awareness where useful;
- haptics where appropriate;
- MainButton only when it improves the flow;
- Telegram-aware navigation without browser-history hacks.

---

# 4. Authentication and identity

## 4.1 Canonical User

There is one canonical `User` domain identity.

Authentication identities attach to that User; they do not replace it.

## 4.2 Web registration

Classic Web registration supports:

Required:

- login username;
- password;
- display username.

Optional/progressive presentation data may include:

- email;
- display name;
- photo;
- bio;
- location/Houma;
- favorite club;
- approved identity/presentation choices.

Login username and public/display username are conceptually distinct.

## 4.3 Password security

Passwords use **Argon2id**.

Requirements:

- appropriately tuned parameters;
- library-generated unique salts;
- no plaintext password logging;
- no reversible password storage;
- rate limiting/lockout/abuse controls on login attempts.

## 4.4 Web sessions

Web sessions use opaque random tokens.

Only token hashes persist in PostgreSQL.

Production cookies are:

- HttpOnly;
- Secure;
- configured with an appropriate SameSite policy for the actual deployment topology;
- explicitly expiring;
- revocable.

Logout revokes the session server-side. Browser state-changing requests require origin/CSRF protections.

Web sessions record `lastSeenAt` only through the Identity service session-resolution boundary with up to 60-second throttling to prevent write amplification. `lastSeenAt` is the sole durable web activity truth for Athletes and other features that need user-presence context; there is no fallback to Redis, Telegram, online presence dots, or duplicate online-status tables.

## 4.5 Telegram authentication

Telegram authentication must:

1. receive Mini App initData;
2. validate it cryptographically server-side;
3. reject explicitly invalid initData;
4. resolve/create `TelegramIdentity`;
5. resolve to the canonical User;
6. never trust Telegram profile fields without validated initData.

Telegram bot identity/configuration must stay in environment variables so the bot can be replaced without source-code rewrites.

## 4.6 Identity conflict

If valid Web and Telegram credentials in one request resolve to different Users:

```text
AUTH_CONFLICT
```

must be returned.

The system must never silently choose one identity.

## 4.7 No heuristic account merge

Never auto-merge accounts using name, username, email similarity, photo, Telegram handle, location, favorite club or other presentation data.

Future account linking requires an explicit authenticated workflow.

---

# 5. Public/member/Admin API boundary

Privacy-safe public reads:

```text
/api/public/v1/*
```

Authenticated member/private actions:

```text
/api/v1/*
```

Global Platform Admin actions:

```text
/api/v1/admin/*
```

Every protected action must be authorized server-side. Hiding a button is never authorization.

Tests should prove forbidden callers are denied even if they manually call the API.

---

# 6. Profile requirements

## 6.1 Presentation

Profile supports the canonical presentation data actually owned by Identity, including as applicable:

- photo;
- display name;
- display username;
- bio;
- approved location/Houma presentation.

Future product-specific presentation such as favorite club, ULTRAS identity or Gamer identity may appear when those owning domains are implemented, but must not be prematurely persisted inside an unrelated profile table.

## 6.2 Responsibilities and memberships

Profile projects real canonical relationships, such as:

- My HOOMAs and Community role;
- My Teams and Team role/responsibility;
- future ULTRAS memberships/role when ULTRAS exists;
- future Gamer Squad memberships/role when Gamers exists;
- future owned/managed Places when Places ownership exists;
- Platform Admin entry only for an actual Platform Admin.

Clicking a listed entity opens the real entity page. Management entry points appear only when the user has the required server-recognized authority.

## 6.3 Edit profile

The user has a clear Edit Profile action.

Profile editing updates the canonical Identity/UserPresentation source rather than duplicating page-local state.

---

# 7. HOOMA Communities

HOOMA is the neighborhood/local-community domain represented in permanent navigation.

## 7.1 Public experience

Privacy-safe public behavior includes:

- discovery;
- community detail;
- community logo;
- banner;
- name/description;
- city/Houma/local-area presentation;
- appropriate member/team counts;
- visible Join action at the protected-action boundary.

## 7.2 Membership lifecycle

Community roles:

```text
FOUNDER | COACH | MEMBER
```

Rules:

- no scoped role named Admin;
- authenticated outsider may Join and becomes MEMBER;
- a previous member may rejoin using the canonical membership identity;
- Member/Coach may Leave according to policy;
- Founder cannot silently abandon the Community through the ordinary Leave action;
- Founder may promote an existing active MEMBER to COACH;
- Founder may demote COACH to MEMBER;
- Founder may remove eligible members/coaches according to policy;
- Coach may manage ordinary members only within explicitly granted Community authority;
- Coach may not remove Founder or another Coach unless a newer explicit policy changes that rule;
- private member directory/content is not public discovery data.

## 7.3 Community HQ

Members receive a private Community HQ containing member-only modules as they are implemented.

Current Community identity should support logo/banner presentation. Managed uploads may later replace direct URL-based early-phase media without changing Community identity semantics.

## 7.4 Private HOOMA Whistle Board

Current authorized Community members can access the private HOOMA Whistle Board through the single shared Whistle engine.

Random public visitors and non-members cannot list, send or read Community Whistles.

---

# 8. Teams

Teams preserve a deep football-management experience while keeping Team identity separate from Community identity.

## 8.1 Public Team experience

Public users may access privacy-safe:

- Team discovery;
- Team profile;
- crest/photo;
- location;
- permitted roster presentation;
- public games/challenges where appropriate.

Public browsing does not require a HOOMA account.

## 8.2 TeamPlayer identity

A `TeamPlayer` is roster membership for an **existing canonical HOOMA User**.

Requirements:

- `userId` is required for TeamPlayer;
- no placeholder/offline TeamPlayer identity is created for a person without a HOOMA account;
- authentication/account creation happens before a protected join/membership action creates TeamPlayer;
- Team-specific roster data belongs on TeamPlayer;
- display name, username, photo, bio and other canonical presentation remain owned by User/UserPresentation and must not be duplicated into TeamPlayer;
- the same User must not be duplicated within the same Team roster;
- roster history uses the canonical join/leave lifecycle defined by the current model.

A Team may exist with zero players.

## 8.3 Team responsibilities

Canonical direct management responsibilities:

```text
COACH | ASSISTANT
```

Player participation is represented through TeamPlayer membership rather than turning `PLAYER` into a broad management role.

Coach has ultimate Team management authority within the Team domain.

## 8.4 Coach Control Room

Coach must be able to perform the real authorized Team-management lifecycle, including as applicable:

- edit Team details;
- manage crest/media;
- manage roster membership;
- open player profiles;
- appoint/revoke Assistant;
- grant/revoke Assistant capabilities;
- manage lineups;
- create challenges;
- respond to/cancel challenges according to lifecycle;
- manage Team events/games.

The management surface is **Coach Control Room**, never Admin Dashboard.

## 8.5 Assistant capabilities

Assistant authority is explicit and granular.

Canonical capability set:

```text
EDIT_TEAM
MANAGE_ROSTER
MANAGE_LINEUP
CREATE_CHALLENGE
RESPOND_TO_CHALLENGE
MANAGE_TEAM_EVENTS
```

Possessing `ASSISTANT` alone must not grant every Coach action.

## 8.6 Team lineups

Teams support:

- lineup creation;
- lineup slots;
- TeamPlayer assignment;
- formations/match formats including smaller-sided football;
- normalized pitch positioning where represented;
- server-side authority;
- public/published vs private/draft distinction where applicable.

## 8.7 Team challenges and games

Requirements include:

- challenge another eligible Team;
- never challenge the same Team as itself;
- incoming/outgoing challenge state;
- detail;
- accept;
- decline;
- cancel under correct conditions;
- concurrency-safe lifecycle;
- accepted challenge produces/associates one canonical TeamGame;
- leader coordination appears only under its accepted-match authorization rules;
- public Game data never leaks private leader conversation.

---

# 9. Events and Play

Play is HOOMA's football-activity, discovery and participation product. Scheduled games remain canonical Events; player-looking posts and recruitment discovery are separate Play concepts and must not be forced into Event records.

Core Play/Event requirements include:

- public Watch discovery/detail;
- authenticated Play Open Matches discovery;
- authenticated Play match detail;
- event creation;
- date/time/timezone;
- location/venue information;
- capacity;
- RSVP;
- waitlist when configured/capacity is reached;
- concurrency-safe capacity decisions;
- organizer authority;
- formation builder;
- check-in;
- completion/cancellation lifecycle;
- eventual Replay integration when Replay is implemented.

Play match visibility is owned by `PlayEventDetails.visibility`, not by the parent Community. `OPEN` Play matches are discoverable and viewable by authenticated HOOMA accounts, including when linked to a `PRIVATE` Community. `PRIVATE` Play matches are hidden from unrelated accounts and direct IDs must not bypass that policy. Creator, authorized manager, active participant and pending/accepted invitee access remains valid for Play lifecycle actions where the Play/Event policy grants it. Seeing or joining an `OPEN` Play match does not grant Community membership or private Community content access.

Preferred-position data, when collected for balancing/formation logic, must actually influence that logic rather than being accepted and ignored.

## 9.1 Players looking to play

`/play` includes a public **Players** feed for people looking for football opportunities.

Requirements:

- an authenticated canonical HOOMA User may publish a player-looking post even if they belong to no Team, HOOMA Community, ULTRAS group or Gamer squad;
- a player-looking post can state that the user is looking for a `GAME` or a `TEAM`;
- the post belongs to the canonical User and Play discovery domain, not to a fabricated Team, Community or Event;
- public presentation uses only privacy-safe canonical User presentation data plus the deliberately published listing content;
- creating, editing or removing the listing is authenticated and owner-authorized;
- absence of Team/Community membership must never block this Play discovery action.

Direct player actions from this feed preserve owning-domain authority:

- for a `TEAM` listing, Play resolves the current listing owner and hands the canonical target User to Teams; the selected Team must be one the actor can manage for roster actions, and Teams alone authorizes and persists the canonical `TeamPlayerOffer`;
- for a `GAME` listing, Play resolves the current listing owner and hands the canonical target User to Events; the selected Event must be a `PUBLISHED` `PLAY` Event the actor can manage under the existing Event organizer policy;
- sending a Game invitation never creates or changes an RSVP; Events owns the durable `EventPlayerInvite`;
- only the invited User may accept or decline an Event invitation; acceptance uses the same canonical, row-locked Event RSVP capacity/waitlist transaction as ordinary Join;
- cancelling or completing an Event closes its pending player invitations;
- pending Team offers and Event invitations are read back from their owning domains and mapped to Play listing IDs server-side; browser-local "sent" flags are not lifecycle authority;
- public Play listing projections do not expose canonical target User IDs merely to support these actions.

## 9.2 Community and group recruitment cards

Play also supports recruitment discovery for canonical entities that are looking for members.

When the owning domain exists, authorized leadership may publish a recruitment card for:

- Team;
- HOOMA Community;
- ULTRAS group;
- Gamer community/squad.

A recruitment card communicates at minimum:

- the canonical entity name and type;
- its mission, goal or interest;
- what or who it is looking for;
- a **Request to join** action.

The join-request lifecycle is:

```text
REQUEST TO JOIN -> PENDING -> APPROVED | DENIED
```

Rules:

- requests are tied to the canonical applicant User and canonical target entity;
- only authority recognized by the owning domain may approve or deny;
- approval must hand off to the owning domain's canonical membership/roster lifecycle rather than create a shadow Play membership;
- Team approval resolves through Team membership/TeamPlayer rules;
- HOOMA approval resolves through Community membership rules;
- ULTRAS and Gamers resolve through their own membership domains once those domains actually exist;
- Play is the discovery/recruitment surface, not a generic membership database;
- ULTRAS/Gamers recruitment must not create placeholder records before their canonical domains exist.

This recruitment workflow does not by itself redefine every other direct join entry point. Any change to an owning domain's general join policy must be made explicitly in that domain rather than inferred from the existence of a Play recruitment card.

## 9.3 Play communication direction

The intended Play communication mechanic is **Event Whistle Board through the shared Whistle engine**. Event Chat remains a transient temporary-window implementation and will be cleaned up by a separate task.

---

# 10. Athletes

Athletes is a permanent HOOMA-connected sports-community domain with its own membership lifecycle, join-request authority, member-private content, and photo-board management authority. It shares the canonical User identity and does not require Teams, Communities, or membership in any other domain. Founding an Athletes community (a sports discipline like football, basketball, or cycling) authorizes profile visibility to potential members and the ability to manage athletes' membership requests and member list. An Athletes community can be public or private with open or approval-required membership policies. Photo Board is member-private and Founder-curation-only.

### 10.1 Active Athletes presentation

When browsing Athletes communities, a member-private Active Athletes list shows current active members with:

- avatar (canonical User photo);
- display name (canonical User presentation);
- @username (canonical User presentation);
- role (FOUNDER / MODERATOR / MEMBER);
- last-seen text derived from `WebSession.lastSeenAt` when available, showing "Last seen just now", "Last seen Xm ago", "Last seen Xh ago", or "Last seen Xd ago" with 60-second resolution floors, or empty if no web activity is recorded.

Navigation on any member row points to the canonical user profile at `/profile/:username`, not to a duplicate or Athletes-owned profile. Web session activity is the sole source for last-seen; there is no fallback to Redis, Telegram status, online dots, or presence tables. Members with no recorded web activity show a blank last-seen field.

---

# 11. Locked scope out

The following are not part of the current product scope unless explicitly unblocked by a newer ADR:

- ULTRAS detailed behavior
- Gamers detailed behavior (except existing independent implementation)
- Fundraising and Payments
- generic Media/library architecture
- Replay and post-match replay

---

# 12. Acceptance gates

Before a build is considered complete:

1. Product behavior must match this contract.
2. Architecture and data ownership must match `structure.md` and `docs/CANONICAL_MODEL.md`.
3. Authorization must be server-side and verified by tests.
4. No feature may be faked or partially persisted.
5. `requirements.md`, `structure.md`, and `docs/CANONICAL_MODEL.md` must be current with the actual implementation.
6. All CI gates must pass.
7. Exact-commit production deployment must succeed.
8. Runtime/integration smoke tests must pass.

