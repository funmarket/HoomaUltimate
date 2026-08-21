# HOOMA ULTIMATE — STRUCTURE

Status: **Primary build roadmap and anti-drift structure**  
Repository: `funmarket/HoomaUltimate`  
Application type: **new third application / greenfield implementation**

---

## 0. Governing rule

HOOMA ULTIMATE is **not**:

- a migration of `funmarket/HOOMA`;
- an upgrade of the uploaded V3 archive;
- a branch of either donor application;
- a compatibility exercise whose goal is to preserve either donor's schema, file layout, migrations, technical debt, or historical mistakes.

HOOMA ULTIMATE is a **new application built from zero in a third clean repository**.

The two older codebases are read-only reference sources used to answer only these questions:

1. Which product behavior has already been designed or proven useful?
2. Which implementation patterns worked well?
3. Which mistakes, regressions, incomplete features, and architectural conflicts must never be repeated?

No donor repository is the base. No donor migration chain is the target migration chain. No donor schema is copied wholesale. No donor feature is considered complete in HOOMA ULTIMATE until it is newly implemented and verified here.

If an older document says to "preserve", "migrate", "upgrade", or "port" a donor database/migration chain, that instruction is superseded by this file unless the product owner explicitly changes this decision later.

---

## 1. Document authority and drift prevention

When implementation decisions conflict, use this order:

1. Latest explicit product-owner instruction in the active conversation.
2. This `structure.md`.
3. Root `requirements.md`.
4. `docs/DECISIONS.md`, after conflicting legacy decisions are corrected.
5. `docs/ARCHITECTURE.md`, `docs/AUTH.md`, `docs/AUTHORIZATION.md`, `docs/DATABASE.md`.
6. `docs/MERGE_AUDIT.md` as donor-comparison evidence only.
7. Source A (`funmarket/HOOMA`) as read-only behavioral reference.
8. Source B/V3 archive as read-only architectural/feature reference.
9. Older plans, comments, prompts, and stale notes.

### Mandatory anti-drift rule

Before starting any feature, the implementing agent must read:

- `structure.md`;
- `requirements.md`;
- the relevant domain document(s);
- the current `docs/IMPLEMENTATION_STATUS.md`;
- the current `docs/DECISIONS.md`.

After completing a verified slice, update `docs/IMPLEMENTATION_STATUS.md` and any affected decisions/docs before moving to the next slice.

---

## 2. Engineering rules that apply to every task

1. **Trace before editing.** Follow route, UI, state/query, API client, contract, controller, authorization, service, domain policy, repository, schema, async effects, tests, and deployment/runtime configuration.
2. **Fix at the source of truth.** Do not hide defects with downstream overrides or duplicated policy.
3. **No patching.** No arbitrary z-index escalation, duplicate endpoints, duplicate tables, hardcoded offsets, fake success responses, shadow state, or temporary second implementations left as permanent architecture.
4. **No guessing.** If source behavior is unclear, inspect the donor/reference or current target code before deciding.
5. **One owner per concept.** Every durable concept has one domain owner and one canonical persistence model.
6. **Authorization is server-side.** UI visibility is not security.
7. **Schema is not a feature.** A model/table alone never counts as implemented.
8. **Frontend is not a feature.** A page with mocks or dead buttons never counts as implemented.
9. **API is not a feature.** An endpoint without authorization, persistence, tests, and frontend use is incomplete.
10. **No real secrets in source.** Bot tokens, URLs, credentials, storage keys, database URLs, and admin bootstrap secrets are environment variables only.
11. **No destructive development shortcuts in production.** No `prisma db push` against production, no reset, no fake seed replacing business data.
12. **No donor technical debt inheritance by default.** Reuse behavior and ideas, not defects.
13. **No new permanent social-network mechanics.** HOOMA is activity/community utility, not an engagement-maximizing follower/feed product.
14. **No feature marked DONE without evidence.** Use the Definition of Done in `requirements.md`.

---

## 3. Target repository topology

The final repository must follow this topology:

```text
HoomaUltimate/
  apps/
    api/
    web/
    telegram/
    worker/

  packages/
    auth/
    config/
    contracts/
    database/
    domain/
    storage/
    testing/
    ui/

  docs/
  scripts/
  tests/
  .github/
  .env.example
  package.json
  package-lock.json
  tsconfig.base.json
  eslint.config.mjs
  structure.md
  requirements.md
  README.md
```

### App ownership

#### `apps/api`

