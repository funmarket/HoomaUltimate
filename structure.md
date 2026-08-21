# HOOMA ULTIMATE — STRUCTURE

Status: **Primary build roadmap and anti-drift structure**  
Repository: `funmarket/HoomaUltimate`  
Application type: **new third application / greenfield implementation**

---

## 0. Governing rule

HOOMA ULTIMATE is **not**:

- a migration of `funmarket/HOOMA`;
- an upgrade of any uploaded reference archive;
- a branch of any earlier application;
- a compatibility exercise whose goal is to preserve donor schema, files, migrations, technical debt, or historical mistakes.

HOOMA ULTIMATE is a **new application built from zero in a third clean repository**.

Older codebases and planning archives are read-only reference material used to understand proven product behavior, useful implementation patterns, and mistakes to avoid. They do not become runtime dependencies or migration history.

No reference repository is the base. No reference migration chain is the target migration chain. No reference schema is copied wholesale. No historical feature is considered complete in HOOMA ULTIMATE until it is implemented and verified here.

---

## 1. Document authority and drift prevention

When implementation decisions conflict, use this order:

1. Latest explicit product-owner instruction in the active conversation.
2. This root `structure.md`.
3. Root `requirements.md`.
4. `docs/CANONICAL_MODEL.md` for current implemented-domain data/authority truth.
5. `docs/DECISIONS.md`.
6. `docs/NORMALIZATION_PLAN.md` while foundation normalization is active.
7. `docs/ARCHITECTURE.md`, `docs/AUTH.md`, `docs/AUTHORIZATION.md`, `docs/DATABASE.md`.
8. `docs/IMPLEMENTATION_STATUS.md` as the live evidence ledger.
9. Historical/reference assessments and donor code as evidence only.
10. Older plans, prompts, comments and stale notes.

### Mandatory anti-drift rule

Before starting any implementation slice, read:

- `structure.md`;
- `requirements.md`;
- `docs/CANONICAL_MODEL.md` when the slice touches an already-modeled domain;
- `docs/DECISIONS.md`;
- `docs/IMPLEMENTATION_STATUS.md`;
- `docs/NORMALIZATION_PLAN.md` while it remains active;
- relevant domain specification(s).

After completing a verified slice, update `docs/IMPLEMENTATION_STATUS.md` and any affected canonical/decision documents before the next slice.

While `docs/NORMALIZATION_PLAN.md` is active, no frozen new product domain may begin.

---

## 2. Engineering rules that apply to every task

1. **Trace before editing.** Follow route, UI, state/query, API client, contract, controller, authorization, service, domain policy, repository, schema, async effects, tests and deployment/runtime configuration.
2. **Fix at the source of truth.** Do not hide defects with downstream overrides or duplicated policy.
3. **No patching.** No arbitrary z-index escalation, duplicate endpoints, duplicate tables, hardcoded offsets, fake success responses, shadow state, or temporary second implementations left as permanent architecture.
4. **No guessing.** If behavior is unclear, inspect the authoritative target docs and current source before deciding.
5. **One owner per concept.** Every durable concept has one domain owner and one canonical persistence model.
6. **Authorization is server-side.** UI visibility is not security.
7. **Schema is not a feature.** A model/table alone never counts as implemented.
8. **Frontend is not a feature.** A page with mocks or dead buttons never counts as implemented.
9. **API is not a feature.** An endpoint without authorization, persistence, tests and frontend use is incomplete.
10. **No real secrets in source.** Bot tokens, credentials, storage keys, database URLs and admin bootstrap secrets are environment variables only.
11. **No destructive production shortcuts.** No `prisma db push` against production, no reset, no fake seed replacing business data.
12. **No inherited technical debt by default.** Reuse proven behavior and ideas, not defects.
13. **No new permanent social-network mechanics.** HOOMA is activity/community utility, not an engagement-maximizing follower/feed product.
14. **No feature marked DONE without evidence.** Use the Definition of Done in `requirements.md`.
15. **One vocabulary per concept.** Schema, migration, repository, service, contracts, tests and UI projection use the same canonical names.
16. **CI verifies; CI does not repair.** Lockfiles/source are committed by implementation work, never generated and pushed by CI.

---

## 3. Target repository topology

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

Owns the normal browser application, classic login/register flows, browser routing, responsive Web shell, and Web-specific interaction behavior.

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
- Zod validation schemas;
- public/member contract types;
- error-code contracts;
- domain-split files;
- no database models exposed directly.

### `packages/database`

- Prisma schema;
- Prisma client;
- migrations owned only by HOOMA ULTIMATE;
- seed/dev fixtures where safe;
- transaction helpers;
- generated Prisma types remain strongly typed; never alias Prisma transaction/client types to `any`.

