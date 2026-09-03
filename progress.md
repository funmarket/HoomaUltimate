# HOOMA — LIVING PROGRESS PLAN

Status: **ACTIVE — living execution and evidence ledger**
Product: **HOOMA**
Repository/workspace only: `funmarket/HoomaUltimate`
Active development branch: `phase-0-foundation`
Release target: `main` — intentionally not the current implementation authority; promote only after `phase-0-foundation` is clean and production-ready.
Created: **2026-08-22**
Last documentation reconciliation: **2026-09-03**

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

`structure.md`, `requirements.md`, and this living ledger are important guides, but none is infallible when a newer explicit product-owner decision and verified merged source establish a later contract.

If a document conflicts with:

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

The same canonical HOOMA account must own the same current/future domain relationships according to whichever owning domains are actually implemented.

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
- Athletes: Founder / Moderator / Member
- ULTRAS: Leader / Moderator / Member
- Gamer Squad: Leader / Member
- Place: verified Owner where applicable

A Team Coach uses the **Coach Control Room**, never an Admin Dashboard.

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

# 8. LOCKED TOP-LEVEL NAVIGATION AND HOME — CURRENT 2026-09-03

Permanent bottom navigation is exactly:

```text
Home | Play | Watch | HOOMA | Athletes
```

Main Home grid is exactly six containers in a clean 3 x 2 layout:

```text
HOOMA | Teams | Pitch
Places | Ride  | Requests
```

Pitch remains an independent product at `/pitch` and a Home gateway; it is no longer the fifth permanent navigation item. Athletes is an independent HOOMA-connected domain at `/athletes` and owns that fifth permanent navigation slot.

The current visible Home label is `Places`; the source may retain the internal gateway id `spots` without creating a second venue domain. Watch may continue using `Spots` as Watch-owned product language independently.

Gamers remains a real independent product and route family, but it is not an active Home gateway or HOOMA create option. ULTRAS remains a future independent domain and is not a HOOMA Community type. FundMe remains grouped under Requests as `/requests/fundme`; `/fundme` redirects there as compatibility navigation only.

The approved attached original gateway artwork is authoritative where still current. Do not regenerate or replace it without explicit instruction.

ADR-055 is the current navigation/Home IA decision. Earlier references to permanent-nav `Pitch` or visible Home `Spots` are historical unless explicitly marked otherwise.

---

# PART I — CURRENT FOUNDATION / RUNTIME

# 9. RUNTIME MISSION

During development, all implementation, auditing, fixes, tests and deployment verification target:

```text
phase-0-foundation
```

`main` is the release target only. It is intentionally not the current implementation authority and must not be used to judge current feature completeness. HOOMA moves to `main` only after `phase-0-foundation` is clean and production-ready.

Required runtime model:

```text
HOOMA shared API        -> healthy public HTTPS endpoint
HOOMA Web frontend      -> public HTTPS application
HOOMA Telegram entry    -> canonical Web /telegram Mini App route
Legacy Telegram host    -> redirect only where deployed
PostgreSQL              -> same canonical database used by the shared API
Redis                    -> transient shared infrastructure
Worker                   -> deployed only when async responsibilities are expected to run
Object storage           -> configured when storage-backed current features require it
```

Web and Telegram use the **same backend and same database**.

---

# 10. DOCUMENT RECONCILIATION GATE

Current documentation must agree with current owner decisions and merged source on the active slice. In particular:

- product branding is HOOMA, not HOOMA ULTIMATE;
- current permanent nav is `Home | Play | Watch | HOOMA | Athletes`;
- current Home is `HOOMA | Teams | Pitch | Places | Ride | Requests`;
- current Whistle uses UTC-midnight expiry/direct visibility with no Reveal;
- current enabled Whistle contexts include Community, Event, Athletes, Ride, Gamer Direct and User Direct through their actual authorization boundaries;
- current domain-owned Ride/Gamer media uses shared object-storage infrastructure even though a generic Media domain is not required;
- source existence, deployment and verified runtime remain distinct claims.

Architecture-affecting contradictions must be corrected before later agents use the stale text as implementation authority.

---

# 11. API / SOURCE HEALTH GATE

The shared API must compile cleanly and keep schema, migration, repository, service, contracts and frontend consumers aligned. Do not suppress strict TypeScript/Prisma errors or patch a downstream symptom when the canonical owner is wrong.

Current runtime audits have proven the phase API can build/deploy and connect to Railway PostgreSQL; future source changes still require their own exact-head verification.

---

# 12. PRE-RELEASE DATABASE GATE