Owns HTTP transport, request parsing, authentication middleware integration, authorization entry points, application services, domain orchestration, repository implementations, transactions, and durable write boundaries.

#### `apps/web`

Owns the normal browser application, classic login/register flows, browser routing, responsive web shell, and web-specific interaction behavior.

#### `apps/telegram`

Owns Telegram Mini App runtime behavior including initData, Telegram lifecycle, BackButton, viewport/safe-area integration, theme behavior, haptics where useful, Telegram-specific navigation, and Telegram-specific action surfaces.

#### `apps/worker`

Owns asynchronous execution only: outbox consumption, media transforms, delivery attempts, replay generation, cleanup jobs, and retry/dead-letter processing. It must not duplicate business policy from API domain services.

---

## 4. Shared package boundaries

### `packages/auth`

- Argon2id helpers;
- opaque session-token generation/hash helpers;
- Telegram initData validation primitives;
- auth-related common errors/types;
- no Express or UI dependencies.

### `packages/config`

- environment schemas;
- environment loading;
- service-specific configuration types;
- production preflight validation;
- no feature/business policy.

### `packages/contracts`

- request/response DTOs;
- Zod or equivalent validation schemas;
- public/member contract types;
- error-code contracts;
- no database models exposed directly.

### `packages/database`

- Prisma schema;
- Prisma client;
- migrations owned only by HOOMA ULTIMATE;
- seed/dev fixtures where safe;
- transaction helpers;
- generated Prisma types must remain strongly typed; never alias Prisma to `any`.

### `packages/domain`

- cross-domain value objects and policies that are genuinely shared;
- grapheme counting;
- slugs;
- timestamps/time windows;
- domain result/error helpers;
- no database or HTTP imports.

### `packages/storage`

- object-storage abstraction;
- S3-compatible implementation;
- upload/download/presign helpers;
- media-object metadata primitives;
- no feature authorization policy.

### `packages/testing`

- typed fixtures;
- test builders;
- disposable PostgreSQL/Redis helpers;
- shared test personas;
- no production fake-user bypass.

### `packages/ui`

- design tokens;
- reusable components;
- shared feature presentation where platform-neutral;
- icons/assets shared between Web and Telegram where appropriate;
- no API secrets, no direct database imports, no platform-specific shell ownership.

---

## 5. API module structure

Every substantial backend domain follows:

```text
apps/api/src/modules/<domain>/
  domain/
    entities.ts
    policies.ts
    errors.ts
    types.ts

  application/
    <domain>.service.ts
    <domain>.repository.ts
    commands/
    queries/

  infrastructure/
    prisma-<domain>.repository.ts
    external-*.ts

  http/
    <domain>.controller.ts
    <domain>.routes.ts
    schemas.ts
```

Small domains may omit empty folders, but they may not collapse database access, HTTP logic, authorization, and business policy into one large feature file.

### Hard dependency direction

```text
http -> application -> domain
infrastructure -> application/domain
bootstrap -> all implementations
```

Forbidden:

```text
domain -> Prisma
application -> Express
controller -> Prisma
frontend -> database package
worker -> HTTP controller
one domain -> another domain's Prisma repository directly
```

Cross-domain collaboration must happen through explicit application interfaces or orchestrators.

---

## 6. Domain map and ownership

The target API should be divided into these domains.

### Foundation domains

- `auth`
- `identity`
- `platform-admin`
- `audit`
- `media`
- `outbox`
- `discovery`

### Football/community domains

- `communities`
- `teams`
- `events`
- `play`
- `watch`
- `places`
- `pitch`
- `ultras`

### Additional activity domains

- `gamers`
- `requests`
- `rides`
- `fundraising`
- `payments`
- `whistle`
- `replay`

### Canonical ownership rules

| Concept | Canonical owner |
|---|---|
| Login identity/session | Auth/Identity |
| User display/profile | Identity/Profile |
| Global administrator authority | Platform Admin |
| App-wide sensitive action history | Audit |
| HOOMA local community | Communities |
| Football Team, roster, responsibilities | Teams |
| Team lineup | Teams |
| Team challenge + challenge conversation | Teams |
| Pickup/watch/community Event lifecycle | Events |
| Play-specific discovery/use cases | Play over Events |
| Physical venue | Places |
| Pitch capability/profile/application | Pitch over Place |
| Watch venue capability/application | Watch over Place |
| FanHub discovery classification | Places/Watch projection; never a role |
| ULTRAS community | ULTRAS |
| Gamer profile/squad/challenge | Gamers |
| Help/request + claims | Requests |
| Ride offer/request/match/location privacy | Rides |
| Fundraiser/contribution | Fundraising |
| Payment rails/intents/settlement | Payments |
| Transient 33-grapheme message | Whistle |
| Media metadata | Media |
| Media bytes | Object storage |
| Async work | Outbox + Worker |
| Post-event replay | Replay |
| Aggregated Home/Now data | Discovery read model only |

