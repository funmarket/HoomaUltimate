# HOOMA ULTIMATE — Architecture

Status: **Target architecture**

## 1. Architectural goal

HOOMA ULTIMATE must feel like one product, not two repositories glued together. It has one domain model, one API, one PostgreSQL source of durable truth, one authorization architecture, one contract strategy, one migration chain, and two platform-specific frontend surfaces.

## 2. Monorepo topology

```text
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
.github/workflows/
```

Responsibilities:

- `apps/api`: HTTP boundary, authorization orchestration, application services, persistence adapters.
- `apps/web`: browser shell and classic Web authentication UX.
- `apps/telegram`: Telegram Mini App shell with Telegram lifecycle/navigation integration.
- `apps/worker`: asynchronous outbox processing, notification delivery, media processing and Replay tasks.
- `packages/auth`: shared authentication primitives; never product-domain authorization.
- `packages/config`: centralized Zod environment/config validation.
- `packages/contracts`: transport schemas/types and stable API contracts.
- `packages/database`: Prisma schema/client/migrations and database-only utilities.
- `packages/domain`: truly cross-domain primitives only; do not move feature business logic here merely for reuse.
- `packages/storage`: S3-compatible object-storage adapters and upload primitives.
- `packages/testing`: factories, fixtures, test harnesses and disposable infrastructure helpers.
- `packages/ui`: design tokens and reusable presentation components that are platform-neutral.

## 3. API module structure

Every substantial API domain uses Source A's stronger layering:

```text
apps/api/src/modules/<domain>/
  domain/
  application/
  infrastructure/
  http/
```

Example:

```text
modules/teams/
  domain/
    team.ts
    team-policy.ts
    team-capability.ts
  application/
    team.service.ts
    team.repository.ts
    team-query.service.ts
  infrastructure/
    prisma-team.repository.ts
  http/
    team.controller.ts
    team.routes.ts
```

Rules:

- controllers do not issue Prisma queries;
- domain code does not import Express, Prisma, or unrelated repositories;
- application services do not know Express;
- infrastructure implements application ports;
- frontend code never imports Prisma/database code;
- Worker handlers invoke application/domain services instead of duplicating rules;
- cross-domain calls use explicit application ports/services rather than repository reach-through.

## 4. Runtime/data ownership

### PostgreSQL

Owns durable business truth:

- users/auth identity metadata/sessions;
- profiles and responsibilities;
- communities, Teams, Events, Places;
- Requests, Ride, FundMe;
- payments and entitlements;
- ULTRAS, Gamers;
- Whistle metadata only;
- media metadata;
- Replay metadata;
- AuditLog, IdempotencyRecord, OutboxEvent, AdminNotification.

### Redis / Valkey

Owns deliberately transient state only:

- Whistle message bodies;
- Whistle quota counters/coordination;
- rate-limit counters;
- short caches;
- transient locks/dedupe where justified.

Redis loss must not erase durable business truth.

### Object storage

Owns media bytes. PostgreSQL stores metadata/references, not large image blobs.

## 5. One product, two frontend shells

`apps/web` and `apps/telegram` share:

- API and contracts;
- domain-aware feature components where platform-neutral;
- design tokens;
- query/state conventions;
- validation and error presentation patterns.

They do not blindly share shell behavior.

### Web shell

Responsible for:

- browser routing/history;
- Web login/register/session UX;
- standard viewport behavior;
- public-to-authenticated action transitions with `returnTo`.

### Telegram shell

Must preserve/adapt mature Source A behavior:

- Telegram initialization;
- cryptographically verified `initData` transport;
- BackButton behavior;
- MainButton where useful;
- viewport lifecycle;
- safe areas;
- Telegram theme integration where appropriate;
- haptics where useful;
- Telegram-specific layout/navigation considerations.

It is not merely the Web app wrapped in `ready()` and `expand()`.

## 6. API namespaces

### Public

`/api/public/v1/*`

Privacy-safe discovery and detail reads. These routes must not require `/me` to succeed.

### Member

`/api/v1/*`

Authenticated actions and private reads.

### App Admin

`/api/v1/admin/*`

Requires `PLATFORM_ADMIN`. Sensitive writes create `AuditLog` within the same or reliably coupled transaction.

## 7. Authentication boundary

Exactly two entry systems:

