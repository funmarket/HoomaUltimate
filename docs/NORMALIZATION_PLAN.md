# HOOMA ULTIMATE — FOUNDATION NORMALIZATION PLAN

Status: **ACTIVE EXECUTION PLAN**  
Branch: `phase-0-foundation`  
Purpose: make the already-built foundation internally consistent, fully verified, and structurally ready before any new product domain is started.

---

## 0. Execution rule

No new product domain may begin while this plan is active.

Frozen until the final gate passes:

- Places
- Watch
- Pitch
- ULTRAS
- Gamers
- Whistle
- Requests
- Ride
- FundMe
- Payments
- Media/Replay
- HOOMA NOW

Work during normalization is limited to:

- repository/tooling correctness;
- canonical schema and migrations;
- Identity/Auth hardening required by the current implementation;
- Platform Admin/Audit consistency;
- Communities consistency;
- Teams correctness and completion of already-started behavior;
- Events/Play correctness and boundary cleanup;
- Web/Telegram structure and routing;
- contracts/package organization;
- Worker ownership required to finish already-started temporary Event behavior;
- verification, CI, Railway configuration, and documentation.

Do not use this phase to sneak in a new domain under the label "cleanup".

---

## 1. Non-negotiable engineering rules

1. Fix the authoritative source, not downstream symptoms.
2. One canonical model and vocabulary per concept.
3. Schema, migration, Prisma client, repository, service, contracts, tests, and UI projection must agree.
4. No compatibility layer for pre-release HOOMA ULTIMATE mistakes. This app has not shipped yet.
5. No duplicate tables, endpoints, role systems, auth state, networking stacks, routers, or persistence paths.
6. No frontend-only authorization.
7. No generated or hand-written `any` aliases for Prisma transaction/client types.
8. No production mock data.
9. No CI job may modify or push repository source.
10. No feature is `DONE` until its complete path is proven against real infrastructure.
11. Every completed stage updates `docs/IMPLEMENTATION_STATUS.md` before the next stage starts.
12. If a stage uncovers a deeper contradiction, stop that stage and correct the canonical model/documentation first.

---

# Stage A — Canonical truth freeze

Goal: remove ambiguity before changing persistence.

## A1. Canonical documents

Maintain:

- `structure.md` — repository/build architecture;
- `requirements.md` — product acceptance contract;
- `docs/CANONICAL_MODEL.md` — current implemented-domain data and authority truth;
- `docs/DECISIONS.md` — architectural decisions;
- `docs/IMPLEMENTATION_STATUS.md` — live evidence ledger;
- this file — execution order.

## A2. Current domain ownership

Lock ownership before source edits:

- Identity/Auth owns User, credentials, Telegram identity, sessions, presentation identity.
- Platform Admin owns global `PLATFORM_ADMIN` authority.
- Audit owns durable sensitive-operation history.
- Communities owns HOOMA communities and Founder/Coach/Member membership authority.
- Teams owns Team, roster, Team responsibility/capability authority, lineup, challenge, challenge conversation, and TeamGame.
- Events owns canonical Event lifecycle, RSVP/waitlist, formation, check-in, and temporary Event chat.
- Play is a product/use-case layer over PLAY Events.
- Worker owns durable cleanup/async execution; API services own business policy.

## A3. Freeze future domain representations

Do not add placeholder tables for frozen domains to the normalized initial migration.

### Stage A gate

Pass only when canonical model and ADR documents contain no conflicting current-domain rules.

---

# Stage B — Canonical schema repair

Goal: make one Prisma schema accurately represent the implemented application.

## B1. Identity/Auth

Verify and normalize:

- `User`
- `UserPresentation`
- `WebCredential`
- `WebSession`
- `TelegramIdentity`
- `PlatformRoleAssignment`
- `AuditLog`
- `OutboxEvent` foundation

Required invariants:

- one canonical User;
- Web and Telegram identities independently attach to User;
- no heuristic account merge;
- login username is distinct from display username;
- opaque Web sessions store token hash only;
- `PLATFORM_ADMIN` is global only.

## B2. Community

Canonical roles:

```text
FOUNDER | COACH | MEMBER
```

Rules:

- no scoped `ADMIN` role;
- membership history may be retained with `leftAt`/equivalent;
- Founder has community-management authority;
- Coach has delegated community-management authority where explicitly defined;
- Team authority fallback may consult active Founder/Coach membership only through the Teams authorization policy.

## B3. Team

