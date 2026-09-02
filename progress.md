# HOOMA — LIVING PROGRESS PLAN

Status: **ACTIVE — living execution and evidence ledger**
Product: **HOOMA**
Repository/workspace only: `funmarket/HoomaUltimate`
Active development branch: `phase-0-foundation`
Stable/release branch: `main`
Created: **2026-08-22**

---

# 0. WHY THIS FILE EXISTS

This file is the live control document for building HOOMA from the current state to a complete, clean, tested, running application.

It must be updated after **every meaningful fix, implementation, deployment change, schema change, feature change, UI change, test pass/failure, or architecture decision**.

It is not a static planning document. It is a continuously updated record of:

- what the current truth is;
- what changed;
- why it changed;
- which files changed;
- which commit contains the change;
- what was actually tested;
- what still failed or remains unverified;
- the current implementation score from 1 to 10;
- whether the item is truly `DONE`.

No future agent should have to guess what happened before.

---

# 1. DOCUMENT AUTHORITY AND ANTI-DRIFT RULE

Before every meaningful implementation step, read:

1. latest explicit product-owner instruction in the active conversation;
2. this `progress.md`;
3. root `structure.md`;
4. root `requirements.md`;
5. relevant current canonical/decision documents;
6. relevant current implementation source;
7. relevant runtime/database/deployment state.

`structure.md` and `requirements.md` were created during planning and remain important guides, but they are **not infallible**.

If either document conflicts with:

- a newer explicit product-owner decision;
- verified current source behavior;
- verified runtime/database behavior;
- a root architectural correction discovered during implementation;

then **do not silently force the implementation to obey stale text**.

Required process:

1. identify the conflict;
2. inspect the real source and related documents;
3. discuss the conflict with the product owner when the correct direction is not already explicit;
4. decide the correct canonical rule;
5. update the affected documents and source together;
6. record the decision and proof in this file.

No guessing. No hidden assumptions.

---

# 2. PRODUCT NAME — LOCKED

`HoomaUltimate` is only the **repository/folder/workspace name** used so the clean build is not confused with the original `funmarket/HOOMA` donor repository.

It is **not the application name**.

The application name is only:

```text
HOOMA
Hooma
hooma
```

according to normal grammatical/coding context.

Do not introduce `HOOMA ULTIMATE`, `HoomaUltimate`, or similar wording as user-facing product branding.

Before release, inspect and correct active product-facing naming in:

- UI titles;
- HTML/app metadata;
- Web app title;
- Telegram Mini App title/copy;
- Telegram bot presentation;
- runtime service names where users/operators see the product name;
- README/document headings;
- logs/health metadata where product identity is exposed;
- deployment/release naming.

Do **not** mass-replace technical workspace identifiers blindly. Trace imports/package/workspace names before changing technical identifiers.

---

# 3. ONE HOOMA APPLICATION — LOCKED ARCHITECTURE

HOOMA is **one application**.

It has:

- one canonical backend/API;
- one canonical PostgreSQL database;
- one canonical `User` model;
- one server-side authorization system;
- one durable source of truth per domain concept;
- Web and Telegram as two frontend/access surfaces into that same product;
- Redis/Valkey only for transient state where a feature requires it;
- worker/background execution only as an internal HOOMA process, never as a second business-policy owner.

Correct conceptual model:

```text
                         HOOMA
                           |
                   ONE SHARED API
                           |
                  ONE POSTGRES DATABASE
                           |
                   ONE CANONICAL USER
                     /            \
                    /              \
           WEB FRONTEND       TELEGRAM FRONTEND
```

Web and Telegram must never become separate products with separate Users or separate business data.

The same canonical HOOMA account must own the same:

- Profile;
- Teams;
- Community memberships;
- roles/permissions;
- Events;
- future ULTRAS memberships;
- future Gamer identity/squads;
- future Requests/Rides/FundMe activity;
- future Whistle quota/authorization context;
- future payment state.

---

# 4. AUTHENTICATION — LOCKED DIRECTION

HOOMA has two legitimate access paths into the same canonical User system.

## 4.1 Web/classic authentication

Registration/login direction:

- login username;
- password;
- display username;
- optional email;
- optional progressive profile fields;
- Argon2id password hashing;
- opaque server-side Web session;
- only session-token hash stored durably.

Login username and display username are distinct concepts.

## 4.2 Telegram authentication

Telegram Mini App authentication:

- receives Telegram `initData`;
- validates it cryptographically server-side;
- resolves `TelegramIdentity`;
- resolves the canonical HOOMA User;
- invalid supplied Telegram identity fails closed.

## 4.3 Identity safety

- no separate "Telegram User" domain;
- no separate "Web User" domain;
- no heuristic account merge;
- no silent choice if two valid identities point to different Users;
- retain `AUTH_CONFLICT` for conflicting simultaneous identities;
- future account linking must be explicit and authenticated.

The original HOOMA Admin/Profile/User/Login confusion is a known donor weakness. It must **not** be reintroduced.

---

# 5. AUTHORITY AND ROLE SEPARATION — LOCKED

The word **Admin** is reserved for global HOOMA application administration.

Global authority:

```text
PLATFORM_ADMIN
```

Scoped roles use their own product terminology.

Examples:

- HOOMA Community: Founder / Coach / Member
- Team: Coach / Assistant / Player
- ULTRAS: Leader / Moderator / Member
- Gamer Squad: Squad Leader / member roles as finally defined
- Place: verified Owner where applicable

A Team Coach uses the **Coach Control Room**, never an Admin Dashboard.

Future App Admin responsibilities include, as their domains are implemented:

- users/platform operations;
- audit visibility;
- Place suggestion moderation;
- Place ownership claims;
- Watch business/application approvals;
- Pitch business/application approvals;
- official football catalog;
- Gamer game catalog;
- moderation/reporting.

Authorization is always server-side. Hiding a button is not authorization.

---

# 6. ENGINEERING RULES — APPLY TO EVERY CHANGE

1. **No lies.** Never claim something is deployed, tested, fixed, working, migrated, or verified without evidence.
2. **No guessing.** Inspect documents, source, database model, API, frontend and runtime first.
3. **No hidden assumptions.** If the answer still cannot be established, ask the product owner.
4. **Trace before editing.** Follow UI -> state/query -> API client -> contract -> route/controller -> service -> authorization -> repository -> Prisma/schema -> PostgreSQL/Redis -> async effects -> tests -> deployment.
5. **Fix root causes.** No downstream camouflage for upstream defects.
6. **No patching.** No duplicate systems, shadow state, fake fallbacks, fake endpoints, fake success responses, duplicate tables, permanent temporary compatibility layers, arbitrary visual overrides, or second competing implementations.
7. **One owner per durable concept.**
8. **One vocabulary per concept.** Schema, migration, repository, service, contract, UI and tests must agree.
9. **No fake production data.**
10. **No real secrets in source/docs.**
11. **No destructive production shortcuts.**
12. **No frontend-only security.**
13. **A schema/table is not a completed feature.**
14. **A page with dead buttons is not a completed feature.**
15. **An endpoint without real authorization/persistence/tests/frontend use is not a completed feature.**
16. **Original HOOMA is a consultant/donor, not automatic truth.** Borrow proven behavior, layout, visuals, assets and mature flows; do not inherit known architectural mistakes blindly.
17. **V3 is a consultant/donor.** Borrow useful shell/feature-map/presentation work; do not let donor architecture replace the clean HOOMA model.
18. **CI verifies; CI never repairs and pushes source.**
19. **Do not suppress strict TypeScript/Prisma errors merely to deploy.**
20. **Do not rename schema fields just because the compiler suggests a similar name. Confirm the canonical model first.**
21. **Every status report distinguishes:** source exists / wired / builds / deployed / tested / verified working.
22. **Every meaningful change must be recorded in this file.**

---