- Telegram `initData -> TelegramIdentity -> User`;
- Web `login username + password -> WebCredential -> WebSession -> User`.

Identity resolution precedes domain authorization. Profile identity is never authority.

If both valid transports resolve different users, fail with `AUTH_CONFLICT`.

## 8. Authorization architecture

Authorization is scoped and server-side:

- global: `PLATFORM_ADMIN`;
- Community: FOUNDER / COACH / MEMBER;
- Team: COACH / ASSISTANT / PLAYER plus explicit Assistant capability grants;
- ULTRAS: LEADER / MODERATOR / MEMBER;
- Gamer Squad: LEADER / MEMBER;
- Place: CONTRIBUTOR / VERIFIED OWNER concepts implemented through records/policies rather than trusting client IDs.

Public identity labels such as PLAYER/FAN/GAMER are presentation/discovery signals, not permissions.

## 9. Canonical Place architecture

One physical `Place` is the source of truth. Capabilities extend it:

```text
Place
  +-- Lounge/Cafe profile/capability
  +-- PitchProfile
  +-- WatchVenueProfile
  +-- FanHub discovery metadata
  +-- PlaceOwnership
  +-- photos/location/contact
```

A venue may participate in multiple contexts without duplicate physical Place rows.

Pitch keeps `/pitch` as a dedicated product and also appears inside Places. Both surfaces read the same canonical backend/query model.

## 10. Transactional outbox

When durable mutation requires asynchronous work:

1. application service validates policy;
2. business mutation is written;
3. `OutboxEvent` is written in the same database transaction;
4. transaction commits;
5. Worker claims events using `FOR UPDATE SKIP LOCKED`;
6. Worker executes via application ports;
7. retries/backoff/attemptCount/lastError are recorded;
8. bounded failures become operationally visible/dead-lettered.

Worker handlers do not reimplement authorization or business policy.

## 11. Media architecture

```text
client
 -> authorized upload-intent API
 -> MediaAsset(PENDING)
 -> presigned object-storage upload
 -> client confirms
 -> OutboxEvent
 -> Worker
 -> validate + auto-orient + strip EXIF/GPS + resize/variants
 -> MediaAsset(READY)
```

Any image-processing runtime must be explicitly provisioned in deployment.

## 12. Replay architecture

A mature Event reaches `COMPLETED`, emits an outbox event, and the Worker creates/opens the corresponding Replay workflow. Replay never owns Event lifecycle truth.

## 13. Discovery / HOOMA NOW

Discovery is a read model only. It may aggregate Teams, Events, Watch, Pitch, Places, Ride, Requests, ULTRAS and other completed domains with deterministic ranking. It never becomes the source of truth for those domains.

## 14. Contract strategy

- Zod schemas define request/response validation at transport boundaries.
- Contracts are versioned by API namespace and semantics, not by leaking Prisma models.
- Public projections deliberately omit private fields.
- Member/admin projections are capability-specific.
- Errors use stable machine codes plus safe user messages.

## 15. Error/logging/observability

- structured application errors;
- request/correlation IDs;
- structured logs;
- no catch-and-ignore;
- secrets and transient Whistle bodies never logged;
- worker attempts and final failure state observable;
- AuditLog is domain/security evidence, not a replacement for operational logs.

## 16. CI architecture gates

Target order:

```text
npm ci
-> dependency/security checks
-> prisma generate
-> prisma validate
-> migration-chain verification
-> architecture/source-boundary checks
-> format check
-> lint
-> typecheck
-> unit tests
-> integration tests (real disposable PostgreSQL + Redis)
-> build API/Web/Telegram/Worker
-> deploy preflight
-> migration status/drift verification on disposable DB
-> artifact/source checks
```

The architecture check must inspect source/repository boundaries, not reject normal `node_modules` created by `npm ci`.

## 17. Preview Mode

`npm run dev:preview` uses a frontend-isolated mock layer such as MSW. It never changes real backend authentication/authorization. Production builds must refuse Preview Mode.

## 18. Architectural definition of done

A production feature is not DONE until the full path exists and is verified:

`migration -> repository -> application/domain service -> authorization -> contract -> HTTP -> frontend API/state -> UI -> persistence -> reload/read-back -> errors/validation -> tests -> build -> deploy/runtime configuration`.