HOOMA owns the current Prisma schema and committed migration history.

Rules:

- no production `prisma db push` shortcut;
- schema and committed migration chain must deploy cleanly;
- any pre-release migration-history consolidation is an explicit reviewed task, never an automatic rewrite merely because an old plan expected one initial migration;
- after public release, shipped migrations are forward-only;
- migration status must be verified against the intended runtime before release claims.

---

# 13. DEPENDENCIES AND CI GATE

Required:

- committed `package-lock.json` consistent with workspace manifests;
- clean `npm ci`;
- deterministic Prisma generation;
- CI read-only;
- no CI lockfile/source repair commits;
- explicit process build/start commands;
- no uncontrolled `latest` dependency drift.

---

# 14. ACTIVE RUNTIME FINDINGS — 2026-09-03

Verified against the active `phase-0-foundation` Railway topology during the current audit sequence:

- phase API deployment exists and has successfully started against Railway PostgreSQL;
- current migration deploy reported no pending migrations at the inspected deployment;
- Web deployment exists and uses the same-origin `/api` proxy toward the phase API;
- canonical Telegram Mini App content is the Web `/telegram` route; the separate Telegram Railway host is a legacy redirect surface;
- PostgreSQL and Redis are operational in the inspected topology;
- the repository contains `@hooma/worker`, but no Worker Railway service was deployed at the inspected time;
- the active phase API did not have the required `OBJECT_STORAGE_*` variable names configured at the inspected time, so storage-backed Ride/Gamer operations that require object storage cannot be considered runtime-complete;
- Railway API healthcheck used `/health`, while `/health/ready` is the stronger dependency-aware readiness route; readiness itself currently checks PostgreSQL/Redis but not object storage.

These are current audit findings, not permanent architecture rules. Re-verify before changing runtime or claiming they remain true.

---

# PART II — CURRENT FOUNDATION PRODUCT OWNERSHIP

# 15. IDENTITY, PROFILE AND PLATFORM ADMIN

Keep one canonical User, independent Web/Telegram auth transports, server-authorized Profile responsibilities, and `PLATFORM_ADMIN` only for global App Admin authority.

Profile is the user's identity/responsibility hub and must project real canonical relationships rather than duplicate domain state.

---

# 16. HOOMA COMMUNITIES, TEAMS, ATHLETES, PLAY/EVENTS

## HOOMA Communities

- `/hooma` creates only canonical HOOMA Communities;
- Founder/Coach/Member remain Communities-owned;
- no generic Community type selector.

## Teams

- Team creation remains Teams-owned at `/teams/new`;
- required parent HOOMA context is selected inside the Team flow;
- Coach Control Room and Team authorization remain Teams-owned;
- Play and Gamers remain separate products.

## Athletes

- Athletes is an independent HOOMA-connected domain at `/athletes`;
- it owns its own community/membership/join-request lifecycle;
- it is the fifth permanent navigation item;
- current member-authorized Athletes Whistle uses the shared Whistle engine rather than a new messaging system.

## Play / Events

- Events owns canonical Event lifecycle;
- Play owns its own discovery/recruitment concepts over Events where designed;
- Play and Gamers must not be merged or built on each other.

---

# PART III — HOME / BRAND / NAVIGATION

# 17. CURRENT HOME AND NAVIGATION CONTRACT

Required current navigation:

```text
Home | Play | Watch | HOOMA | Athletes
```

Required current Home gateway:

```text
HOOMA | Teams | Pitch
Places | Ride | Requests
```

Current source-backed changes are intentional:

- `f884c22417d9139111bbb1f40bcd8ebab6d8a237` — `feat(nav): replace Pitch with Athletes`;
- `c44422a9391e7582765acb4e9bc0ccb893e6a3a6` — `fix(home): reorder Pitch and Places gateways`.

Do not restore old Pitch-nav or visible Home-Spots contracts from older plans/ADRs.

---

# PART IV — DOMAIN STATUS NOTES

# 18. PLACES / WATCH / PITCH

One canonical physical Place remains the source of truth. Pitch is a dedicated product over canonical Place and remains at `/pitch`. Watch uses canonical Place directly and may use Watch-specific `Spots` language without changing the Home gateway label back from `Places`.

Watch and Pitch remain separate product functions.

---

# 19. REQUESTS

Requests owns its own help/resource lifecycle. Current product requirements use quantity-based partial claims with concurrency safety rather than the older “exclusive claim only” wording. FundMe remains grouped under Requests in presentation while durable Fundraising/Payments remain separate owners.

