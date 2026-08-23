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
- S3-compatible object storage for managed media when Media is implemented.

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
- send/reveal member-private Whistles;
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
Home | Play | Watch | HOOMA | Pitch
```

`Pitch` must not be replaced by `Places` in the permanent bottom navigation.

## 2.2 Home gateway

Home contains these eight primary product gateways:

```text
HOOMA | Teams | ULTRAS | Gamers
Places | Requests | Ride | FundMe
```

A gateway may truthfully show unavailable/coming-soon state until its real vertical slice exists. It must not fake backend completion.

## 2.3 HOOMA creation gateway

Creation begins from the HOOMA product and offers:

```text
HOOMA | TEAM | ULTRAS | GAMERS
```

This is a **shared entry/gateway only**.

It must not be implemented as one generic database `CommunityType`. Each selection enters its own domain-specific creation flow:

- HOOMA -> neighborhood/local Community domain;
- TEAM -> football Team domain;
- ULTRAS -> supporter-community domain;
- GAMERS -> gaming community/squad domain.

## 2.4 Places tabs

The Places directory exposes:

```text
LOUNGES/CAFES | PITCH | FANHUB
```

Default: `LOUNGES/CAFES`.

## 2.5 Core routes

At minimum, the product routing contract supports:

```text
/
/login
/register
/play
/watch
/hooma
/pitch
/places
/teams
/ultras
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

Profile is the user's identity and responsibility hub.

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

Random public visitors and non-members cannot list, send or reveal Community Whistles.

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

Play is HOOMA's football-activity/event product.

Core Play/Event requirements include:

- public discovery;
- event creation;
- event detail;
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

Preferred-position data, when collected for balancing/formation logic, must actually influence that logic rather than being accepted and ignored.

## 9.1 Play communication direction

The intended Play communication mechanic is **Event Whistle Board through the shared Whistle domain**, not a conventional permanent event chat.

Legacy Temporary Event Chat may remain in source while it is deliberately removed/migrated, but:

- it is not Whistle;
- it must not be renamed to Whistle;
- it must not be used as Whistle storage;
- new Play communication work should extend the shared Whistle engine through an explicit Event authorization slice rather than deepen conventional chat architecture.

Event Whistle context remains disabled until its Event-specific authorization/lifecycle slice is deliberately implemented and verified.

---

# 10. Watch

Watch remains a dedicated permanent product.

Approved future/current product requirements include:

- `/watch` route;
- football-viewing discovery;
- canonical Place association;
- Watch-specific event information;
- going/RSVP behavior where applicable;
- Watch venue/business application;
- Platform Admin approval;
- approved Watch capability tied to canonical Place;
- collector-ticket presentation where used;
- real persisted business/application states rather than UI-only labels.

Presence in this requirements file does not imply the Watch backend is already implemented.

---

# 11. Canonical Places

A `Place` represents one physical location and must not be duplicated because the same venue participates in several HOOMA products.

Approved Place data includes as needed:

- name;
- address/location;
- city/Houma/geography;
- coordinates;
- media;
- opening/contact/business information;
- moderation status;
- ownership records.

## 11.1 Place suggestion

Authenticated users may suggest a Place. Suggestion alone does not make the suggester an owner.

## 11.2 Ownership claims

Ownership claim is a separate lifecycle:

- submit claim/evidence;
- pending review;
- approve/reject;
- create verified ownership only after approval;
- audit sensitive decisions.

## 11.3 Place capabilities

One canonical Place may gain independent product capabilities/profiles such as:

- Lounge/Cafe;
- Pitch;
- Watch venue;
- FanHub-relevant discovery classification.

Do not duplicate the physical Place for each capability.

---

# 12. Pitch

Pitch is a permanent standalone route/product.

Requirements include:

- `/pitch` permanent route;
- permanent bottom-nav item;
- Pitch discovery;
- canonical Place relationship;
- Pitch capability/profile;
- owner/business application;
- Platform Admin approval;
- approved/rejected/pending state;
- Places `PITCH` tab reads the same underlying approved Pitch data;
- no duplicate Pitch venue database.

---

# 13. FanHub

FanHub is a discovery/context classification, not a user permission role.

Requirements:

- tied to canonical Place;
- surfaced from Places `FANHUB` and Watch where appropriate;
- never duplicates a physical venue;
- authorization must not depend on “FanHub” as a role.

---

# 14. Platform Admin

HOOMA requires a separate global App Admin surface.