---

## 7. Database strategy for the new app

This is a **fresh database design**.

### Rules

- HOOMA ULTIMATE starts with its own clean Prisma schema.
- HOOMA ULTIMATE starts with its own initial migration.
- Source A migrations are reference evidence only and are not copied as the target migration history.
- Source B's zero-migration problem must not be repeated.
- The first committed schema must already reflect the target domain boundaries rather than historical donor compromises.
- Future migrations are forward-only once HOOMA ULTIMATE itself has shipped.
- If historical donor data is ever imported later, that is a separate explicit data-import project/script, not the application's migration architecture.

### Persistence ownership

- PostgreSQL = durable business truth.
- Redis/Valkey = disposable/transient state only.
- S3-compatible storage = media bytes.
- PostgreSQL MediaAsset = media metadata/status/ownership.

### First schema groups

The first schema should deliberately define, at minimum:

1. User / identity / credentials / sessions / presentation.
2. Platform roles and AuditLog.
3. Communities and memberships.
4. Teams, roster, responsibilities, Assistant capability grants, lineups, challenges, challenge messages, games.
5. Events, RSVP/waitlist, formations, check-in, temporary event chat metadata.
6. Canonical Place, suggestions, owner claims, ownership, capability profiles/applications.
7. ULTRAS, official football entities, memberships, join requests/invites, GameDays/attendance.
8. Gamers catalog, profiles, handles, squads, memberships, challenges, results/disputes.
9. Requests/claims.
10. Ride offers/requests/matches and privacy-safe tracking metadata.
11. Fundraisers/contributions.
12. Payments, provider attempts/events, cash settlement and Telegram Stars state.
13. Whistle metadata only.
14. MediaAsset.
15. OutboxEvent.
16. Replay.

Do not create speculative tables with no planned vertical slice.

---

## 8. Authentication architecture

There are two independent ways to enter the same product and database.

### Web identity

```text
username + password + display username + optional email
       -> WebCredential
       -> canonical User
       -> WebSession
```

Password algorithm: **Argon2id**.

Session:

- random opaque token;
- only token hash stored;
- secure HttpOnly cookie in production;
- explicit expiry and revocation;
- origin/CSRF protections on browser writes.

### Telegram identity

```text
Telegram Mini App initData
       -> cryptographic validation
       -> TelegramIdentity
       -> canonical User
```

Production Telegram runtime must fail startup if required bot configuration is absent.

### Conflict rule

If a request contains:

- valid Telegram identity -> User A; and
- valid Web session -> User B;

return `AUTH_CONFLICT`.

Never auto-merge users by username, email, photo, display name, Telegram handle, or similarity.

Account linking, if introduced later, must be an explicit authenticated workflow with its own decision record.

---

## 9. Public/member/admin API structure

### Public reads

```text
/api/public/v1/*
```

Public browsing must cover privacy-safe discovery for Home, Teams, Play, Watch, HOOMA communities, Pitch/Places, ULTRAS, Gamers, Requests where safe, Ride summaries, FundMe, public profiles, and Replay where public.

### Authenticated member actions

```text
/api/v1/*
```

Member routes own mutations and private/member-specific reads.

### Platform Admin

```text
/api/v1/admin/*
```

Only `PLATFORM_ADMIN` may access global moderation/approval/catalog/audit actions.

### Action-boundary login

Public pages do not redirect to login merely for browsing. A guest trying to perform a protected action goes to:

```text
/login?returnTo=<original-target>
```

Telegram uses its Telegram auth path rather than classic Web login unless explicitly needed.

---

## 10. Frontend structure

Web and Telegram must share the same product/domain API but are **not the same shell**.

### `apps/web/src`

```text
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

### `apps/telegram/src`

```text
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

### Shared UI rule

Put a component in `packages/ui` only when it is truly platform-neutral. Telegram lifecycle behavior stays in `apps/telegram`. Web authentication forms stay in `apps/web` unless presentation-only pieces are shared.

### Route loading