# 7. MANDATORY EVIDENCE + SCORE RULE FOR EVERY FIX/UPDATE

Every fix or update must receive an entry under **Change Evidence Ledger** below.

Each entry must contain:

```text
Date/time:
Task:
Reason/root cause:
Authoritative docs/source inspected:
Files changed:
Commit(s):
Database/migration changes:
Tests/commands actually run:
Deployment/runtime proof:
Known failures/unverified areas:
Score: X/10
Status: IN_PROGRESS | BLOCKED | VERIFIED | DONE
Next action:
```

## 7.1 Scoring rubric

The score is evidence-based, not emotional.

```text
1/10  = idea only / problem identified
2/10  = behavior/design clarified, no implementation
3/10  = partial source implementation
4/10  = main source implemented but important layers missing
5/10  = source wired across main layers, build/test not proven
6/10  = relevant build/typecheck passes, broader tests missing
7/10  = focused tests pass, runtime/deployment not fully proven
8/10  = deployed or integration-tested on real infrastructure, remaining verification exists
9/10  = end-to-end flow works in intended frontend(s), only final regression/release checks remain
10/10 = all applicable source, schema, auth, tests, deployment and user-flow verification pass
```

## 7.2 `DONE` rule

An item may be marked **`DONE` only at 10/10** and only when **all applicable testing and runtime verification pass**.

A commit alone is never `DONE`.

A successful TypeScript build alone is never `DONE`.

A successful Railway deployment alone is never `DONE`.

A screenshot alone is never `DONE`.

If a later regression is discovered, change `DONE` back to the correct lower status and score.

---

# 8. LOCKED TOP-LEVEL NAVIGATION AND HOME

Permanent bottom navigation is exactly:

```text
Home | Play | Watch | HOOMA | Pitch
```

Main Home grid is exactly six containers in a clean 3 x 2 layout:

```text
HOOMA | Teams | Spots
Pitch | Ride  | Requests
```

Gamers remains a real independent product and route family, but it is not an active Home gateway or HOOMA create option. ULTRAS remains a future independent domain and appears only as an unavailable HOOMA create option. FundMe is grouped under Requests as `/requests/fundme`; `/fundme` redirects there as compatibility navigation only.

The approved attached original gateway artwork is authoritative. Do not regenerate or replace it without explicit instruction.

The original HOOMA bottom-navigation artwork/behavior is approved as a donor reference. It should be traced and adapted into the clean shared UI ownership model rather than blindly copied with old architecture.

---

# PART I — FIRST PRIORITY: GET HOOMA RUNNING

# 9. RUNTIME MISSION

Before expanding into major new product domains, HOOMA needs a real development/staging runtime so changes can be tested continuously.

Required outcome:

```text
HOOMA shared API        -> healthy public HTTPS endpoint
HOOMA Web frontend      -> valid public HTTPS Web App URL
HOOMA Telegram frontend -> valid public HTTPS Mini App URL
Telegram bot            -> valid bot link opening the HOOMA Mini App
PostgreSQL              -> same canonical database used by the shared API
```

Web and Telegram must both use the **same backend and same database**.

Current target working branch:

```text
phase-0-foundation
```

`main` remains the stable/release branch until the running branch passes the required gates.

---

# 10. RUNTIME GATE A — RECONCILE ACTIVE DOCUMENTS WITH CURRENT PRODUCT DECISIONS

Current planning-era conflicts already known:

- documents still use `HOOMA ULTIMATE` branding even though the product is HOOMA;
- some language may make technical processes sound like separate applications rather than one HOOMA app with two frontends;
- existing Whistle requirements contain an older reveal/TTL lifecycle that is superseded by the current product-owner rule below;
- planning-stage assumptions may need correction as the real running implementation exposes contradictions.

Required document reconciliation where relevant:

- `structure.md`
- `requirements.md`
- `docs/CANONICAL_MODEL.md`
- `docs/DECISIONS.md`
- `docs/NORMALIZATION_PLAN.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/AUTH.md`
- `docs/AUTHORIZATION.md`
- `docs/DATABASE.md`

Do not pause all engineering just to perform cosmetic wording changes. Correct architecture-affecting contradictions before implementing the related area, then continue updating naming systematically.

Gate passes when active implementation instructions no longer conflict on the slice being executed.

---

# 11. RUNTIME GATE B — MAKE THE SHARED API COMPILE CLEANLY

Do not disable strict TypeScript and do not bypass Prisma type errors.

Current Railway builds have already exposed real source inconsistencies.

Known error categories include:

- exact optional property handling at API/repository boundaries;
- explicitly passing `undefined` into Prisma inputs instead of omitting absent fields;
- Team repository fields/compound keys that disagree with `schema.prisma`;
- Team lineup vocabulary mismatch including `formation` vs current `format` representation;
- Team responsibility assignment field/timestamp mismatch;
- Assistant capability-grant field/timestamp mismatch;
- Community/Event/Team request DTO construction inconsistencies;
- Event update Prisma input inconsistency.

Already corrected during Railway connection work:

- invalid Argon2 verification options;
- overly narrow async Express wrapper typing;
- Audit metadata explicitly passing `undefined` to Prisma.

Repair workflow for each remaining error:

1. read current canonical model;
2. inspect schema;
3. inspect migrations;
4. inspect repository interface;
5. inspect Prisma repository;
6. inspect service/domain policy;
7. inspect contracts/routes;
8. inspect frontend consumers;
9. consult original HOOMA only for useful behavior/history;
10. decide canonical truth;
11. fix all affected layers together;
12. generate Prisma client;
13. typecheck/build;
14. run focused tests;
15. record proof here.

Gate passes only when relevant packages and the shared API build cleanly without suppression/compatibility hacks.

---

# 12. RUNTIME GATE C — CLEAN PRE-RELEASE DATABASE BASELINE

Because this clean HOOMA application has not yet shipped, experimental pre-release migrations may be replaced only after the current canonical schema is reconciled.

Required:

- one canonical fresh Prisma schema for currently implemented foundation domains;
- one reviewed initial migration;
- no speculative future-domain tables;
- `prisma validate` passes;
- `prisma migrate deploy` succeeds against an empty disposable PostgreSQL database;
- repository integration tests pass against generated Prisma types;
- PostgreSQL constraints/indexes are manually reviewed;
- no `prisma db push` as the release path.

Only after the exact migration is proven on disposable PostgreSQL should it be applied to the fresh Railway development/staging database.

Never modify Railway DB structure merely to make deployment appear green.

---

# 13. RUNTIME GATE D — DETERMINISTIC DEPENDENCIES AND CI

Required:

- real committed `package-lock.json` from the actual workspace manifests;
- clean `npm ci` from untouched checkout;
- Prisma generation deterministic;
- CI read-only;
- no CI lockfile generation/commit/push;
- explicit process build/start commands;
- no uncontrolled `latest` dependency drift.

Gate passes only when clean installation/build does not modify repository source.

---

# 14. RUNTIME GATE E — DEPLOY AND VERIFY THE SHARED HOOMA API

Railway shared backend must:

- deploy current `phase-0-foundation` during development;
- use the existing shared PostgreSQL database;
- use environment-only secrets;
- use explicit build/start commands;
- expose a real health endpoint;
- remain one business backend/source of truth.

Verification requires:

- Railway deployment `SUCCESS`;
- process remains running;
- `/health` returns healthy response;
- database connection works;
- auth configuration loads correctly;
- required production Telegram config fails clearly when absent;
- no secret leakage in logs.

After verification record:

```text
API_URL=<verified URL>
```

Do not record a URL before it is confirmed working.

---

# 15. RUNTIME GATE F — DEPLOY AND VERIFY HOOMA WEB

Required:

- public HTTPS Web App domain;
- Web frontend points to the same shared HOOMA API;
- browser routing/reload works;
- production cookie/origin behavior works against real domain;
- current implemented routes load without production-only failures;
- frozen/unimplemented routes are truthful, never fake-complete.

