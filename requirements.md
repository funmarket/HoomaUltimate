# HOOMA ULTIMATE — REQUIREMENTS

Status: **Primary product acceptance contract**  
Repository: `funmarket/HoomaUltimate`  
Application type: **new third application / greenfield implementation**

---

## 0. Product definition

HOOMA ULTIMATE is a new football/community activity platform delivered as:

- a normal Web application;
- a Telegram Mini App;
- one shared API;
- one shared PostgreSQL database;
- Redis/Valkey for transient state;
- an asynchronous Worker;
- S3-compatible object storage for media.

It combines the strongest verified product behavior and architectural lessons from two prior HOOMA implementations, but it is **not an upgrade, migration, fork, or continuation of either one**.

The older repositories are reference donors only.

### Greenfield requirements

1. The target repository owns its own architecture.
2. The target repository owns its own schema.
3. The target repository owns its own initial migration history.
4. No old database compatibility requirement exists unless separately introduced later as an explicit data-import project.
5. No old feature is considered complete merely because equivalent code exists in a donor repository.
6. Donor behavior may be reimplemented only when it satisfies the requirements below.

---

## 1. Product principles

### 1.1 Public first, authentication at the action boundary

Users must be able to browse meaningful public content without signing in.

Authentication is required when a user attempts a protected action such as:

- join;
- RSVP;
- create;
- edit;
- manage;
- claim;
- contribute/pay;
- challenge;
- send a Whistle;
- access member-private content.

Web guests attempting a protected action must be redirected to a validated internal `returnTo` path.

### 1.2 One product, two independent access surfaces

Web and Telegram use the same business data and API but keep independent platform shells and authentication paths.

The Telegram experience must feel like a real Telegram Mini App, not a web page embedded in Telegram.

### 1.3 Admin means App Admin only

The word **Admin** is reserved exclusively for the global application administrator authority.

Global role:

```text
PLATFORM_ADMIN
```

Scoped roles must use product terminology:

- Founder;
- Coach;
- Assistant;
- Leader;
- Moderator;
- Member;
- Player;
- Owner.

A Coach must never see a screen called “Admin Dashboard” for Team management. That surface is the **Coach Control Room**.

### 1.4 No duplicate domain truth

There must be one canonical source of truth for:

- User identity;
- Team;
- Place;
- Event;
- payment state;
- ULTRAS group;
- Gamer squad;
- Whistle metadata;
- media metadata.

Different product surfaces may project the same canonical record but must not create competing physical entities.

---

## 2. Locked navigation and information architecture

### 2.1 Permanent bottom navigation

Exactly:

```text
Home | Play | Watch | HOOMA | Pitch
```

No implementation may replace `Pitch` with `Places` in permanent bottom navigation.

### 2.2 Home gateway

Home must contain exactly these eight primary gateway cards:

```text
HOOMA | Teams | Ultras | Gamers
Places | Requests | Ride | FundMe
```

### 2.3 Places tabs

The Places directory must expose:

```text
LOUNGES/CAFES | PITCH | FANHUB
```

`LOUNGES/CAFES` is the default tab.

### 2.4 Core routes

At minimum, product routing must support:

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

Feature-specific child routes are added as the related vertical slices are implemented.

---

## 3. Visual and interaction requirements

### 3.1 Brand language

HOOMA uses a classy vintage-football identity:

- almost-black primary background;
- subtle paper/print texture;
- warm cream display typography;
- muted aged-gold borders/separators;
- lime-green accents where action/status emphasis is needed;
- strong white football icons;
- real football, venue, supporter, and player photography where appropriate;
- restrained glow/distress effects;
- modern mobile usability despite vintage styling.

The product must not regress into a generic SaaS/dashboard aesthetic.

### 3.2 Mobile-first

Both Web and Telegram must work cleanly on phone-sized layouts first.

Requirements:

- no overlapping text;
- no clipped dialogs/panels;
- no horizontal scrolling unless intentionally designed;
- safe-area support;
- keyboard-safe forms;
- large enough tap targets;
- readable typography;
- responsive image treatment;
- loading, empty, error, disabled, pending, success states for interactive flows.

### 3.3 Telegram-specific UX

Telegram app must support, where relevant:

- validated `initData`;
- `Telegram.WebApp.ready()`;
- expansion/viewport handling;
- BackButton behavior;
- safe-area and viewport variables;
- Telegram theme awareness where useful;
- haptics for suitable actions;
- MainButton only where it improves the flow;
- Telegram navigation lifecycle without browser-history hacks.

---

## 4. Authentication and identity requirements

### 4.1 Canonical User

There is one canonical `User` domain identity.

Authentication identities attach to that User but do not replace it.

### 4.2 Web registration

Web registration must support:

Required:

- login username;
- password;
- display username.

Optional/progressive:

- email;
- display name;
- photo;
- bio;
- location;
- favorite club;
- identity/audience presentation choices.

Login username and display username are conceptually distinct.

### 4.3 Password security

Passwords must use **Argon2id**.

Requirements:

- secure tuned parameters;
- unique salts generated by the library;
- no plaintext password logging;
- no reversible encryption;
- rate limiting and lockout/abuse controls on login attempts.

### 4.4 Web sessions

Web sessions must use opaque random tokens.

Only the token hash is stored in PostgreSQL.

Production cookie requirements:

- HttpOnly;
- Secure;
- appropriate SameSite policy;
- explicit expiry;
- revocable;
- logout invalidates the session server-side.

Browser state-changing requests require origin/CSRF protections.

### 4.5 Telegram authentication

Telegram authentication must:

1. receive Telegram Mini App initData;
2. validate it cryptographically server-side;
3. reject explicitly supplied invalid initData;
4. resolve/create a `TelegramIdentity`;
5. resolve to the canonical User;
6. never trust Telegram profile data without validated initData.

Production Telegram service startup must fail when required bot configuration is absent.

### 4.6 Identity conflict

If valid Web credentials resolve to User A and valid Telegram credentials in the same request resolve to User B:

```text
AUTH_CONFLICT
```

must be returned.

The system must never silently choose one identity.

### 4.7 No heuristic account merge

Never auto-merge accounts using:

- same username;
- same display name;
- same email similarity;
- same photo;
- Telegram handle;
- location;
- favorite club.

Future account linking requires an explicit authenticated workflow.

---

## 5. Public/member API requirements

### 5.1 Public namespace

Privacy-safe public reads live under:

```text
/api/public/v1/*
```

### 5.2 Member namespace

Authenticated member/private actions live under:

```text
/api/v1/*
```

### 5.3 Platform Admin namespace

Global Admin actions live under:

```text
/api/v1/admin/*
```

### 5.4 Server-side authorization

Every protected action must be authorized server-side.

Hiding a button is never considered authorization.

Tests must prove that forbidden callers receive the correct denial even when they manually call the API.

---

## 6. Profile requirements

The Profile must function as the user's identity and responsibility hub.

### 6.1 Presentation

Profile supports:

- photo;
- display name;
- display username;
- bio;
- location/Houma where applicable;
- favorite club;
- Player/Fan/Gamer identity presentation;
- public/private presentation rules.

Generic valid image URLs may be supported during early phases, but final media architecture must move uploaded media into managed object storage.

### 6.2 Responsibilities and memberships

Profile must visibly render and link to:

- My Teams;
- role on each Team: Player / Coach / Assistant;
- My ULTRAS groups;
- ULTRAS role;
- My Gamer Squads;
- Gamer Squad role;
- owned/managed Places where applicable;
- global Platform Admin badge/entry only for real Platform Admins.

Clicking a Team must open that Team. A Coach/Assistant must be able to reach the appropriate Team management surface from Profile.

### 6.3 Edit profile

The user must have a clear Edit Profile action.