Pages should be route-level lazy loaded where practical. Large feature assets should have one canonical source rather than byte-identical copies in both apps.

---

## 11. Locked top-level product routing

The primary product routes must include:

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
/admin
```

Domain child routes are added as features are implemented.

### Permanent bottom navigation

Exactly:

```text
Home | Play | Watch | HOOMA | Pitch
```

`Places` must never replace `Pitch` in the permanent bottom navigation.

### Home gateway

Exactly:

```text
HOOMA | Teams | Ultras | Gamers
Places | Requests | Ride | FundMe
```

### Places tabs

Exactly:

```text
LOUNGES/CAFES | PITCH | FANHUB
```

`LOUNGES/CAFES` is the default Places tab.

---

## 12. Source donor policy

### Source A should be consulted primarily for

- mature Team flows;
- Team lineups;
- Team challenges/messages/games;
- Event creation/detail;
- formations;
- check-in;
- temporary Event chat;
- Pitch product behavior;
- Watch/FanHub behavior;
- Profile visual presentation;
- Telegram Mini App lifecycle behavior;
- Cash payment lifecycle;
- Telegram Stars runtime;
- test ideas;
- CI/release discipline;
- domain layering examples.

### Source B/V3 should be consulted primarily for

- four-app topology;
- classic Web authentication;
- TelegramIdentity/WebCredential separation;
- explicit public/member API boundary;
- Platform Admin direction;
- Coach/Assistant capability model;
- Home eight-card gateway;
- canonical Place direction;
- ULTRAS domain foundation;
- Gamers domain foundation;
- Whistle transient engine;
- Redis usage;
- Outbox Worker direction;
- media/object-storage architecture;
- Replay/discovery foundations.

### Donor code usage rule

Before reusing any donor implementation:

1. inspect the complete vertical slice;
2. identify donor bugs/incomplete behavior;
3. compare it with root `requirements.md`;
4. redesign interfaces to fit HOOMA ULTIMATE ownership boundaries;
5. implement in the new repository;
6. write target tests against target behavior;
7. never claim "ported" as equivalent to "verified".

---

## 13. Build roadmap

This roadmap is sequential by dependency. Do not jump ahead merely because a donor feature looks easy to copy.

### Phase 0 — Greenfield foundation

Deliver:

- root workspace `package.json` + lockfile;
- TypeScript base config;
- ESLint + Prettier;
- app/package directories;
- `.env.example`;
- config package;
- contracts package;
- database package;
- test runner;
- architecture check;
- CI skeleton;
- API `/health`;
- empty Web and Telegram shells;
- Worker health/startup skeleton.

Gate: clean `npm ci`, lint, typecheck, test, build all pass.

### Phase 1 — Database + identity/auth

Deliver:

- fresh target Prisma schema foundation;
- initial HOOMA ULTIMATE migration;
- canonical User;
- WebCredential/WebSession;
- TelegramIdentity;
- UserPresentation/Profile foundation;
- Argon2id registration/login/logout/session revocation;
- Telegram initData validation;
- `AUTH_CONFLICT`;
- public/member router split;
- guest `returnTo` behavior.

Gate: real PostgreSQL auth integration tests + Web/Telegram smoke tests.

### Phase 2 — Authority + Platform Admin + audit

Deliver:

- `PLATFORM_ADMIN`;
- bootstrap procedure using env secret/tooling rather than hardcoded user;
- `/admin` shell;
- `/api/v1/admin/*`;
- AuditLog;
- global moderation primitives;
- scoped role vocabulary with no ambiguous Admin usage.

Gate: authorization matrix tests prove App Admin and scoped managers cannot be confused.

### Phase 3 — Profile + Home + HOOMA communities

Deliver:

- mature Profile presentation;
- identities/responsibilities read model;
- My Teams/My ULTRAS/My Gamer Squads/My Places sections;
- Home exact 8-card gateway;
- HOOMA community public/member pages;
- shared creation entry on HOOMA page that lets user choose `TEAM` or `ULTRAS` and branches to the proper domain flow.

### Phase 4 — Teams

Deliver full Team vertical:

- discovery/detail;
- creation/edit;
- roster;
- add/remove/deactivate player;
- Coach Control Room;
- Assistant assignment/revocation;
- capability grants;
- lineups;
- challenges;
- challenge messages;
- challenge responses/cancel;
- no self-challenge;
- Team games;
- profile navigation from roster and Profile.

Gate: Coach/Assistant/player authorization matrix and lifecycle integration tests.

### Phase 5 — Events / Play

Deliver:

- event creation/detail;
- RSVP/capacity/waitlist;
- formations;
- check-in;
- temporary event chat;
- completion;
- Play discovery;
- correct public/private boundaries.

### Phase 6 — Canonical Places + Watch + Pitch

Deliver canonical Place first, then capabilities:

- Place directory;
- Lounges/Cafes default tab;
- suggestion flow;
- owner claim/evidence/review;
- ownership;
- Watch application/profile/review;
- Pitch application/profile/review;
- standalone `/pitch` product;
- Places Pitch tab using the exact same backend/data;
- FanHub projection;
- App Admin approval queues.

Gate: no duplicate physical Place model across Watch/Pitch/FanHub.

### Phase 7 — Requests + Ride + FundMe + payments

Deliver:

- request claims with concurrency safety;
- Ride offer/request/match lifecycle;
- privacy-safe Ride public projections;
- optional live tracking OFF by default;
- FundMe campaigns/contributions;
- Cash payment flow;
- Telegram Stars invoice/pre-checkout/success/refund/idempotency/entitlements;
- payment audit/reconciliation.

### Phase 8 — ULTRAS

Deliver:

- canonical official FootballEntity catalog;
- ULTRAS creation linked to an official club/national team;
- public ULTRAS discovery/detail;
- private member HQ;
- memberships;
- join requests/invites;
- Leader/Moderator/member permissions;
- GameDays/attendance;
- shared Ride/FundMe/Replay/Whistle integrations.

Gate: random public visitor cannot access private HQ/Whistle content.

### Phase 9 — Gamers

Deliver:

- App Admin-controlled game catalog;
- Gamer profile and handles;
- squads;
- memberships;
- squad management;
- challenges;
- results;
- disputes/moderation;
- Gamer identity/responsibilities in Profile.

### Phase 10 — Whistle

Deliver one shared engine only:

- 33 grapheme clusters max;
- 11 total/day/user across all contexts;
- Redis body only;
- PostgreSQL metadata only;
- 24-hour unread TTL;
- 60-second TTL after first authorized reveal;
- context authorization;
- Telegram notification delivery without body persistence;
- cleanup/expiry behavior;
- Team/Event/Ride/ULTRAS/Gamer Squad and other approved contexts.

Gate: real Redis/PostgreSQL concurrency + TTL + privacy tests.

### Phase 11 — Media + Worker + Replay + HOOMA NOW

Deliver:

- S3-compatible object storage;
- MediaAsset metadata;
- upload pipeline;
- EXIF/GPS stripping;
- thumb/card/master variants;
- transactional OutboxEvent;
- worker retries/backoff/dead-letter visibility;
- Replay creation after eligible completed events;
- deterministic HOOMA NOW/discovery read model.

### Phase 12 — Preview, design completion, release gates

Deliver:

- `npm run dev:preview` with MSW and typed fixtures;
- personas: Guest, Player, Coach, Assistant, ULTRAS Leader, Gamer Squad Leader, Place Owner, Platform Admin;
- production build refuses Preview Mode;
- final Web and Telegram responsive/Telegram QA;
- accessibility and performance pass;
- deployment configs;
- security review;
- clean DB migration test;
- full CI/preflight verification.

---

## 14. Status discipline

`docs/IMPLEMENTATION_STATUS.md` is the execution ledger.

Allowed statuses:

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

A donor implementation does not change the target status.

When a phase begins, mark only the actually active rows `IN_PROGRESS`. When a slice is verified, record concrete paths, tests, and command evidence before marking `DONE`.

---

## 15. Required command gates

As soon as the relevant scripts exist, the normal repository verification sequence is:

```text
npm ci
npm run db:generate
npm run db:validate
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run deploy:preflight
```

Database/Redis-sensitive features must additionally run real disposable PostgreSQL and Redis integration tests.

The final release must verify:

- API production build/start;
- Web production build;
- Telegram production build;
- Worker production build/start;
- fresh database migration from zero;
- production environment preflight;
- prohibited-file/archive checks;
- no Preview Mode in production;
- no secrets committed.

---

## 16. First implementation task after this planning baseline

Do **not** start by copying a donor application.

Start with **Phase 0 — Greenfield foundation** and build the empty target workspace professionally. The first code commit should establish the repository architecture and quality gates without importing business-feature code wholesale.

Only after Phase 0 passes should Phase 1 create the fresh HOOMA ULTIMATE schema and authentication foundation.