Initial running-route smoke set:

- `/`
- `/login`
- `/register`
- `/profile`
- `/admin`
- `/teams`
- `/teams/:teamId`
- `/teams/control`
- `/play`
- current Event routes.

After verification record:

```text
WEB_APP_URL=<verified URL>
```

---

# 16. RUNTIME GATE G — DEPLOY AND VERIFY HOOMA TELEGRAM MINI APP

Required:

- public HTTPS Telegram Mini App domain;
- Telegram frontend uses the same HOOMA API/database;
- initData resolves through the canonical User system;
- Mini App lifecycle works;
- safe-area/viewport/navigation behavior works;
- currently implemented product routes are usable instead of Home cards leading blindly to unsupported destinations;
- no duplicate Telegram persistence.

After verification record:

```text
MINI_APP_URL=<verified URL>
```

---

# 17. RUNTIME GATE H — CONNECT AND VERIFY THE TELEGRAM BOT

Bot configuration stays environment-only:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_BOT_USERNAME
TELEGRAM_BOT_ID
MINI_APP_URL
```

Required:

- configured bot opens deployed HOOMA Mini App;
- bot/mini-app auth reaches the canonical User model;
- changing bot credentials later requires environment changes, not source rewrites;
- invalid initData fails closed.

After verification record:

```text
TELEGRAM_BOT_LINK=https://t.me/<verified_bot_username>
```

Never write the bot token into this file.

---

# 18. RUNTIME GATE I — FIRST REAL SMOKE TEST

## Web

Verify:

- guest Home;
- register;
- login;
- logout;
- session navigation;
- Profile;
- normal user denied Platform Admin;
- real Platform Admin allowed;
- Teams discovery;
- Team detail;
- Coach Control Room authorization;
- Play discovery;
- create PLAY Event;
- Event detail;
- RSVP/waitlist where test data permits;
- formation;
- check-in;
- temporary chat.

## Telegram

Verify:

- bot opens Mini App;
- initData validation;
- same canonical account/data model;
- Home;
- Profile;
- implemented product routes;
- Telegram BackButton/navigation behavior;
- safe-area/viewport behavior.

This gate is what changes the application from "source exists" to "we can actually develop and test it properly."

---

# PART II — COMPLETE THE CURRENT FOUNDATION

# 19. PHASE 1 — IDENTITY, PROFILE, LOGIN AND PLATFORM ADMIN

This phase directly addresses the area that made original HOOMA difficult to extend.

## Identity/Auth completion

- one canonical User;
- complete Web register/login/logout;
- Telegram identity resolution;
- explicit future account-linking if needed;
- session security;
- rate limiting/lockout;
- write-origin/CSRF protections;
- clear user-facing error states;
- no duplicate frontend auth state.

## Profile completion

Profile becomes the user's identity and responsibility hub.

Required:

- clear Edit Profile action;
- persisted edit flow;
- photo;
- display name;
- display username;
- bio;
- Houma/location where applicable;
- favorite club;
- Player/Fan/Gamer presentation;
- My Teams + role;
- My HOOMA communities + role;
- later My ULTRAS groups + role;
- later My Gamer Squads + role;
- managed/owned Places where applicable;
- Platform Admin entry only for real Platform Admin.

Original HOOMA's richer profile presentation may be consulted, but the clean canonical identity model owns the implementation.

## Platform Admin completion

Foundation:

- user overview;
- explicit Platform Admin bootstrap/assignment;
- audit visibility.

Domain-specific moderation queues are added only when those domains become real.

---

# 20. PHASE 2 — HOOMA COMMUNITIES, TEAMS, PLAY/EVENTS

## HOOMA Communities

Complete canonical Founder/Coach/Member behavior without scoped Admin naming.

## Teams

Finish the mature Team experience already started; do not restart it from scratch.

Required:

- public discovery/profile;
- canonical TeamPlayer model;
- Coach/Assistant responsibility model;
- explicit Assistant capabilities;
- player/member selection instead of exposing raw DB IDs;
- final Coach Control Room UX;
- real lineup editor using TeamPlayer;
- proper tactical pitch/positions;
- challenge creation;
- no self-challenge;
- incoming/outgoing lifecycle;
- dedicated challenge detail;
- accepted challenge coordination authorization;
- TeamGame detail;
- published/private lineup boundaries;
- player profile navigation.

Use recovered V3 Team presentation and mature original HOOMA behavior as donor evidence, but keep the clean HOOMA architecture.

## Play / Events

Complete:

- PLAY-only creation until Watch is implemented;
- public discovery;
- create/detail;
- RSVP;
- concurrency-safe capacity;
- waitlist/promotion;
- organizer controls;
- formation;
- preferred-position data actually affects balancing when collected;
- check-in;
- temporary Event chat;
- cancellation/completion;
- cleanup ownership;
- later Replay integration.

---

# PART III — PRODUCT SHELL AND VISUAL COHERENCE

# 21. PHASE 3 — HOOMA BRAND, HOME AND NAVIGATION

Goal: make the live application visually coherent before major new-domain expansion.

Required:

- HOOMA logo/wordmark consistently used;
- approved original HOOMA bottom-nav artwork/interaction traced and adapted;
- bottom nav stays exactly Home | Play | Watch | HOOMA | Pitch;
- Home remains exactly 8 cards / 4 x 2;
- approved attached Home gateway artwork used directly;
- approved Match Day banner wired;
- classy vintage-football language;
- almost-black background;
- warm cream typography;
- muted aged-gold details;
- lime action emphasis;
- photography where appropriate;
- modern mobile usability;
- Web shell mobile-first;
- Telegram shell truly Telegram-aware;
- safe areas and keyboard-safe flows;
- no generic dashboard/SaaS regression;
- shared design primitives owned cleanly.

---

# PART IV — RESTORE AND IMPROVE MATURE ORIGINAL-HOOMA PRODUCT DOMAINS

# 22. PHASE 4 — CANONICAL PLACES + WATCH

Build Places and Watch coherently because Watch depends on real venues.

## Canonical Place

One physical venue record, reusable across product contexts.

Support as finalized:

- name;
- media;
- address;
- City;
- Houma;
- coordinates;
- phone/email/website;
- About;
- menu;
- moderation state;
- ownership claims;
- upcoming related Events;
- no duplicate Place because it is also a Pitch/Watch/FanHub context.

## Places directory

Tabs remain exactly:

```text
LOUNGES/CAFES | PITCH | FANHUB
```

## Watch

Borrow the strongest original HOOMA ideas:

- Watch discovery;
- football-match/Event information;
- canonical Place association;
- going/RSVP;
- official/suggested venue state;
- empty collector-ticket master;
- dynamic data placed into defined ticket zones;
- expanded Watch Event page;
- Place contact/menu/about/upcoming Events;
- Requests/Ride/FundMe entry points once those domains exist.

The collector ticket is presentation infrastructure, never business state.

## Watch business approval

- real persisted application;
- pending state;
- Platform Admin review;
- approve/reject;
- capability activated on canonical Place;
- AuditLog entry.

---

# 23. PHASE 5 — PITCH + PLATFORM ADMIN APPROVAL

Use original HOOMA's useful Pitch lifecycle as a behavioral reference, but do not copy its unfinished localStorage-only frontend approach.

Target lifecycle:

```text
DRAFT
  -> PENDING_REVIEW
  -> PUBLISHED
  -> INACTIVE when valid

or

PENDING_REVIEW
  -> REJECTED
  -> edited/resubmitted
  -> PENDING_REVIEW