---

# 20. RIDE

Ride owns its own offer/request/participation/meeting-point/waypoint/vehicle-photo concepts. Matchday and Anywhere are contexts of one Ride domain. Exact pickup/meeting locations remain private by server policy.

Current Ride Whistle is authorized through the shared Whistle engine using Ride-owned authorization; do not route a Ride Whistle through a generic direct-user path merely because the requester has a username.

Object-storage-backed Ride vehicle photos require the existing shared storage configuration and background cleanup responsibilities to be operational before the media lifecycle can be called runtime-complete.

---

# 21. WHISTLE — CURRENT AUTHORITATIVE RULES

There is exactly one shared Whistle engine.

```text
33 grapheme clusters maximum
11 total sends per User per UTC calendar day
UTC day = 00:00 UTC to next 00:00 UTC
unused sends never carry over
every Whistle expires at the next UTC midnight
body in Redis only
PostgreSQL metadata only
authorized feeds show body directly
no Reveal endpoint
no viewer-specific reveal/seen state
```

Current enabled contexts in merged source include:

- COMMUNITY;
- EVENT;
- ATHLETES;
- RIDE;
- GAMER_DIRECT;
- USER_DIRECT.

TEAM, ULTRAS and GAMER_SQUAD remain closed until their owning authorization slices explicitly enable them.

Known current source defect discovered during audit: Whistle metadata/quota persistence commits before notification persistence, while the service catch path deletes the Redis body if notification creation throws. That can leave durable metadata/quota consumed without a body while the request fails. This is a current source failure-boundary defect to fix through the existing transactional/outbox pattern; it is not evidence that a production incident has already occurred.

---

# 22. GAMERS

Gamers is an independent implemented route family at `/gamers`. It is not a Home gateway and must not become a sixth permanent bottom-navigation item. Its human-first challenge/Match Card/result/ranking/Squad design remains Gamers-owned and separate from Play/football Teams.

---

# 23. MEDIA / WORKER / NOTIFICATIONS — CURRENT GAPS

Current audit findings:

- shared object-storage abstraction exists in `packages/storage`;
- active phase API lacked required object-storage environment keys at the inspected time;
- repository Worker exists and owns outbox/cleanup/reconciliation loops, but no Worker Railway service was deployed at the inspected time;
- `UserNotification` backend persistence/listing exists for current Whistle notification producers, but mark-read/unread-count/frontend inbox lifecycle remains incomplete;
- do not create duplicate storage, Worker, Whistle or notification systems to solve these gaps.

---

# 24. RELEASE GATE

Before promoting `phase-0-foundation` into `main`:

- clean install;
- Prisma generate/validate;
- current migration chain deploy/status verified;
- architecture check;
- format/lint;
- TypeScript;
- unit/integration tests;
- real PostgreSQL/Redis tests where required;
- API/Web/Telegram/Worker builds where applicable;
- security/auth/permission checks;
- mobile/Web/TMA smoke checks;
- object-storage lifecycle verified for current features that require it;
- Worker deployed and verified if current production behavior depends on it;
- readiness health accurately reflects mandatory dependencies;
- public/private data leakage checks;
- production environment validation;
- backup/rollback/recovery plan documented;
- no secrets committed;
- current governing docs reconciled.

Only then move the production-ready application into `main`.

---

# 25. DONOR USAGE RULE

Original HOOMA and V3 remain donor/reference implementations only. Borrow proven behavior, visuals and mature flows where useful; do not let donor schema/auth/technical debt override current HOOMA ownership.

---

# 26. CHANGE EVIDENCE LEDGER

Historical evidence remains in Git history and in the entries below. Historical statements describe what was true at the recorded time and do not override newer current-state sections above.

## 2026-08-29 — Home/create-flow IA simplification source-verified

**Historical note:** This entry correctly records the then-current six-gateway/Pitch-nav state. Its old visible `Spots` Home label and Pitch bottom-nav assumptions were later superseded by merged source and ADR-055.

**Task**
Implement the `fixhome.md` Home/create-flow IA simplification on branch `product/home-ia-simplify`.

**Reason/root cause**
Home and create-flow contracts drifted across requirements, structure, brand/asset docs, tests and source. The product-owner direction at that time reduced Home discovery to six gateways, removed Gamers/ULTRAS/FundMe from Home, grouped FundMe under Requests, added honest Requests/Ride shells, and kept durable domain ownership unchanged.

**Status at that time:** VERIFIED SOURCE SLICE, NOT LIVE-DONE.

---