Route:

```text
/admin
```

API namespace:

```text
/api/v1/admin/*
```

Approved Admin responsibilities include as the owning domains are implemented:

- Place suggestion moderation;
- ownership-claim review;
- Watch business/application review;
- Pitch business/application review;
- relevant content/report moderation;
- official football-entity catalog management;
- Gamer game-catalog management;
- operational/audit visibility.

Sensitive Admin writes create durable audit evidence without secrets or Whistle bodies.

Platform Admin bootstrap is explicit operational configuration, never a hardcoded production user ID.

---

# 15. ULTRAS

ULTRAS is an independent supporter-community domain. It is not Team tables renamed and not generic HOOMA Community rows with a type flag.

Approved product direction includes:

- association to an approved official football entity/catalog;
- privacy-safe public group identity;
- private member HQ;
- roles such as `LEADER | MODERATOR | MEMBER`;
- member/join lifecycle;
- GameDays/attendance where implemented;
- integration with shared Whistle, Ride, FundMe and Replay only through explicit domain relationships.

Only current authorized members may access the future private ULTRAS Whistle Board. It must use the single shared Whistle engine rather than creating another messaging system.

---

# 16. Gamers

Gamers is independent from football Teams.

Approved product direction includes:

- Platform Admin-controlled game catalog;
- Gamer profile/presentation owned by the appropriate Gamer domain;
- per-game handle/account data where needed;
- Gamer squads;
- squad membership/leadership;
- join lifecycle;
- squad challenge lifecycle;
- results;
- dispute/moderation path;
- Profile projections;
- shared Whistle only through explicit approved Gamer relationship/context authorization.

---

# 17. Requests

Requests support community help/resources/actions.

Approved requirements include:

- privacy-safe public discovery where appropriate;
- create request;
- claim request;
- concurrency-safe exclusive claims;
- release/complete lifecycle as defined by the final product slice;
- server-side authorization;
- clear requester/claimer identity boundaries.

---

# 18. Ride

Ride supports community transport coordination.

Approved requirements include:

- ride offer;
- ride request;
- matching;
- privacy-safe public projection;
- member/private detail;
- exact location protected from random public browsing;
- live tracking OFF by default;
- tracking, if introduced, explicit and privacy-scoped;
- ratings only when implemented as a complete lifecycle;
- shared Payments where applicable;
- shared Whistle only through a valid Ride relationship/context.

---

# 19. FundMe

FundMe provides community fundraising.

Approved requirements include:

- campaign creation;
- public campaign detail;
- contributions;
- Cash and/or Telegram Stars according to supported context;
- correct accounting/idempotency;
- cancellation/completion;
- reconciliation/audit where payments are involved.

---

# 20. Payments

Initial payment rails are:

```text
CASH
TELEGRAM_STARS
```

No credit-card rail is part of the initial requirement.

Crypto/Flouci or other payment methods are separate future decisions and must not be silently added.

## 20.1 Cash

Cash support requires real obligation/payment state, authorized confirmation, idempotency, cancellation/void rules and reconciliation evidence appropriate to the owning context.

## 20.2 Telegram Stars

Telegram Stars requires provider-valid invoice/pre-checkout/successful-payment handling, idempotent durable state, retry-safe update processing and refund/fulfillment behavior where supported.

## 20.3 Replaceable bot configuration