```

Required:

- canonical Place relationship;
- persisted owner/business draft;
- edit;
- submit for review;
- Platform Admin approve/reject;
- public discovery/detail;
- Places PITCH tab shows the same approved canonical data;
- no duplicate Pitch venue database.

---

# 24. PHASE 6 — REQUESTS

Required vertical slice:

- create;
- privacy-safe discovery;
- detail;
- claim;
- concurrency-safe exclusive claiming;
- release/cancel/complete where designed;
- server authorization;
- owner/claimer boundaries;
- Profile/context integration;
- Whistle only through a valid Request relationship after Whistle exists.

---

# 25. PHASE 7 — RIDE

Required:

- ride offer;
- ride request;
- matching;
- privacy-safe public projection;
- protected exact location;
- live tracking OFF by default;
- tracking only if explicitly designed and privacy-scoped;
- payments only through shared Payments;
- Whistle only through valid Ride relationship.

---

# 26. PHASE 8 — FUNDME + PAYMENT FOUNDATIONS

## FundMe

- create campaign;
- public detail;
- contribution;
- accurate paid totals;
- no double counting;
- cancel/complete lifecycle;
- reconciliation/audit where money is involved.

## Initial supported payment rails

Only:

```text
CASH
TELEGRAM_STARS
```

No credit-card rail in initial scope.

Crypto/Flouci remain separate future decisions and must not be invented into this phase.

Telegram Stars must include real invoice/pre-checkout/success/idempotency/retry/refund handling where supported.

---

# PART V — NEW/EXPANDED DOMAINS THAT REQUIRE EXTRA PRODUCT WORK

# 27. PHASE 9 — WHISTLE CORE — UPDATED RULES

There is exactly **one shared Whistle engine** across authorized HOOMA contexts.

Whistle is transient communication. It is **not** a permanent social feed and is **not** a permanent generic chat history.

The rules in this section supersede the older `requirements.md` reveal/TTL rules until `requirements.md` is reconciled.

## 27.1 Content limit

Current planned limit remains:

```text
33 grapheme clusters
```

This limit remains active unless the product owner explicitly changes it later.

Validation must count grapheme clusters, not bytes or naive UTF-16 code units.

## 27.2 Global daily quota

Each User may send at most:

```text
11 total Whistles per UTC calendar day
```

The limit is global across all Whistle contexts.

It is **not**:

- 11 per Team;
- 11 per ULTRAS group;
- 11 per Event;
- 11 per recipient;
- a rolling 24-hour window.

Quota window:

```text
00:00:00 UTC -> next 00:00:00 UTC
```

At UTC midnight the User's quota resets back to 11 available Whistles for the new UTC day.

Quota enforcement must be concurrency-safe so simultaneous sends cannot exceed 11.

## 27.3 Message visibility — UPDATED

Whistle messages must **not be covered, blurred, hidden behind a reveal action, or treated as one-time reveal content**.

An authorized recipient/context viewer sees the Whistle message normally while it is active.

The previous planning rule:

```text
first authorized reveal -> 60 second expiry
```

is **retired/superseded**.

Reading a Whistle does not shorten or extend its lifetime.

## 27.4 Message lifetime — UPDATED

A Whistle belongs to the sender's current UTC quota day.

At the sender's next UTC-midnight quota reset:

- the sender's daily usage counter resets;
- all active Whistles sent by that User during the previous UTC day expire/delete;
- those Whistles must disappear from every context where they were visible;
- no permanent Whistle message history remains.

Therefore a Whistle sent shortly after 00:00 UTC may live close to 24 hours, while one sent shortly before the next 00:00 UTC may live only a short period. This is intentional because lifetime is tied to the UTC-day reset, not a rolling 24-hour TTL from send time.

Implementation should calculate expiry at the **next UTC midnight**.

## 27.5 Storage/garbage rule

Whistle is designed specifically to avoid building permanent message trash.

Hard requirements:

- message body is transient;
- message body must not be stored permanently in PostgreSQL;
- message body must never be written to AuditLog;
- message body must never be written to analytics payloads;
- message body must never be written to application logs;
- message body must never appear in URL/query strings;
- durable notification records must not contain the message body;
- there must be no permanent Whistle history page.

Preferred transient body storage remains Redis/Valkey or equivalent disposable state with expiry aligned to the next UTC midnight.

Before implementation, inspect whether any PostgreSQL Whistle metadata is actually required for authorization/delivery/idempotency. If metadata is required, store only the minimum operational metadata and define cleanup/retention deliberately. Do **not** create permanent message-history metadata merely because the older plan did.

## 27.6 Authorization

Whistle requires a real approved relationship/context.

Potential contexts as implemented include:

- Event;
- Team;
- HOOMA Community;
- Ride;
- Request where explicitly approved;
- ULTRAS;
- Gamer Squad;
- other future explicitly approved relationships.

A random public profile visitor does not gain Whistle permission merely because a User is discoverable.

## 27.7 Notifications

A durable notification may say only something like:

```text
Youssef sent you a Whistle
```

It must never copy the Whistle body.

Telegram notification delivery, where enabled, must be real and idempotent with retry behavior.

## 27.8 Mandatory Whistle tests

At minimum:

- 11th Whistle allowed;
- 12th Whistle denied;
- concurrent sends cannot exceed 11;
- quota resets exactly at UTC midnight;
- Whistles expire/delete at the sender's UTC-midnight reset;
- reading does not alter expiry;
- message visible directly to authorized viewer;
- no reveal/60-second behavior remains;
- context authorization enforced;
- ULTRAS private-board privacy;
- no body in PostgreSQL;
- no body in AuditLog;
- no body in durable notification/outbox payload;
- no body in logs;
- no permanent Whistle history;
- restart/retry behavior does not resurrect expired Whistles.

Whistle cannot be `DONE` until these pass against real Redis/PostgreSQL infrastructure where applicable and Web/Telegram UI behavior is verified.

---

# Athletes Whistle PR 3 implementation map

Foundation: `812515554adb8a712a8d39cea751880880a124b2` (`phase-0-foundation` after PR #215 merge plus non-overlapping Ride styling commits). Open PRs at latest recheck: none. Branch was safely rebased from `b9d214745cb7e85121502e423fb36286b42dfa86`; incoming files were `packages/frontend/src/index.ts` and `packages/frontend/src/rides/ride-hero-actions-google.css`, with no overlap against Athletes Whistle functional files.

Source trace:

- Canonical Whistle context type is `WhistleContextType` in `apps/api/src/modules/whistle/application/whistle.repository.ts` and the matching PostgreSQL enum in `packages/database/prisma/schema.prisma`.
- Whistle HTTP API is `apps/api/src/modules/whistle/http/whistle.routes.ts` at `/api/v1/whistles/contexts/:contextType/:contextId`; it currently allows only public context enum values, while direct user/gamer contexts use adapter routes.
- Whistle service owner is `apps/api/src/modules/whistle/application/whistle.service.ts`; it owns `DAILY_LIMIT = 11`, `Intl.Segmenter` grapheme counting, UTC-day keying, next-UTC-midnight expiry, and context authorization dispatch.
- Transient body storage is `apps/api/src/modules/whistle/infrastructure/redis-whistle-store.ts` using `whistle:body:<id>` Redis keys with PX expiry.
- Durable metadata persistence is `apps/api/src/modules/whistle/infrastructure/prisma-whistle.repository.ts` in `WhistleMetadata` only: `id`, `authorUserId`, `contextType`, `contextId`, `createdAt`, `expiresAt`; no body column.
- Quota counting is global per user/day in `PrismaWhistleRepository.createWithDailyQuota` and `quotaUsed`, backed by `WhistleMetadata` count plus PostgreSQL advisory transaction lock.
- Existing context authorization dispatches to `CommunityService.requireMember` and `EventService.requireMemberContent`; direct Gamer/User contexts resolve through dedicated service adapters and never use the raw context route.
- Athletes membership authority is `AthletesService` backed by `AthletesRepository.activeRole` / `managerRole`, which require `AthletesMembership.leftAt = null` and active `AthletesCommunity.status`.

Implementation plan:

1. Add `ATHLETES` to the canonical Whistle context type and PostgreSQL enum, with a forward migration only for the enum value.
2. Add an Athletes service authorization method that requires an active member of the exact Athletes community and exposes no role-specific extra privilege.
3. Inject `AthletesService` into `WhistleService`; route `ATHLETES` context authorization through the Athletes membership authority.
4. Extend the existing Whistle context route schema to accept `ATHLETES`; keep body validation, quota, expiry, transient body storage, and metadata persistence unchanged.
5. Add frontend API helpers and reuse `WhistleBoard` for `ATHLETES`; render it only when `detail.viewerRole` proves active membership on the Athletes detail/member view.
6. Add focused tests for Athletes member/non-member/left/wrong-community/founder/moderator/unauthenticated access, shared 11/day quota, 33-grapheme behavior, Redis-only body storage, metadata body exclusion, expiry cleanup, and existing Whistle context regressions.

Styling scope: none. Any frontend class additions must be functional wiring only.

Current implementation status after foundation update `dfda56bc80009059680cd77237478cc8c197951b`:

- Preserved the uncommitted Athletes Whistle work with a stash/reapply workflow and rebased `feat/athletes-whistle` onto current `origin/phase-0-foundation` at `dfda56bc80009059680cd77237478cc8c197951b` (Ride presentation-only foundation commit).
- Open PR list at rebase time remained empty; incoming foundation file was `packages/frontend/src/rides/RideGatewayPage.tsx`, with no overlap against Athletes Whistle files.
- Added `ATHLETES` to canonical `WhistleContextType` and kept the migration minimal: `ALTER TYPE "WhistleContextType" ADD VALUE IF NOT EXISTS 'ATHLETES';`.
- No CSS/styling files are changed by Athletes Whistle.
- Rebase validation passed: `npm run db:generate`, `npm run db:validate`, `npm run architecture:check`, `npm run typecheck`, `npm run build:packages`, focused Whistle/Athletes unit tests, changed-file Prettier, changed-source ESLint, `git diff --check`, `npm run build`, `npm run deploy:preflight`, and `npm run security:check`.
- `npm test` now fails only on two Ride mobile hub visual assertions introduced by the unrelated Ride foundation commit; the same focused Ride visual test fails on a detached clean current foundation worktree at `dfda56bc80009059680cd77237478cc8c197951b`, so it is recorded as a separate foundation issue and not an Athletes Whistle blocker.
- Repository-wide `npm run format:check` and `npm run lint` currently report unrelated foundation files outside this diff; changed-file formatting and changed-source lint are clean.
- Local PostgreSQL-backed `tests/athletes-whistle.integration.test.ts`, `npm run test:integration`, and `npm run db:migrate:status` remain locally blocked because no PostgreSQL server is reachable at `localhost:5432`; Redis is reachable at `127.0.0.1:6379`. Exact-head CI must provide PostgreSQL integration/migration proof.

---

# 28. PHASE 10 — ULTRAS

ULTRAS is a first-class supporter-community domain, not Team tables renamed.

It requires deliberate product and UX design rather than copying a donor page.

Direction:

- controlled official football entity catalog;
- each ULTRAS group linked to an approved official club/entity;
- public supporter-community page;
- crest/banner/motto/country/city;
- join/request/invite lifecycle as finalized;
- roles:
  - Leader
  - Moderator
  - Member
- private member HQ;
- private ULTRAS Whistle Board using the shared Whistle engine;
- GameDays/attendance where designed;
- Ride/FundMe/Replay integration where useful;
- strict public/private content separation;
- strong mobile supporter experience rather than a generic forum.

Before implementation, finalize domain model + main user journeys + permission matrix + visual acceptance references.

---

# 29. PHASE 11 — GAMERS

Gamers is independent from football Teams.

It requires dedicated UX/domain design.

Direction:

- Platform Admin-controlled game catalog;
- Gamer profile;
- per-game handle/account data where appropriate;
- Gamer Squads;
- Squad Leader;
- membership lifecycle;
- squad challenges;
- results;
- disputes/moderation;
- Gamer/Squad identity visible in Profile;
- Whistle only through authorized Gamer relationships;
- interaction patterns designed for gaming rather than blindly reusing Team UI.

Before implementation, finalize game catalog ownership, Gamer Profile UX, Squad lifecycle, challenge/result/dispute flows and permission matrix.

---

# PART VI — SHARED MEDIA, ASYNC AND MEMORY FEATURES

# 30. PHASE 12 — MEDIA

Final managed media direction:

- PostgreSQL stores metadata;
- object storage stores bytes;
- image validation;
- auto orientation;
- EXIF/GPS stripping;
- thumbnail/card/master variants;
- ownership/auth linkage;
- retries/failure state;
- no scattered unmanaged upload implementations.

External image URLs may remain only as an explicitly controlled transitional/fallback path where required.

---

# 31. PHASE 13 — WORKER / OUTBOX HARDENING

Worker is an internal HOOMA execution process, not another application/source of truth.

Use cases may include:

- media processing;
- Telegram notification delivery;
- Replay generation;
- temporary Event-chat cleanup;
- Whistle cleanup only if Redis TTL alone is insufficient for required metadata cleanup;
- other approved durable async jobs.

Requirements:

- transactional outbox where appropriate;
- safe concurrent claiming;
- retry/backoff;
- idempotency;
- dead-letter/failure visibility;
- no duplicated domain authorization policy;
- safe logs with no secrets/Whistle bodies.

---

# 32. PHASE 14 — REPLAY

Replay is post-activity memory/content tied to eligible completed activity.

Requirements:

- tied to canonical completed Event/activity;
- generated only when eligibility rules pass;
- Media through the shared Media domain;
- privacy inherited from source context;
- no permanent Whistle history hidden inside Replay;
- public/private presentation based on source activity.

---

# 33. PHASE 15 — HOOMA NOW / DISCOVERY

HOOMA NOW may aggregate useful current activity across domains as a read model.

It must never become a second source of truth.

Requirements:

- deterministic inputs;
- privacy-safe projections;
- no fake engagement numbers;
- no duplicate Team/Event/Place records;
- no permanent follower/social graph invented accidentally.

---

# PART VII — FINAL RELEASE HARDENING

# 34. PHASE 16 — FULL SECURITY, ACCESSIBILITY, PERFORMANCE AND RELEASE GATE

Before merging the development branch to `main` for release:

- clean install;
- Prisma generate/validate;
- migration deploy from empty DB;
- architecture check;
- format/lint;
- TypeScript;
- unit tests;
- real PostgreSQL integration tests;
- real Redis integration tests where required;
- API build;
- Web build;
- Telegram build;
- Worker build where applicable;
- security checks;
- auth abuse/rate-limit checks;
- permission matrix tests;
- Web mobile viewport testing;
- Telegram Mini App testing;
- keyboard/safe-area checks;
- accessibility basics;
- performance sanity;
- public/private data leakage checks;
- production environment validation;
- Railway deployment verification;
- public Web link verification;
- Telegram Mini App link verification;
- Telegram bot link verification;
- backup/rollback/recovery plan documented;
- no real secrets committed;
- current progress ledger reconciled.

Only then promote milestone work into stable `main`.

---

# 35. DONOR USAGE RULE

## Original `funmarket/HOOMA`

Use it to learn from:

- mature page ideas;
- original bottom navigation;
- Watch presentation;
- collector-ticket concept;
- Places directory/detail behavior;
- useful Pitch backend lifecycle ideas;
- mature Team/challenge/game ideas;
- Matchday interaction patterns;
- visual language;
- proven assets.

Do not automatically copy:

- old schema;
- old migrations;
- old auth coupling;
- Community Admin vs Team Coach confusion;
- profile/user duplication;
- unfinished localStorage-only flows;
- stale technical debt.

## V3

Use it to learn from:

- feature map;
- clean shell ideas;
- 8-card Home gateway;
- improved login/profile/Admin planning;
- approved presentation/assets;
- recovered Teams presentation.

Do not treat V3 as proof that a backend feature exists or is complete.

---

# 36. CURRENT VERIFIED LINKS

Fill only after actual verification.

```text
API_URL=NOT_VERIFIED_YET
WEB_APP_URL=NOT_VERIFIED_YET
MINI_APP_URL=NOT_VERIFIED_YET
TELEGRAM_BOT_LINK=NOT_VERIFIED_YET
```

---

# 37. CURRENT HIGH-LEVEL STATUS

```text
Repository branch connected to Railway: VERIFIED
Shared API successfully running: NOT YET
Shared PostgreSQL reachable from final running API: NOT YET VERIFIED
Web public development URL: NOT YET
Telegram Mini App development URL: NOT YET
Telegram bot opens new Mini App: NOT YET
Foundation schema normalized: NOT YET
Current implemented routes fully smoke-tested live: NOT YET
New future domains: NOT STARTED in this clean app unless explicitly recorded otherwise
```

---

# 38. CHANGE EVIDENCE LEDGER

This section grows continuously. Never delete failed attempts merely to make progress look cleaner; supersede them with a later verified entry.

## 2026-08-29 — Home/create-flow IA simplification source-verified

**Task**
Implement the `fixhome.md` Home/create-flow IA simplification on branch `product/home-ia-simplify`.

**Reason/root cause**
Home and create-flow contracts drifted across requirements, structure, brand/asset docs, tests and source. The new product-owner direction reduces Home discovery to six gateways, removes Gamers/ULTRAS/FundMe from Home, moves FundMe under Requests as presentation/navigation only, adds honest Requests/Ride shells, and keeps durable domain ownership unchanged.

**Authoritative docs/source inspected**

- `AGENTS.md`
- `docs/LIVING_BUILD_PLAN.md`
- `requirements.md`
- `structure.md`
- `docs/DECISIONS.md`
- `docs/CANONICAL_MODEL.md`
- `docs/HOME_BRAND_SPEC.md`
- `docs/ASSET_MANIFEST.md`
- `progress.md`
- `packages/ui/src/home/home-gateways.ts`
- `packages/frontend/src/communities/HoomaPage.tsx`
- `apps/web/src/app/router/HoomaRouter.tsx`
- focused navigation/Home/router tests

**Files changed**

- `apps/web/src/app/router/HoomaRouter.tsx`
- `docs/ASSET_MANIFEST.md`
- `docs/DECISIONS.md`
- `docs/HOME_BRAND_SPEC.md`
- `docs/adr/ADR-048-home-create-flow-ia.md`
- `packages/frontend/src/communities/HoomaPage.tsx`
- `packages/frontend/src/index.ts`
- `packages/frontend/src/requests/RequestsPage.tsx`
- `packages/frontend/src/requests/requests.css`
- `packages/frontend/src/rides/RidesPage.tsx`
- `packages/frontend/src/rides/rides.css`
- `packages/ui/src/home/home-gateways.ts`
- `progress.md`
- `requirements.md`
- `structure.md`
- `tests/frontend-router.test.mjs`
- `tests/home-gateway-image-loading.test.mjs`
- `tests/hooma-create-chooser.test.mjs`
- `tests/navigation-contract.test.mjs`
- `tests/requests-rides-shell.test.mjs`

**Commit(s)**

- not committed yet.

**Database/migration changes**

- none; `git diff --name-only -- packages/database packages/contracts apps/api/src/modules` returned no changed files.
- `npm run db:generate` generated the local Prisma client only after approved network access to download the Prisma engine; no schema, migration, contract or backend source was changed.

**Tests/commands actually run**

- `git fetch origin phase-0-foundation`
- `gh pr list --repo funmarket/HoomaUltimate --state open --json number,title,headRefName,baseRefName,headRefOid,url`
- `gh pr view 159 --repo funmarket/HoomaUltimate --json number,title,state,baseRefName,headRefName,headRefOid,files,url`
- `rg -n "FundMe|Gamers|nine-card|nine card|3 × 3|3x3|HOME_GATEWAYS|ULTRAS|eight product containers|Home gateway" requirements.md structure.md docs progress.md tests packages apps`
- `node --test tests/navigation-contract.test.mjs tests/home-gateway-image-loading.test.mjs tests/frontend-router.test.mjs tests/hooma-create-chooser.test.mjs tests/requests-rides-shell.test.mjs` — passed 11/11.
- `npx prettier --write` on the touched source/docs/tests — passed.
- `git diff --check` — passed with line-ending warnings only.
- `npm run format:check` — failed on 370 pre-existing formatted files outside this slice; not mass-formatted.
- `npm exec -- prettier --check` on the exact touched file list — passed.
- `npm exec -- eslint --max-warnings=0` on the exact touched TS/TSX file list — passed.
- `npm run architecture:check` — passed.
- `npm run db:generate` — first failed due restricted network; approved retry passed.
- `DATABASE_URL=postgresql://user:pass@localhost:5432/hooma_validation npm run db:validate` — passed.
- `npm run typecheck` — first failed before Prisma client generation; retry after `db:generate` passed.
- `npm test` — failed before test execution with Windows `spawn EINVAL` in `scripts/run-tests.mjs`.
- chunked equivalent unit run using `npx tsx --test` over the unit test file set — passed 160/160.
- `npm run build` — passed with the existing Vite large-chunk warning.
- `npm run lint` — failed on an unrelated existing platform-admin file not touched by this slice: `apps/api/src/modules/platform-admin/application/platform-admin.authorizer.ts`.
- `npm run deploy:preflight` — passed.
- `git diff --name-only -- packages/database packages/contracts apps/api/src/modules` — passed empty.
- `rg -n "All nine|9 primary|3 × 3|3x3|nine-card|nine card|exactly nine|eight containers|eight primary" docs/ASSET_MANIFEST.md docs/HOME_BRAND_SPEC.md requirements.md structure.md progress.md tests` — returned only this ledger's recorded command text.