Profile editing must update the canonical profile source rather than duplicate local presentation state.

---

## 7. HOOMA communities requirements

HOOMA is the neighborhood/community domain in the primary navigation.

Requirements:

- public discovery/detail where privacy-safe;
- member-only community areas where applicable;
- roles:
  - `FOUNDER`
  - `COACH`
  - `MEMBER`
- no scoped role named Admin;
- creation from a single HOOMA creation entry;
- creation chooser must allow:
  - `TEAM`
  - `ULTRAS`
- choosing either branch opens that domain's proper creation flow.

Community permissions must remain distinct from Team, ULTRAS, and global Admin permissions.

---

## 8. Teams requirements

Teams must preserve the deep football-management experience expected from mature HOOMA behavior.

### 8.1 Public Team experience

Public users can access privacy-safe:

- Team discovery;
- Team profile;
- crest/photo;
- location;
- public roster summary where permitted;
- upcoming/public games/challenges where appropriate.

### 8.2 Team roles

Canonical Team responsibilities:

```text
COACH | ASSISTANT | PLAYER
```

The Coach has ultimate Team management authority.

### 8.3 Coach Control Room

Coach must be able to:

- edit Team details;
- manage crest/photo where applicable;
- add players;
- remove/fire/deactivate players;
- appoint an Assistant;
- revoke Assistant;
- grant/revoke Assistant capabilities;
- manage lineups;
- create challenges;
- accept/decline/cancel challenges according to lifecycle;
- manage Team events/games;
- open player profiles.

The management page is called **Coach Control Room**, not Admin.

### 8.4 Assistant capabilities

Assistant authority is explicit and granular.

Required capabilities:

```text
EDIT_TEAM
MANAGE_ROSTER
MANAGE_LINEUP
CREATE_CHALLENGE
RESPOND_TO_CHALLENGE
MANAGE_TEAM_EVENTS
```

Possessing `ASSISTANT` alone must not automatically grant every Coach action.

### 8.5 Team lineups

Teams require:

- lineup creation;
- lineup slots;
- player assignment;
- formation/position representation where applicable;
- server-side Team authority checks.

### 8.6 Team challenges

Requirements:

- challenge another eligible Team;
- cannot challenge own Team;
- incoming/outgoing challenge lists;
- detail;
- accept;
- decline;
- cancel under correct conditions;
- accepted challenge can produce/associate Team game;
- challenge-scoped messages/conversation;
- server-side lifecycle enforcement.

### 8.7 Team games

Team games must be navigable from Team and challenge flows and support the necessary public/member states.

---

## 9. Events and Play requirements

Play is the activity/event product for organizing football activity.

Requirements:

- public discovery;
- event creation;
- event detail;
- location/Place support;
- date/time;
- capacity;
- RSVP;
- waitlist if capacity is reached;
- organizer authority;
- formation builder;
- check-in;
- temporary event chat;
- completion state;
- eventual Replay generation;
- no permanent generic chat history beyond the intended temporary/event rules.

Preferred-position data, when collected for balancing/formation logic, must actually affect the balancing algorithm rather than being accepted and ignored.

---

## 10. Watch requirements

Watch remains a dedicated primary product.

Requirements:

- `/watch` route;
- football-viewing event discovery;
- venue/Place association;
- Watch-specific event information;
- going/RSVP behavior where applicable;
- Watch venue business application;
- Platform Admin approval workflow;
- approved Watch capabilities tied to canonical Place;
- vintage collector-ticket presentation where used;
- business/application states must be real persisted states, not UI-only labels.

---

## 11. Canonical Places requirements

A `Place` represents one physical location.

It must not be duplicated because the same venue participates in different product contexts.

### 11.1 Place data

At minimum:

- name;
- address/location;
- city/Houma/geography fields as product requires;
- coordinates when available;
- media;
- opening/contact/business fields where applicable;
- moderation status;
- ownership records.

### 11.2 Place suggestion

Authenticated users may suggest a Place.