These are environment-only:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_BOT_USERNAME
TELEGRAM_BOT_ID
MINI_APP_URL
```

Changing the bot later must not require source rewrites.

---

# 21. Whistle

There is exactly **one shared Whistle engine**.

Whistle is a transient football/community signal mechanic, not a permanent social feed or generic chat system.

## 21.1 Content limit

Maximum:

```text
33 Unicode grapheme clusters
```

The server-authoritative validation must use grapheme clusters rather than byte count or naive UTF-16 `.length`.

## 21.2 Global daily quota

Maximum:

```text
11 total Whistles per user per UTC calendar day
```

The quota is global across every enabled Whistle context, not 11 per Team/Event/Community.

Quota enforcement must be concurrency-safe.

## 21.3 Storage invariant

Whistle body:

- Redis only;
- never PostgreSQL;
- never AuditLog;
- never analytics payloads;
- never URLs/query strings;
- never durable notification records;
- never Outbox payloads;
- never application logs.

PostgreSQL stores metadata/quota/context/expiry information only.

## 21.4 TTL and reveal

Unread body TTL:

```text
24 hours
```

First authorized reveal creates a viewer-specific reveal window:

```text
60 seconds
```

Requirements:

- later reads never restart/extend that first reveal deadline;
- server response reports the actual remaining reveal lifetime;
- after the viewer's reveal window expires, that viewer cannot restart it;
- another authorized viewer receives an independent reveal window.

## 21.5 Context authorization

A Whistle is accessible only through an approved owning-domain relationship.

Context identifiers may include:

```text
COMMUNITY | EVENT | TEAM | RIDE | ULTRAS | GAMER_SQUAD
```

The existence of an enum/context name does **not** mean the context is enabled.

Each context becomes usable only when its owning domain provides explicit authorization/lifecycle rules.

Current enabled context:

```text
COMMUNITY
```

for active HOOMA Community members.

Event, Team, Ride, ULTRAS and Gamer Squad Whistle contexts remain closed until their own authorization slices are deliberately implemented.

## 21.6 Notifications

A durable notification may indicate that a Whistle exists, for example “Youssef sent you a Whistle,” but must never contain the Whistle body.

Actual Telegram notification delivery, when enabled, requires real configured delivery with retry/idempotency; setting a delivered timestamp without an attempt is not sufficient.

## 21.7 Mandatory Whistle verification

Real PostgreSQL + Redis integration coverage must prove, as applicable:

- 11th send allowed / 12th denied;
- concurrent quota attempts;
- 24-hour body TTL;
- first reveal -> 60-second viewer window;
- no reveal-window extension;
- context authorization;
- outsider denial;
- complex Unicode grapheme limits;
- body absent from PostgreSQL;
- body absent from durable notification/outbox data;
- expiry behavior.

---

# 22. Media

When managed Media is implemented:

- PostgreSQL stores metadata/status/ownership;
- object storage stores bytes;
- Worker performs transforms where required;
- external image URLs may remain only as explicitly supported transitional/fallback fields, not as a substitute for a designed upload system.

Image processing may include validation, orientation, EXIF/GPS stripping, thumbnails/card/master variants, failure state and retry.

Any required external binary/runtime dependency must be explicitly provisioned and verified in deployment/preflight.

---

# 23. Outbox and Worker

Where an asynchronous side effect matters, durable business mutation and OutboxEvent creation should commit atomically.

Worker requirements:

- concurrency-safe claiming;
- retry/backoff;
- idempotent handlers;
- failure/dead-letter visibility;
- no duplicate business authorization policy;
- logging without secrets/Whistle bodies;
- health/startup verification.

Approved future/current use cases may include media processing, Telegram notification delivery, Replay generation and cleanup jobs.

---

# 24. Replay

Replay is post-activity memory/content tied to an eligible completed canonical activity/event.

Requirements when implemented:

- generated from the real source activity;
- media through shared Media architecture;
- privacy inherited from the originating context;
- no permanent Whistle-body history;
- public/private presentation based on source context.

---

# 25. Discovery / HOOMA NOW

Home/discovery may aggregate useful current activity across domains but remains a **read model/projection**, never a second source of business truth.

Requirements when implemented:

- deterministic canonical inputs;
- privacy-safe projections;
- no hidden permanent social graph;
- no fake engagement counters;
- no duplicated Event/Team/Place/Community records.

---

# 26. Preview Mode

If maintained/implemented, Preview Mode is frontend-only mock interception used for UI review.

It must never create:

- a production backend fake-auth bypass;
- fake production persistence;
- production builds that accidentally enable preview data.

Preview fixtures must use shared contracts/types.

---

# 27. Database requirements

HOOMA owns its target schema and migration history.

Rules:

- every durable schema change uses a committed migration;
- no production `prisma db push` replacement for migrations;
- important uniqueness/concurrency invariants belong in the service/database boundary where appropriate;
- speculative future-domain tables are not implementation;
- before first public release, any migration-history consolidation is an explicit reviewed database task proven from a clean database, not a permanent blocker on product development;
- after release, shipped migration history is forward-only;
- historical donor data, if ever imported, uses explicit ETL/reconciliation rather than redefining the app as a migration of the donor repository.

---

# 28. Security requirements

At minimum:

- Argon2id passwords;
- opaque hashed Web sessions;
- secure production cookies;
- origin/CSRF protection for browser writes;
- Telegram initData validation;
- fail-closed invalid credentials;
- `AUTH_CONFLICT` handling;
- server-side authorization on sensitive actions;
- rate limiting/abuse control where required;
- environment-only secrets;
- no credential/Whistle-body logging;
- safe upload validation when uploads exist;
- audit trail for sensitive App Admin decisions;
- object ownership checks;
- predictable error codes without secret/internal-data leakage;
- validated internal `returnTo` to prevent open redirects.

---

# 29. Testing requirements

Testing is behavior-oriented, not file-count theater.

## Unit

Use for deterministic policies/validation.

## Repository/integration

Use real disposable PostgreSQL where behavior depends on transactions, locking, constraints, idempotency, role assignment, migrations or outbox claiming.

Use real disposable Redis where behavior depends on Whistle TTL/reveal/transient semantics.

## HTTP/API

Test public/member boundaries, authentication, authorization, role/capability matrices, App Admin isolation and error contracts.

## Frontend

Test critical route/action states and Telegram-specific behavior where the platform semantics differ, even when both surfaces share the same feature tree.

## Worker

Test claim/retry/idempotency and actual configured handler side effects where implemented.

Prohibited shortcuts:

- throwaway `test.ts` files used only to satisfy a check;
- source-grep tests claimed as runtime proof;
- mocks used to claim real PostgreSQL/Redis concurrency correctness;
- “TypeScript compiles” used as proof that a feature works.

---

# 30. CI and release requirements

CI verifies the repository; CI does not repair it.

It must not regenerate/commit/push source or lockfiles.

The repository exposes verification commands including:

```text
npm ci
npm run db:generate
npm run db:validate
npm run architecture:check
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run deploy:preflight
npm run security:check
npm run db:migrate:status
```

Migration-specific changes additionally prove `db:migrate:deploy` against the intended disposable/deployment database.

Release/runtime claims require exact evidence appropriate to the scope: build, migration state, startup/health, real infrastructure, and safe live behavior where applicable.

---

# 31. Environment requirements

Configuration/credentials remain external to source.

At minimum the architecture may use variables such as:

```text
DATABASE_URL
REDIS_URL
WEB_ORIGIN
API_ORIGIN
TELEGRAM_BOT_TOKEN
TELEGRAM_BOT_USERNAME
TELEGRAM_BOT_ID
MINI_APP_URL
SESSION_COOKIE_NAME
SESSION_SECRET_OR_TOKEN_PEPPER
OBJECT_STORAGE_ENDPOINT
OBJECT_STORAGE_REGION
OBJECT_STORAGE_BUCKET
OBJECT_STORAGE_ACCESS_KEY_ID
OBJECT_STORAGE_SECRET_ACCESS_KEY
```

Exact names may evolve through `packages/config`, but secrets and replaceable deployment/service identities remain environment-controlled.

---

# 32. Definition of complete for an assigned task

A task/feature may be called complete only for the **exact assigned scope**, and only when all applicable layers are implemented and proven.

Applicable evidence may include:

1. product behavior is clear in this requirements contract or a newer owner instruction;
2. canonical owning domain is clear;
3. schema/migration is correct if persistence changed;
4. contracts/validation agree;
5. server-side authorization exists;
6. application/domain service behavior exists;
7. repository/infrastructure integration exists;
8. API route exists where required;
9. real frontend action/state is connected where required;
10. loading/empty/error/pending/success states are handled where relevant;
11. Redis/Worker/media side effects are complete where required;
12. permanent regression/integration tests prove critical behavior;
13. applicable build/static checks pass;
14. exact deployment/runtime evidence is checked when deployment is part of the claim;
15. read-back/live behavior is proven when required for a 10/10 claim.

A task is **not complete** merely because:

- a Prisma model exists;
- a page exists;
- a button exists;
- an endpoint exists;
- donor code exists;
- mocks show a happy path;
- a plan says it is done;
- a container deployed successfully without proving the user flow.

Every completion report follows `AGENTS.md` and `docs/LIVING_BUILD_PLAN.md`: root cause, source trace, exact changed files, commit/head, proof, remaining risk and evidence-based score out of 10.

---

# 33. Living product-contract rule

This file should evolve when **product behavior** changes.

Do not turn it into:

- a feature progress table;
- a global freeze plan;
- a historical implementation sequence;
- a list of speculative schema details for every future idea.

For future-approved domains, this document may state product direction before implementation exists, but the text must make that distinction clear.

When the product owner makes a newer explicit decision that conflicts with this file, implementation follows the newer decision and this contract should be updated promptly so later agents do not drift back to stale behavior.