**Deployment/runtime proof**

- production build passed locally.
- deploy preflight passed locally.
- no live deployment or browser smoke test was performed in this slice.

**Known failures/unverified areas**

- source branch created in a separate clean worktree because the main checkout had mass deleted files and was behind `origin/phase-0-foundation`.
- full `npm run format:check` is blocked by pre-existing repo-wide formatting drift and was replaced by exact touched-file Prettier verification for this slice.
- full `npm run lint` is blocked by the unrelated platform-admin no-empty-object-type error and was replaced by exact touched-file ESLint verification for this slice.
- `npm test` wrapper is blocked by Windows `spawn EINVAL`; the same unit test file set passed when run in smaller chunks.
- no live deployment or UI browser smoke test has been run.

**Score: 8/10**
**Status: VERIFIED SOURCE SLICE, NOT LIVE-DONE**

**Next action**

- review the diff, resolve unrelated baseline formatter/lint/test-wrapper issues separately if desired, then commit or open a PR for `product/home-ia-simplify`.

## 2026-08-22 — Connect active development branch to Railway

**Task**
Connect `phase-0-foundation` to Railway so real source changes trigger builds.

**Reason/root cause**
Existing Railway service was following stale `main`, while active application work was on `phase-0-foundation`.

**Authoritative docs/source inspected**