Canonical Team properties must support:

- required `communityId`;
- Team identity independent from Community identity;
- maximum one ACTIVE Team per Community for V1;
- public/inactive visibility state;
- challenge availability;
- badge/media reference;
- City and `houma` kept distinct.

Do not hardwire the data model so future historical/inactive squads are impossible.

## B4. TeamPlayer

Canonical roster player:

```text
id
teamId
userId?             optional HOOMA profile link
displayName
shirtNumber?
position?
photoUrl?
isActive
createdAt
updatedAt
```

Required invariants:

- a Team may exist with zero players;
- a player record does not require a HOOMA account;
- `userId` is never globally unique;
- if linked, the same HOOMA User must not be duplicated within the same active Team roster;
- lineup slots refer to `TeamPlayer`, not directly to raw User identity.

## B5. Team responsibilities

Canonical direct responsibilities:

```text
COACH | ASSISTANT
```

Canonical timestamps:

```text
assignedAt
revokedAt
```

Rules:

- Coach has full Team management authority;
- Assistant role alone grants nothing beyond explicitly granted capabilities;
- historical revoked assignments may remain;
- only one active identical responsibility per Team/User/role.

## B6. Team capability grants

Canonical capabilities:

```text
EDIT_TEAM
MANAGE_ROSTER
MANAGE_LINEUP
CREATE_CHALLENGE
RESPOND_TO_CHALLENGE
MANAGE_TEAM_EVENTS
```

Canonical fields:

```text
teamId
userId
capability
grantedByUserId
grantedAt
revokedAt
```

Rules:

- grants are explicit;
- revoked history can remain;
- only one active identical grant per Team/User/capability;
- only Coach authority may grant/revoke Assistant powers.

## B7. Team lineup

Canonical lineup:

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

Canonical slot:

```text
TeamLineupSlot
  id
  lineupId
  teamPlayerId?
  role
  x
  y
  isStarter
  sortOrder
```

Rules:

- `x` and `y` use normalized 0..100 coordinates;
- current lineup transition is transactional;
- public API returns published lineup only;
- private management API may return drafts to authorized Team managers;
- smaller-sided formats are supported; do not hardcode eleven starters.

## B8. Team challenge/game

Required invariants:

- Team cannot challenge itself;
- at most one pending unresolved challenge exists for an unordered Team pair;
- challenge state transitions are atomic;
- only the challenged side can accept/decline;
- only the challenger side can cancel while pending;
- accepted challenge creates at most one TeamGame;
- `TeamGame.challengeId` is unique;
- scheduling may remain incomplete after acceptance and be represented truthfully;
- public Game projection excludes private leader conversation.

## B9. Team challenge conversation

Rules:

- conversation is available only after challenge acceptance;
- only Coach or an Assistant with `RESPOND_TO_CHALLENGE` for a participating Team may read/write;
- ordinary Players/members/public viewers cannot read it;
- messages are durable match-coordination records, not a generic social chat.

## B10. Events/Play

Normalize the already-started Event models:

- Event
- PlayEventDetails
- EventRsvp
- Formation
- FormationSlot
- EventCheckIn
- EventChatRoom
- EventChatMessage

Current normalized application supports creation of `PLAY` only.

Do not allow creation of `WATCH` until the Watch + canonical Place slice exists.

Preserve:

- capacity;
- row-lock/concurrency-safe RSVP;
- waitlist and automatic promotion;
- organizer authority;
- formation;
- check-in;
- cancellation/completion;
- temporary chat visibility.

### Stage B gate

- `prisma validate` succeeds after dependencies are installed;
- repositories typecheck against generated Prisma types;
- no repository references a field/compound key absent from `schema.prisma`;
- no current schema model exists without a current vertical-slice owner unless explicitly foundation infrastructure.

---

# Stage C — Reconcile backend source to canonical model

Goal: remove all schema/repository/service contradictions.

## C1. Repository ports first

For Communities, Teams and Events:

1. finalize application repository interfaces;
2. make service signatures depend on ports, not Prisma;
3. implement Prisma repositories against those ports;
4. keep transactions and DB-specific locking inside infrastructure;
5. keep lifecycle/authorization policy in domain/application layers.

## C2. Team authorization policy

Implement one capability resolution path.

Effective Team authority is resolved from:

1. direct Team Coach;
2. Community Founder/Coach fallback where the Team belongs to that Community;
3. direct Assistant plus active explicit capability;
4. otherwise deny.