Suggestion does not automatically make the user an owner.

### 11.3 Ownership claims

Ownership claim is a separate workflow:

- submit claim/evidence;
- pending review;
- approve/reject;
- create verified ownership only after approval;
- audit all sensitive decisions.

### 11.4 Place capabilities

A canonical Place may have independent capability/profile records such as:

- Lounge/Cafe;
- Pitch;
- Watch venue;
- FanHub-relevant discovery characteristics.

A Place may support more than one capability without duplicating the physical location.

---

## 12. Pitch requirements

Pitch is a permanent standalone product and route.

Requirements:

- permanent `/pitch` route;
- permanent bottom-nav item;
- Pitch discovery/listing;
- canonical Place relationship;
- Pitch capability/profile;
- owner/business application;
- Platform Admin approval;
- approved/rejected/pending states;
- Places `PITCH` tab shows the same underlying approved Pitch data;
- no separate duplicate Pitch venue database.

---

## 13. FanHub requirements

FanHub is a discovery/context concept, not a user permission role.

Requirements:

- tied to canonical Place;
- surfaced from Places `FANHUB` tab and Watch where appropriate;
- must not create duplicate physical venue entities;
- no authorization logic should depend on “FanHub” as if it were a user role.

---

## 14. Platform Admin requirements

The creator/global administrator requires a separate App Admin dashboard.

Route:

```text
/admin
```

API:

```text
/api/v1/admin/*
```

### Admin responsibilities

At minimum:

- Place suggestion moderation;
- Place owner-claim review;
- Watch business/application review;
- Pitch business/application review;
- content/report moderation primitives;
- official football entity catalog management;
- Gamer game catalog management;
- relevant operational/audit visibility.

### Audit

Sensitive Admin writes must create durable AuditLog records containing at minimum:

- actor;
- action;
- target type/id;
- timestamp;
- relevant structured metadata without secrets or transient-message body content.

### Bootstrap

Platform Admin must be granted by an explicit operational bootstrap procedure, not a hardcoded production user ID in source.

---

## 15. ULTRAS requirements

ULTRAS is an independent supporter-community domain. It is not Team tables renamed and not a generic HOOMA community with a different label.

### 15.1 Official club association

Every ULTRAS group must be linked to an official football entity from a controlled catalog.

The catalog may represent clubs and other approved official football entities according to final product decisions.

Random fake/local hobby teams must not masquerade as official ULTRAS club identities.

### 15.2 Public ULTRAS experience

Public users may see privacy-safe information such as:

- group name;
- official team/club link;
- crest;
- motto;
- public banner/photo;
- country/city;
- public membership/join state where appropriate.

### 15.3 Private ULTRAS HQ

Current members get a private HQ.

Random public visitors must never see private member content.

### 15.4 Roles

```text
LEADER | MODERATOR | MEMBER
```

Leader/Moderator permissions govern management actions.

### 15.5 Membership lifecycle

Requirements:

- join request;
- approve/reject;
- membership status;
- remove/leave rules;
- invitations if implemented;
- private HQ authorization;
- GameDays;
- attendance;
- integration with shared Whistle, Ride, FundMe, Replay where relevant.

### 15.6 Private ULTRAS Whistle Board

Only current authorized members may access the private ULTRAS Whistle Board.

It uses the one shared Whistle domain and all Whistle retention/privacy rules.

---

## 16. Gamers requirements

Gamers is an independent domain, not football Teams reused for gaming.

Requirements:

- App Admin-controlled game catalog;
- gamer profile;
- per-game handle/account data where appropriate;
- gamer squads;
- squad membership;
- Squad Leader;
- join lifecycle;
- squad challenge lifecycle;
- results;
- disputes/moderation path;
- Gamer/squad identity visible in Profile;
- shared Whistle only through approved relationship/context authorization.

---

## 17. Requests requirements

Requests allow users to ask for help/resources/actions according to the final product UI.

Requirements:

- public/privacy-safe discovery where appropriate;
- create request;
- claim request;
- concurrency-safe claim operation so the same exclusive claim cannot be granted twice;
- claim/release/complete states as product requires;
- server-side authorization;
- clear owner/claimer identity boundaries.

---

## 18. Ride requirements

Ride supports community transport coordination.

Requirements:

- ride offer;
- ride request;
- matching;
- public privacy-safe projections;
- member/private detail;
- exact location protected from random public browsing;
- live tracking OFF by default;
- tracking, if enabled, is explicit and privacy-scoped;
- ratings/feedback only if implemented as a complete lifecycle;
- payment integration through shared payment domain where applicable;
- Whistle only through valid Ride relationship/context.

---

## 19. FundMe requirements

FundMe provides community fundraising.

Requirements:

- campaign creation;
- public campaign detail;
- contribution;
- Cash and/or Telegram Stars only according to supported context;
- correct accounting of paid contributions;
- no double-counting on confirmation;
- cancellation/completion rules;
- reconciliation/audit visibility where payments are involved.

---

## 20. Payment requirements

Initial supported payment methods:

```text
CASH
TELEGRAM_STARS
```

No credit-card payment rail is part of the initial requirement.

Optional future crypto/Flouci work is separate and must not be invented into the first implementation.

### 20.1 Cash

Requirements:

- payment intent/obligation representation;
- pending state;
- confirmation by authorized participant/manager according to context;
- void/cancel where valid;
- idempotent confirmation;
- audit/reconciliation evidence.

### 20.2 Telegram Stars

Requirements:

- product/amount policy;
- invoice creation;
- Telegram pre-checkout validation;
- successful-payment processing;
- provider payload validation;
- idempotency;
- payment lookup;
- entitlement/digital fulfillment where the product uses it;
- refund path where supported;
- durable payment state;
- webhook/update processing that safely handles retries.

### 20.3 Credentials