- `structure.md`
- `requirements.md`
- Railway current service source/deployment metadata
- GitHub branch state

**Files changed**

- no product source file required for the branch-source connection itself;
- an empty Git commit was used to trigger a fresh branch event after Railway initially replayed the stale snapshot.

**Commit(s)**

- `8291507...` — branch trigger commit (exact full SHA should be refreshed from Git history when this entry is next edited).

**Database/migration changes**

- none.

**Tests/commands actually verified**

- Railway deployment metadata showed branch `phase-0-foundation` and subsequent current branch commit hashes.

**Deployment/runtime proof**

- subsequent GitHub commits automatically triggered Railway builds from `phase-0-foundation`.

**Known failures/unverified areas**

- API build still fails on source/schema normalization errors;
- no healthy public API URL yet.

**Score: 7/10**
**Status: VERIFIED, NOT DONE**

**Next action**

- repair root compiler/schema inconsistencies until shared API builds/runs.

---

## 2026-08-22 — Correct Argon2 password verification API usage

**Task**
Fix `argon2.verify` compile failure.

**Reason/root cause**
The code passed a `type` option to `argon2.verify`, but the installed Argon2 API determines the algorithm from the encoded PHC hash; `type` is a hash-generation option, not a valid verification option.

**Files changed**

- `packages/auth/src/index.ts`