No generic `managedTeamIds` shortcut may bypass capability-specific checks for protected operations.

## C3. Challenge authorization

Create explicit checks for:

- view public Challenge/Game presentation;
- create challenge;
- accept/decline;
- cancel;
- read leader coordination;
- write leader coordination.

Do not use one broad `canManageTeam` boolean for all of them.

## C4. Event boundary

Reject unsupported Watch creation at the service boundary even if an outdated client sends it.

### Stage C gate

Focused service tests prove each authorization path and lifecycle transition.

---

# Stage D — Contracts normalization

Goal: prevent `packages/contracts/src/index.ts` from becoming a cross-domain monolith.

Target:

```text
packages/contracts/src/
  common.ts
  identity.ts
  platform-admin.ts
  communities.ts
  teams.ts
  events.ts
  index.ts
```

Rules:

- each domain owns its request/response validation schemas;
- `index.ts` re-exports domains;
- no Prisma model types leak into contracts;
- frontend imports DTO/contracts, not database types;
- no duplicate frontend wire interfaces for canonical API payloads unless they are deliberate view models.

### Stage D gate

- API, Web and Telegram compile using domain contracts;
- architecture check prevents database imports from frontend.

---

# Stage E — Web and Telegram structural normalization

Goal: finish the platform architecture before route count expands.

## E1. Web target

```text
apps/web/src/
  app/
    router/
    providers/
    shell/
  features/
  pages/
  shared/
    api/
    hooks/
    lib/
    components/
  styles/
```

Requirements:

- use a real router;
- route-level lazy loading;
- one Web shell;
- one shared Web API client;
- classic auth and validated internal `returnTo` remain Web-owned;
- no `window.location.pathname` hand-router.

## E2. Telegram target

```text
apps/telegram/src/
  app/
    router/
    providers/
    telegram/
    shell/
  features/
  pages/
  shared/
    api/
    hooks/
    lib/
    components/
  styles/
```

Telegram shell owns:

- initData lifecycle;
- ready/expand;
- viewport and safe area;
- BackButton integration;
- Telegram navigation behavior;
- theme integration where useful;
- haptics/MainButton only where product flows benefit.

Do not make Telegram a wrapper around the Web shell.

## E3. Shared UI

`packages/ui` contains only platform-neutral presentation, design tokens and governed shared assets.

### Stage E gate

- no manual route switch remains;
- route tests prove required paths;
- Web and Telegram shells remain independent;
- feature pages load through router configuration rather than `main.tsx` conditionals.

---

# Stage F — Brand/design asset ownership

Goal: create one governed source for approved HOOMA visual assets before more screens consume them.

Target ownership:

```text
packages/ui/src/assets/
  brand/
  matchday/
  collector/
  fallbacks/
```

Rules:

- keep original approved masters where practical;
- runtime derivatives may be optimized, but do not duplicate identical binaries across apps;
- brand crest/wordmark usage comes through named components/tokens where appropriate;
- collector-ticket artwork is presentation infrastructure, never business state;
- Teams ordinary UI remains functional/dark; Challenge/Game presentation may use collectible treatment;
- Watch collector ticket and Team Challenge/Game artifacts may share heritage primitives without sharing domain logic;
- Pitch/Place surfaces remain photography-first rather than ticket-themed.

### Stage F gate

Shared assets have one canonical repository location and no byte-identical copies across Web/Telegram.

---

# Stage G — Replace pre-release migration history with one correct initial migration

Goal: make the database reproducible from zero before first release.

This is allowed because HOOMA ULTIMATE has not shipped.

Procedure:

1. finalize `schema.prisma` after Stages B–F source reconciliation;
2. remove the current pre-release migration directories;
3. create one new initial migration from the final current schema;
4. manually inspect generated SQL;
5. add intentional PostgreSQL constraints/indexes that Prisma cannot express directly;
6. apply to a brand-new disposable PostgreSQL database;
7. verify schema and generated client behavior;
8. run all current-domain integration tests;
9. only then apply the exact migration to the fresh Railway PostgreSQL database.

Required SQL review:

- foreign keys and delete actions;
- identity/session unique constraints;
- Community membership constraints;
- one ACTIVE Team per Community V1 rule;
- optional TeamPlayer user linkage without global uniqueness;
- active Team responsibility/capability uniqueness;
- Team lineup relationships;
- no self challenge;
- one pending unordered Team-pair challenge;
- one TeamGame per challenge;
- Event timestamp/capacity/fee constraints;
- formation coordinate ranges;
- relevant indexes for public discovery and authorization lookups.