### `packages/domain`

- cross-domain value objects/policies that are genuinely shared;
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
- reusable platform-neutral components;
- governed shared brand/heritage assets;
- platform-neutral feature presentation where appropriate;
- no API secrets, direct database imports, or platform-specific shell ownership.

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

Small domains may omit empty folders, but they may not collapse database access, HTTP logic, authorization and business policy into one large feature file.

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

Cross-domain collaboration happens through explicit application interfaces/orchestrators.

---

## 6. Domain map and ownership

### Foundation domains

- auth
- identity
- platform-admin
- audit
- media
- outbox
- discovery

### Football/community domains

- communities
- teams
- events
- play
- watch
- places
- pitch
- ultras

### Additional activity domains

- gamers
- requests
- rides
- fundraising
- payments
- whistle
- replay

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
| Team challenge + accepted-match coordination | Teams |
| TeamGame | Teams |
| Event lifecycle | Events |
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

## 7. Database strategy

HOOMA ULTIMATE uses a fresh database design.

### Pre-release normalization rule

Before the first release, the current pre-release migration experiments may be replaced by one clean reviewed initial migration after `docs/CANONICAL_MODEL.md` and the source are reconciled.

After the first production release, migration history is forward-only.

### Persistence ownership

- PostgreSQL = durable business truth.
- Redis/Valkey = disposable/transient state only.
- S3-compatible storage = media bytes.
- PostgreSQL MediaAsset = media metadata/status/ownership when Media is implemented.

### Normalized initial migration scope

While normalization is active, the initial migration contains only current implemented/foundation domains:

1. User / presentation / credentials / sessions / Telegram identity.
2. Platform roles, AuditLog and Outbox foundation.
3. Communities and memberships.
4. Teams, roster, responsibilities, capability grants, lineups, challenges, challenge messages, games.
5. Events/Play, RSVP/waitlist, formations, check-in, temporary Event chat.

Frozen future domains do not receive speculative tables.

---

## 8. Authentication architecture

Two independent ways enter the same product/database.

### Web

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
- Secure HttpOnly cookie in production;
- explicit expiry/revocation;
- origin/CSRF protection on browser writes.

### Telegram

```text
Telegram Mini App initData
       -> cryptographic validation
       -> TelegramIdentity
       -> canonical User
```

Production Telegram runtime fails startup if required bot configuration is absent.

### Conflict rule

Valid Telegram -> User A plus valid Web session -> User B returns `AUTH_CONFLICT`.

No heuristic auto-linking.

---

## 9. API namespaces

### Public

```text
/api/public/v1/*
```

### Authenticated member

```text
/api/v1/*
```

### Platform Admin

```text
/api/v1/admin/*
```

Public pages do not force login merely for browsing. Protected Web actions use a validated internal `returnTo` target. Telegram follows Telegram authentication rather than classic Web login.

---

## 10. Frontend structure

Web and Telegram share product/domain APIs but are not the same shell.

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

Pages are route-level lazy loaded where practical. `main.tsx` bootstraps the app; it does not become the router/business layer.

`packages/ui` remains platform-neutral.

---

## 11. Locked top-level product routing

Core routes include:

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

### Permanent bottom navigation

Exactly:

```text
Home | Play | Watch | HOOMA | Pitch
```

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

Default: `LOUNGES/CAFES`.

---

## 12. Normalization phase

The active repair/build queue is `docs/NORMALIZATION_PLAN.md`.

During this phase:

- Identity/Auth, Platform Admin/Audit, Communities, Teams and Events/Play are reconciled and verified;
- Web/Telegram structure, contracts, migrations, lockfile and CI are normalized;
- approved shared brand assets are given canonical ownership;
- no new frozen product domain begins.

The next feature phase begins only after the normalization final gate passes and `docs/IMPLEMENTATION_STATUS.md` records the evidence.

---

## 13. Normal verification pipeline

The target verification sequence is:

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

Commands may be split internally but no successful step may be inferred without execution.

---

## 14. First work after this structure update

Do not add another product feature.

Follow `docs/NORMALIZATION_PLAN.md` from Stage B onward:

1. reconcile canonical Prisma schema;
2. reconcile repository/service/contracts against it;
3. normalize frontend structure/router;
4. normalize shared assets;
5. generate one clean pre-release initial migration;
6. generate/commit real lockfile;
7. make CI read-only;
8. prove the whole current system on disposable PostgreSQL;
9. verify the same migration against the fresh Railway PostgreSQL;
10. only then resume product-domain development.