**Commit**

- `7bf11b138f0b435b265441082c52f36b943e8bc3`

**Database/migration changes**

- none.

**Tests/commands actually verified**

- a later Railway build successfully compiled `@hooma/auth` and advanced to later API errors.

**Deployment/runtime proof**

- fix reached Railway automatically from `phase-0-foundation`.

**Known failures/unverified areas**

- focused auth tests were not yet recorded as passing;
- whole API still failed later on unrelated errors.

**Score: 7/10**
**Status: VERIFIED, NOT DONE**

**Next action**

- run/record relevant auth tests during foundation verification.

---

## 2026-08-22 — Correct shared async Express handler typing

**Task**
Remove repeated `Promise<Response> is not assignable to Promise<void>` route compiler failures at the shared wrapper owner.

**Reason/root cause**
The shared wrapper accepted only handlers returning `Promise<void>`, while normal Express async handlers may return the `Response` produced by `res.json()`/similar calls.

**Files changed**

- `apps/api/src/http/middleware/async-handler.ts`

**Commit**

- `88b959c2c8b231f38aabc5890cca1a33ae357135`

**Database/migration changes**

- none.

**Tests/commands actually verified**

- Railway rebuild triggered; final whole-API verification remains pending because later errors still block compilation.

**Known failures/unverified areas**

- no dedicated middleware test recorded yet.

**Score: 6/10**
**Status: IN_PROGRESS, NOT DONE**

**Next action**

- confirm through clean API typecheck/build and route tests after remaining blockers are repaired.

---

## 2026-08-22 — Correct absent Audit metadata Prisma write

**Task**
Fix `exactOptionalPropertyTypes` / Prisma incompatibility when Audit metadata is absent.

**Reason/root cause**
Audit writer explicitly sent `metadata: undefined`; Prisma input expects the property to be omitted when absent rather than receiving `undefined`.

**Files changed**

- `apps/api/src/modules/audit/infrastructure/prisma-audit-writer.ts`

**Commit**

- `db6e7e6f4ed38396411f1661bd24c9881d996447`

**Database/migration changes**

- none.

**Tests/commands actually verified**

- Railway rebuild triggered on this exact commit.

**Known failures/unverified areas**

- whole API build remains blocked by other domain/schema errors;
- focused Audit integration test not yet recorded.

**Score: 6/10**
**Status: IN_PROGRESS, NOT DONE**

**Next action**

- verify in clean API build and Audit persistence integration tests.

---

## 2026-08-22 — Create living HOOMA progress plan

**Task**
Create this root `progress.md` as the mandatory execution/evidence ledger.

**Reason/root cause**
Planning documents were becoming stale relative to active decisions and runtime discoveries. The project needs one visible living record of rules, phases, proof, scores and real completion state.

**Files changed**

- `progress.md`

**Commit**

- recorded by the GitHub create-file operation for this entry; replace this text with the exact commit SHA on the next update.

**Database/migration changes**

- none.

**Tests/commands actually verified**

- file creation through GitHub on `phase-0-foundation`.

**Known failures/unverified areas**

- active planning documents still need reconciliation with current HOOMA naming and updated Whistle rules.

**Score: 8/10**
**Status: VERIFIED, NOT DONE**

**Next action**

- update this entry with exact commit SHA, then reconcile `structure.md` / `requirements.md` architecture-affecting conflicts while continuing runtime repair.

---

# 39. NEXT EXECUTION STEP

Immediate next task after this file exists:

1. fetch the latest Railway build result for the current `phase-0-foundation` head;
2. identify the first remaining root compiler/schema contradiction;
3. inspect the related canonical model + schema + repository + service + contracts + frontend consumer;
4. correct the canonical owner rather than patching the compiler symptom;
5. run the available verification;
6. let Railway rebuild automatically;
7. update this `progress.md` with exact changed files, commit, proof, score and status;
8. repeat until the shared HOOMA API is healthy;
9. then obtain and verify the Web App URL;
10. then obtain and verify the Telegram Mini App URL and bot link.

## 2026-08-29 — Play Invite Player / Hire Player lifecycle source-corrected

**Task**
Complete the Play Players `INVITE` and `HIRE PLAYER` actions without changing the locked Play IA or creating duplicate lifecycle ownership.

**Reason/root cause**
The GAME card was intentionally non-interactive, while the TEAM card used a page-local sent flag and a Teams route that accepted a Play listing ID. Teams infrastructure resolved that ID by reading Play-owned Prisma persistence directly. There was no durable Event-owned player invitation lifecycle. The frontend could also treat `me === null` as guest while account loading was still in progress.

**Authoritative ownership implemented**

- Play owns player-listing discovery, listing-target resolution and cross-domain orchestration only.
- Teams owns `TeamPlayerOffer`, roster authorization and `TeamPlayer` creation on acceptance.
- Events owns `EventPlayerInvite` and canonical RSVP/waitlist acceptance.
- Teams no longer queries `PlayPlayerListing` persistence.
- Event invitation send never auto-creates an RSVP.
- Event invitation acceptance reuses the same row-locked RSVP capacity/waitlist transaction as ordinary Join.
- Event cancellation/completion closes pending invitations.
- Pending action UI state is read back from Teams/Events and mapped to current Play listing IDs server-side rather than persisted as browser-local authority.

**Primary files changed**

- `apps/api/src/bootstrap/container.ts`
- `apps/api/src/modules/play/**`
- `apps/api/src/modules/teams/**`
- `apps/api/src/modules/events/**`
- `packages/contracts/src/play.ts`
- `packages/contracts/src/team-offers.ts`
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20260829214500_event_player_invites/migration.sql`
- `packages/frontend/src/events/PlayPage.tsx`
- `packages/frontend/src/events/PlayPlayerCard.tsx`
- `packages/frontend/src/events/EventInvitesPanel.tsx`
- `packages/frontend/src/events/play-api.ts`
- `packages/frontend/src/events/api.ts`
- `packages/frontend/src/teams/team-offer-api.ts`
- `requirements.md`
- `docs/CANONICAL_MODEL.md`
- `docs/adr/ADR-049-play-player-actions.md`
- focused Play/Team/Event tests

**Verification evidence**

- PR: `#166` (`fix/play-player-actions-lifecycle` -> `phase-0-foundation`).
- Implementation/documentation head `ef7d7471297774c5f597658fdd3e7df9e1f91cf5` passed CI run `33278161057` end-to-end.
- Passed clean install, Prisma generate/validate, clean migration deploy including `20260829214500_event_player_invites`, architecture check, changed-file Prettier, changed-source lint, TypeScript, package build, unit tests, full build, PostgreSQL integration tests, deploy preflight, security check and migration status.
- Final PR head is re-run through the same CI after this evidence-only ledger update before readiness is claimed.

**Remaining uncertainty**
Automated CI and database integration are proven. A real browser/Telegram Mini App click-through is still a separate runtime proof because this execution environment does not expose browser automation.

---

## 2026-09-01 — Start Athletes foundation PR 2

**Task**
Start PR 2 for the Athletes foundation domain after PR #212 merged the HOOMA/Teams IA correction.