No `prisma db push` is accepted as the release path.

### Stage G gate

A completely empty PostgreSQL database reaches the exact expected schema using `prisma migrate deploy` only.

---

# Stage H — Dependency and CI normalization

Goal: make repository installation and verification deterministic.

## H1. Lockfile

Generate the target repository's real `package-lock.json` from the actual final workspace manifests.

Commit package manifest and lockfile changes together.

## H2. CI

CI must be read-only with respect to repository content.

Remove:

- `contents: write`;
- lockfile regeneration;
- automated `git commit`/`git push`.

Required CI sequence:

```text
npm ci
npm run db:generate
npm run db:validate
npm run db:migrate:deploy
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

CI uses disposable PostgreSQL and Redis where relevant.

## H3. Architecture checker expansion

Enforce at minimum:

- no Prisma/database imports outside infrastructure/database package;
- no Express in domain/application;
- no frontend database imports;
- no scattered frontend fetch outside the canonical shared API client;
- no `latest` dependencies;
- no production preview/fake-auth bypass;
- no scoped `ADMIN` role;
- route-level lazy loading;
- no legacy product branding in active UI;
- no secret files committed.

### Stage H gate

One untouched checkout passes `npm ci` and the entire CI chain without modifying the repository.

---

# Stage I — Real behavioral verification

Goal: prove current domains end-to-end.

Required real-infrastructure scenarios:

## Identity/Auth

- Web register/login/logout/read-back;
- Telegram initData validation/resolution;
- invalid supplied Telegram identity fails closed;
- Web User A + Telegram User B => `AUTH_CONFLICT`;
- session expiry/revocation;
- Platform Admin bootstrap and protected route denial/allow.

## Communities/Teams

- create Community;
- Founder authority;
- Coach appointment/revocation;
- create V1 Team;
- reject second active Team for same Community;
- TeamPlayer without HOOMA account;
- linked TeamPlayer;
- same User may be linked to different Teams where valid;
- direct Coach authority;
- Community Founder/Coach fallback;
- Assistant with each individual capability;
- Assistant denied non-granted capabilities;
- lineup draft/current/publish rules;
- unpublished lineup absent from public API;
- self challenge rejected;
- duplicate pending reverse challenge rejected;
- concurrent accept/decline has one winner;
- accepted challenge creates exactly one TeamGame;
- message denied before acceptance;
- message allowed after acceptance only to authorized participating leaders.

## Events/Play

- create PLAY Event;
- WATCH create rejected;
- public list/detail;
- concurrent RSVP at capacity boundary;
- waitlist promotion;
- leave/cancel behavior;
- formation;
- check-in;
- temporary chat authorization/window;
- completion/cancellation.

### Stage I gate

All applicable tests pass against disposable real PostgreSQL; Redis-backed tests are added when Redis behavior exists.

---

# Stage J — Railway verification and normalization close

Goal: prove the exact normalized repository against the fresh deployment target.

1. verify production-required environment variable names exist;
2. require real production origins instead of localhost fallback;
3. apply the exact clean initial migration to the fresh Railway PostgreSQL database;
4. verify migration status;
5. bootstrap the intended Platform Admin operationally;
6. deploy the verified branch/service configuration;
7. run API health and focused smoke tests;
8. verify no donor/legacy database is connected;
9. update `docs/IMPLEMENTATION_STATUS.md` with exact evidence.

### Final normalization gate

Normalization is complete only when all are true:

- canonical schema and repositories agree;
- one clean initial migration recreates the database from zero;
- committed lockfile supports `npm ci`;
- CI is read-only and green;
- Web uses structured lazy routing;
- Telegram has its own structured shell/router;
- contracts are domain-split;
- current Identity/Admin/Community/Teams/Events behavior is end-to-end verified;
- Railway migration and smoke verification pass;
- implementation ledger is current;
- no new frozen domain was partially introduced.

Only then may the next product domain begin.

---

# After normalization

The next domain is selected from `structure.md` and `requirements.md` based on dependency order. It starts as a complete vertical slice with its own schema migration, contracts, authorization, backend, Web/Telegram surfaces where applicable, tests, worker/media integration where applicable, and documentation update.

The normalized foundation must not be reopened casually. Any later architectural change requires a new explicit decision and migration rather than another hidden foundation rewrite.