## 2026-08-22 — Runtime/foundation setup history

The original ledger recorded Railway branch connection, Argon2 verification correction, async Express handler typing correction, Audit metadata Prisma write correction and creation of this living progress plan. Those entries remain available in Git history before this 2026-09-03 reconciliation. They are implementation history, not current runtime status.

---

## 2026-08-29 — Play Invite Player / Hire Player lifecycle source-corrected

PR #166 (`fix/play-player-actions-lifecycle`) implemented the Play-to-Teams/Event recruitment/invite handoffs while preserving owning-domain persistence and authorization. CI/integration evidence at the recorded exact head remains historical proof for that slice; later changes require their own verification.

---

## 2026-09-01 — Athletes foundation

PR #213 merged the canonical Athletes domain foundation at merge commit `984f0ce4eb216f50ec3ae7a12a7ea5802481fb45`.

---

## 2026-09-02 — Athletes mobile visual system and hardening

PR #214 merged the first Athletes mobile/sport visual-system pass. Subsequent hardening removed Athletes dependence on Community-owned form presentation classes and updated the navigation contract expectation from Pitch to Athletes. These entries establish that Athletes nav was already intentionally recognized before this documentation reconciliation.

---

## 2026-09-02 — Whistle Ride context/delivery repair

The source audit found the old Ride-to-direct-user Whistle bypass, reconciled Ride Whistle to the canonical `RIDE` context, and introduced metadata-only notification persistence. Current merged source should be re-read rather than relying on the old pre-repair TODO wording in earlier planning entries.

---

## 2026-09-03 — Ride plan reconciliation / RIDE-007C closeout audit

The prior ledger verified current Ride route/readback/mobile closeout work and explicitly recorded the current bottom nav as:

```text
Home | Play | Watch | HOOMA | Athletes
```

This later evidence superseded the stale Pitch-nav statements that remained near the top of the old progress plan.

---

## 2026-09-03 — Documentation current-state reconciliation

**Task**
Reconcile current HOOMA documentation with merged `phase-0-foundation` navigation/Home IA and audit adjacent stale current-state claims.

**Reason/root cause**
Merged source intentionally replaced permanent-nav Pitch with Athletes and changed the Home visible ordering/label, but several governing documents still described the earlier IA. Additional stale statements still described Athletes/Ride Whistle and object storage as future-only.

**Authoritative evidence inspected**

- current `phase-0-foundation` HEAD at audit start: `6ffec7d035277f3a45cc585877f220cdc36a2874`;
- no open PRs targeting `phase-0-foundation` at rechecks;
- `packages/ui/src/navigation/HoomaBottomNav.tsx`;
- `packages/ui/src/home/home-gateways.ts`;
- navigation/Home contract tests;
- commit `f884c22417d9139111bbb1f40bcd8ebab6d8a237` (`feat(nav): replace Pitch with Athletes`);
- commit `c44422a9391e7582765acb4e9bc0ccb893e6a3a6` (`fix(home): reorder Pitch and Places gateways`);
- current Whistle/Athletes/Ride source and previously verified phase runtime topology.

**Current navigation truth**

```text
Permanent nav: Home | Play | Watch | HOOMA | Athletes
Home:          HOOMA | Teams | Pitch
               Places | Ride | Requests
```

**Documentation changes in the reconciliation branch**

- `structure.md`;
- `requirements.md`;
- `docs/DECISIONS.md`;
- `docs/adr/ADR-055-current-navigation-home-ia.md`;
- `docs/adr/ADR-048-home-create-flow-ia.md`;
- `docs/adr/ADR-054-athletes-independent-domain.md`;
- `docs/HOME_BRAND_SPEC.md`;
- `docs/ASSET_MANIFEST.md`;
- `docs/GAMERS_PRODUCT_CONTRACT.md`;
- `progress.md`.

**Database/migration changes**

- none.

**Product-source changes**

- none; documentation only.

**Status**
Documentation current-state reconciliation in review branch; must be compared with current `phase-0-foundation` before merge.

---

# 27. NEXT EXECUTION STEP

Before any new implementation:

1. finish/merge this documentation reconciliation only if its diff remains documentation-only and current `phase-0-foundation` has not introduced conflicting owner decisions;
2. re-read the active phase HEAD and open PRs;
3. continue production-readiness work from current source, not from `main` or historical ledgers;
4. highest verified runtime blockers remain object-storage configuration, Worker deployment, Whistle notification failure-boundary consistency, notification lifecycle completion, and readiness/health alignment unless a newer inspection proves they changed.