**Foundation**

- PR #212 head: `0d6d8f6761c0bb21d5620257539066c40cd8b8c5`
- merged/read-back foundation: `3f72b3e97e6d6147a39610ecaab082bf727851c6`
- branch: `feat/athletes-foundation`

**Decision**

Athletes is a separate HOOMA-connected domain using canonical `User`, independent Athletes persistence, and independent Athletes membership/join-request lifecycle. It is not a Community subtype, not a Team subtype, not ULTRAS, and not a generic creator abstraction.

**Status**

PR #213 merged into `phase-0-foundation` as the canonical Athletes domain foundation at merge commit `984f0ce4eb216f50ec3ae7a12a7ea5802481fb45`. Its database, API, contracts, service, repository, authorization, migration, integration tests, and frontend route foundation are no longer pending work.

---

## 2026-09-02 — Athletes mobile visual system merged

**Task**
Record the post-foundation Athletes mobile-first visual-system pass.

**Foundation**

- Prior Athletes domain foundation merge: `984f0ce4eb216f50ec3ae7a12a7ea5802481fb45`
- PR: #214 `feat(athletes): introduce mobile-first sport visual system`
- PR #214 head merged: `523c167f382ae5e282a154ca6aa82286ca91e707`
- PR #214 merge commit: `7fa8cce1b93705b2c47c33c7510b3fc9bbc1fdc3`

**Status**
PR #214 is merged and is the canonical first Athletes mobile/sport visual-system pass. The PR changed only `packages/frontend/src/athletes/AthletesPages.tsx` and `packages/frontend/src/athletes/athletes.css`; it did not reopen Athletes API, contracts, auth, repository, Prisma, migrations, routes, or domain architecture.

---

## 2026-09-02 — Athletes mobile runtime presentation hardening

**Task**
Post-merge runtime/mobile validation and corrective hardening for the merged Athletes UI after PR #214.

**Foundation**

- Starting foundation from PR #214 read-back: `7fa8cce1b93705b2c47c33c7510b3fc9bbc1fdc3`
- Earlier rechecked `origin/phase-0-foundation`: `dce9ff915c12cc130ee3c6352d9c6514d6d00e06`
- Current rechecked `origin/phase-0-foundation`: `f864554dd65cd1c9c9c9655fe0bde0c25ca92909`
- Current foundation includes the semantic positive-token test correction `f864554dd65cd1c9c9c9655fe0bde0c25ca92909` and the Athletes semantic color cascade via `packages/frontend/src/athletes/athletes-semantic.css`, loaded after `athletes.css`. PR #215 was rebased onto this foundation without conflict; the existing Athletes hardening commits were preserved.
- Branch: `fix/athletes-mobile-runtime-hardening`

**Finding**
Runtime/source inspection found Athletes create presentation still coupled to Community-owned `.hooma-*` form presentation classes. Athletes compensated with `!important` overrides in its own CSS, creating unnecessary cross-domain CSS ownership coupling and specificity fragility.

**Correction**

- Removed Athletes dependence on Community-owned form presentation/layout classes: `.hooma-create-form`, `.hooma-form-grid`, `.hooma-privacy-choice`, `.hooma-form-actions`, and `.hooma-span-2`.
- Added Athletes-owned field/layout/choice/action classes for the create surface and scoped the new presentation selectors under `.athletes-page`.
- Removed the unnecessary Athletes `!important` overrides created by the prior cascade conflict, including the current semantic selected-state overrides that no longer need `!important` because `athletes-semantic.css` loads after `athletes.css`.
- Preserved native radio controls for sport, visibility, and join-policy choices.
- Updated the stale permanent bottom-navigation contract expectation from `Pitch` to `Athletes` while leaving Home gateway Pitch expectations unchanged.
- Kept sport typed as canonical `AthletesSport` and left `visibility`, `joinPolicy`, create payload, routes, authorization, API, contracts, Prisma, migrations, service, and repository unchanged.

**Runtime evidence obtained**

- Rebuilt packages with `npm run build:packages` so the web runtime consumed the changed `@hooma/frontend` dist output.
- Install-free temporary Playwright runtime outside product dependencies validated the final cascade for `/athletes` and `/athletes/new` at `360px`, `390px`, `430px`, and `1024px`.
- `/athletes/new` showed no document horizontal scroll at all tested widths; all nine canonical sports rendered; 13 native radios were visible across sport, visibility, and join-policy controls. Selected sport and selected choice computed to green `rgb(163, 230, 53)` from the semantic cascade.
- Sport switching was verified for `CYCLING`, `RUNNING`, `SWIMMING`, `FOOTBALL`, `BASKETBALL`, `TENNIS`, `PADEL`, `GYM_FITNESS`, and `OTHER`: exactly one sport radio checked, labels activated radios, selected class applied, selected state computed green, hero text updated to the selected sport label, and an unrelated name input stayed preserved while switching.
- Private visibility selection was verified to force approval-required joining and disable open join.
- Focus proof showed the focused sport radio's label received a visible lime outline through `:focus-within`.
- `/athletes` rendered at all tested widths without document-level horizontal scroll or non-scroller overflow; the sport chip rail intentionally scrolls horizontally inside the viewport. The active chip computed to green `rgb(163, 230, 53)`.

**Runtime evidence still unavailable**

- `/athletes` populated-list, long-record, member/join metadata, and read-back create states were not locally proven because no real local API/PostgreSQL environment was running; the observed runtime API calls failed with local connection-refused errors.
- `/athletes/:athletesCommunityId` real detail states, member/moderator/founder role states, join-request lifecycle, create success/read-back, and API-backed keyboard/state paths remain not locally proven and rely on #213 domain/integration coverage plus CI until a disposable PostgreSQL/API runtime is available.
- Telegram Mini App runtime was not proven in this environment.

**Files changed**

- `packages/frontend/src/athletes/AthletesPages.tsx`
- `packages/frontend/src/athletes/athletes.css`
- `packages/frontend/src/athletes/athletes-semantic.css`
- `tests/navigation-contract.test.mjs`
- `progress.md`

**Verification status**

- `npm ci`: passed.
- `npm run db:generate`: passed.
- `npm run db:validate`: passed with a local dummy-format `DATABASE_URL`; the first run without `DATABASE_URL` failed at Prisma config resolution, not source validation.
- `npm run architecture:check`: passed.
- Changed-file Prettier check for `AthletesPages.tsx`, `athletes.css`, `athletes-semantic.css`, `tests/navigation-contract.test.mjs`, and `progress.md`: passed.
- Changed-source ESLint for `packages/frontend/src/athletes/AthletesPages.tsx`: passed.
- `npm run typecheck`: passed.
- `npm run build:packages`: passed.
- `npm test`: passed after rebasing onto foundation `f864554dd65cd1c9c9c9655fe0bde0c25ca92909`, where the stale semantic-token zero-drift assertion was corrected.
- `npm run build`: passed.
- `npm run deploy:preflight`: passed.
- `npm run security:check`: passed, 0 production high vulnerabilities.
- `npm run test:integration`: NOT LOCALLY PROVEN — requires disposable PostgreSQL CI.
- `npm run db:migrate:status`: NOT LOCALLY PROVEN — requires disposable PostgreSQL CI.
- PR #215 remains open from `fix/athletes-mobile-runtime-hardening` to `phase-0-foundation`. Local rebase-validation passed through `npm test`, app build, deploy preflight, and security after the foundation semantic-token test correction; exact-head CI is pending after push of the rebased branch.

Mobile/TMA runtime validation must not be marked complete until the missing API-backed and Telegram evidence is actually obtained.

**Next recommended Athletes slice**
After this corrective PR is reviewed and merged, run a disposable PostgreSQL/API-backed Athletes runtime validation slice for populated hub, create/read-back, detail, role-specific states, and Telegram Mini App viewport proof before starting any new Athletes feature surface.