These values are environment-only and must remain replaceable:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_BOT_USERNAME
TELEGRAM_BOT_ID
MINI_APP_URL
```

Changing the Telegram bot later must not require source-code rewrites.

---

## 21. Whistle requirements

There is exactly **one shared Whistle engine**.

It is a transient short-message mechanic, not a permanent social feed or generic chat system.

### 21.1 Content limit

Maximum:

```text
33 grapheme clusters
```

Validation must use grapheme clusters rather than bytes or naive UTF-16 length.

### 21.2 Daily quota

Maximum:

```text
11 total Whistles per user per day
```

The quota is global across all Whistle contexts, not 11 per Team/ULTRAS/Event.

Quota enforcement must be concurrency-safe.

### 21.3 Storage invariant

Whistle body:

- Redis only;
- never stored in PostgreSQL;
- never stored in AuditLog;
- never stored in analytics payloads;
- never placed in URL/query strings;
- never copied into durable notification records;
- never copied into application logs.

PostgreSQL stores metadata only.

### 21.4 TTL

Unread body TTL:

```text
24 hours
```

After the first authorized reveal:

```text
60 seconds
```

The first-reveal transition must not repeatedly extend the body lifetime on subsequent reads.

### 21.5 Authorization

Whistle requires an approved relationship/context.

Supported contexts include, as implemented:

- Event;
- Team;
- Ride;
- HOOMA Community;
- ULTRAS;
- Gamer Squad;
- other explicitly approved domain relationships.

A random public profile visitor must not gain permission to Whistle merely because they can discover a user.

### 21.6 Notifications

A durable notification may say, for example:

```text
Youssef sent you a Whistle
```

It must never contain the Whistle body.

Worker must perform actual configured Telegram notification delivery when applicable, with retry/idempotency behavior. Merely setting `deliveredAt` without a delivery attempt is not sufficient.

### 21.7 Mandatory Whistle tests

Must include real Redis/PostgreSQL integration tests for:

- 11th allowed / 12th denied;
- concurrent quota attempts;
- 24-hour unread TTL;
- first reveal -> 60-second transition;
- no TTL re-extension;
- context authorization;
- ULTRAS private-board privacy;
- no body persisted to PostgreSQL;
- no body in durable notification/outbox payload;
- expiry behavior.

---

## 22. Media requirements

### 22.1 Storage model

- PostgreSQL stores metadata only;
- S3-compatible object storage stores bytes;
- Worker performs transforms;
- legacy external photo URL may exist only as a controlled transitional/fallback presentation field if explicitly needed.

### 22.2 Processing

Uploaded images must support:

- validation;
- auto orientation;
- EXIF/GPS stripping;
- thumbnail variant;
- card/display variant;
- master variant;
- failure status and retry path;
- ownership/authorization linkage.

If an external binary such as ImageMagick is used, deployment must explicitly provision it and CI/preflight must verify its availability.

---

## 23. Outbox and Worker requirements

Durable business write and async-event enqueue must commit atomically through a transactional outbox pattern where appropriate.

Worker requirements:

- safe concurrent claiming;
- retry with backoff;
- idempotent handlers;
- failure/dead-letter visibility;
- no duplicated business authorization policy;
- observability/logging without secrets or Whistle bodies;
- health/startup verification.

Worker use cases include:

- media processing;
- Telegram notification delivery;
- Replay generation;
- cleanup/expiry processing;
- other durable async tasks approved by architecture.

---

## 24. Replay requirements

Replay is post-activity memory/content generated from eligible completed events/activities.

Requirements:

- tied to canonical completed activity/event;
- generated only when eligibility rules are satisfied;
- media through shared Media domain;
- privacy derived from the originating context;
- no parallel permanent Whistle history;
- public/private presentation based on source context.

---

## 25. Discovery / HOOMA NOW requirements

Home/discovery may aggregate current useful activity across domains, but it must remain a read model/projection.

It must not become a second source of truth.

Requirements:

- deterministic inputs;
- privacy-safe projections;
- no hidden permanent social graph;
- no fake engagement counters;
- no duplicated Event/Team/Place records.

---

## 26. Preview Mode requirements

Command:

```text
npm run dev:preview
```

Preview Mode is frontend-only mock interception using MSW or equivalent.

Required personas:

- Guest/Spectator;
- Member;
- Player;
- Coach;
- Assistant;
- ULTRAS Leader;
- ULTRAS Moderator where useful;
- Gamer Squad Leader;
- Place Owner;
- Platform Admin.

Rules:

- no backend fake-auth bypass;
- no fake persistence in production API;
- production build must reject Preview Mode configuration;
- fixtures must use shared contracts/types.

---

## 27. Database requirements

### 27.1 Fresh target schema

HOOMA ULTIMATE must create a fresh target schema designed around these requirements.

It must not inherit either donor migration chain as the application history.

### 27.2 Initial migration

A real committed initial Prisma migration is required before database-dependent feature work is considered deployable.

No zero-migration release state is acceptable.

### 27.3 Future migration rules

After HOOMA ULTIMATE itself ships:

- migrations are forward-only;
- never edit/delete already-shipped migration SQL;
- never reset production data;
- use additive/change/backfill/remove-later patterns for destructive evolution;
- verify clean database migration in CI/release checks.

### 27.4 Historical donor data

If old HOOMA production data is imported in the future, that must use explicit import/ETL scripts and reconciliation reports. It must not redefine the target app as a migration of the old repository.

---

## 28. Security requirements

At minimum:

- Argon2id passwords;
- opaque hashed Web sessions;
- secure production cookies;
- CSRF/write-origin protection;
- Telegram initData validation;
- fail-closed invalid credentials;
- `AUTH_CONFLICT` handling;
- authorization on every sensitive server action;
- rate limiting/abuse control;
- environment-only secrets;
- no credential/body logging;
- safe upload validation;
- audit trail for App Admin decisions;
- object ownership checks;
- predictable error codes without secret/internal-data leakage;
- validated internal `returnTo` to prevent open redirects.

---

## 29. Testing requirements

Testing must be behavior-oriented, not file-count theater.

### Required test levels

#### Unit

For deterministic domain policies and validation.

#### Repository/integration

Use real disposable PostgreSQL for:

- transactions;
- unique constraints;
- concurrency-sensitive claims;
- role assignments;
- payment idempotency;
- outbox locking;
- schema/migrations.

Use real disposable Redis for:

- Whistle quotas;
- TTL semantics;
- concurrency;
- transient state.

#### HTTP/API

Test:

- public/member boundary;
- authentication;
- authorization;
- role/capability matrix;
- App Admin isolation;
- error contracts.

#### Frontend

Test critical route states and actions for Web and Telegram independently where platform behavior differs.

#### Worker

Test claiming, retries, idempotency, and actual handler side effects.

### Prohibited testing shortcuts

- random `test.ts` files created only to satisfy a check;
- tests that merely grep source strings and call that runtime verification;
- mocks used to claim PostgreSQL/Redis concurrency correctness;
- marking features DONE because TypeScript compiles.

---

## 30. CI and release requirements

CI order must be internally valid.

Expected final gates:

```text
npm ci
npm run db:generate
npm run db:validate
npm run architecture:check
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run deploy:preflight
```

A check must never reject normal artifacts created by an earlier required CI step, as the donor V3 architecture check did with `node_modules`.

Tests must not import absent `dist` outputs before those outputs are built.

### Release verification

Before production release:

- fresh DB migrates from zero;
- migration status is clean;
- API starts successfully;
- Web production build works;
- Telegram production build works;
- Worker starts successfully;
- Redis-dependent functionality is verified;
- object storage configuration is verified;
- Telegram config preflight is verified;
- Preview Mode is disabled/rejected;
- no prohibited secret files are present;
- no deployment success is claimed without command/runtime evidence.

---

## 31. Environment requirements

At minimum configuration should anticipate:

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

Exact names may be refined in `packages/config`, but credentials and deployment URLs must remain external to source.

---

## 32. Definition of Done

A feature may be marked `DONE` only when all applicable layers are complete and verified:

1. requirement is documented;
2. domain ownership is clear;
3. schema/migration exists if persistence changed;
4. contracts/validation exist;
5. authorization policy exists;
6. application service/use case exists;
7. infrastructure repository/integration exists;
8. HTTP/API route exists where needed;
9. frontend route/component is connected to the real API where needed;
10. loading/empty/error/success states are handled;
11. Worker/Redis/media side effects are complete where required;
12. automated tests prove critical behavior;
13. relevant build/type/lint/test gates pass;
14. runtime/deployment configuration is documented;
15. `docs/IMPLEMENTATION_STATUS.md` contains concrete evidence.

A feature is **not DONE** because:

- a Prisma model exists;
- a page exists;
- a button exists;
- an endpoint exists;
- donor code exists;
- mocks show the happy path;
- a plan says it is done.

---

## 33. Initial implementation order

The required dependency order is:

1. Greenfield monorepo/tooling/CI foundation.
2. Fresh schema + identity/authentication.
3. Platform Admin + scoped authorization + audit.
4. Profile + Home + HOOMA communities.
5. Teams.
6. Events / Play.
7. Places + Watch + Pitch.
8. Requests + Ride + FundMe + Payments.
9. ULTRAS.
10. Gamers.
11. Whistle.
12. Media + Worker + Replay + Discovery.
13. Preview Mode + final design/production verification.

This order is authoritative unless a later explicit product decision changes it.

---

## 34. Current starting point

At the time this requirements contract is created:

- HOOMA ULTIMATE is a new target repository;
- planning/reference documents exist;
- business application code is not yet considered implemented;
- Phase 0 is the next implementation phase;
- implementation must begin from a clean target workspace rather than by copying either donor repository wholesale.
