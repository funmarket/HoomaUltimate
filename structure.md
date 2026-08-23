# HOOMA — STRUCTURE

Status: **Primary architecture contract**  
Repository/workspace: `funmarket/HoomaUltimate`  
Product name: **HOOMA**

`HoomaUltimate` is only the repository/workspace name used to distinguish this clean rebuild from older HOOMA repositories. It must not become application branding, UI copy, API branding, or product terminology.

---

## 0. Purpose

This file defines the architecture HOOMA should preserve as it grows.

It is **not**:

- a feature-status ledger;
- a phase/freeze plan;
- an implementation queue;
- a reason to block a product-owner-approved feature;
- a compatibility contract with an older HOOMA codebase.

The old/live HOOMA repositories and uploaded historical implementations are read-only donors. They may be inspected for proven behavior, useful visual ideas, and lessons learned, but they never become runtime dependencies, schema authority, migration history, authentication authority, or an excuse to copy old technical debt.

---

## 1. Governing sources and drift prevention

Every implementation must first follow root `AGENTS.md` and `docs/LIVING_BUILD_PLAN.md` for working discipline.

When product/architecture sources conflict, use the order defined in `AGENTS.md`:

1. latest explicit product-owner instruction;
2. `requirements.md` for locked product behavior;
3. this `structure.md` for architecture;
4. `docs/DECISIONS.md` for architectural decisions;
5. `docs/CANONICAL_MODEL.md` for current canonical data/authority contracts;
6. current source/database/runtime as evidence of current state, never as permission to override a newer target rule.

The retired files `docs/NORMALIZATION_PLAN.md` and `docs/IMPLEMENTATION_STATUS.md` are not governance sources and must not be recreated unless the product owner explicitly requests them.

Before creating a new model, route, service, package, store, component, or migration, search the repository for the existing owner of the concept. One concept must not gain a second source of truth merely because a new feature needs it.

---

## 2. Repository topology

The maintained workspace topology is:

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
    frontend/
    storage/
    testing/
    ui/

  docs/
  scripts/
  tests/
  .github/
  .env.example
  AGENTS.md
  structure.md
  requirements.md
  package.json
  package-lock.json
```

Do not add a new top-level app/package for a feature simply to avoid working through an existing domain boundary.

---

## 3. Runtime ownership

### `apps/api`

Owns:

- HTTP transport and request parsing;
- authentication middleware integration;
- authorization entry points;
- application-service orchestration;
- repository implementations;
- database transactions/locking boundaries;
- public/member/Admin namespaces;
- runtime integration with PostgreSQL, Redis and other infrastructure through explicit adapters.

Business policy belongs in application/domain layers, not directly in HTTP handlers.

### `apps/web`

Owns the canonical HOOMA React application entry, browser routing, classic Web authentication screens, shared application shell, responsive presentation, and initialization of runtime-specific behavior.

The current application intentionally uses this one HOOMA frontend tree for both normal Web and Telegram delivery. Do not recreate the removed donor-style second Telegram frontend tree unless a newer explicit architecture decision requires it.

### `apps/telegram`

Currently acts as the Telegram deployment/runtime facade for the shared HOOMA frontend. Its scripts build and serve the same production frontend built by `apps/web` / `@hooma/frontend`.

Telegram-specific behavior still remains mandatory and is initialized by the shared application through the Telegram runtime layer, including validated initData authentication, viewport/safe-area behavior, BackButton/lifecycle integration and Telegram-native interactions where useful.

Sharing the application tree does **not** mean ignoring Telegram platform behavior.

### `apps/worker`

Owns asynchronous execution only:

- transactional-outbox consumption;
- retries/idempotent delivery;
- cleanup jobs;
- media processing when Media is implemented;
- Telegram notification delivery when configured;
- Replay/background generation when implemented.

Worker must not duplicate API business authorization or become a second business-policy service.

---

## 4. Shared package ownership

### `packages/auth`

Authentication primitives shared by runtimes:

- Argon2id helpers;
- opaque session-token generation/hashing;
- Telegram initData validation primitives;
- auth errors/types.

No Express, Prisma, or UI ownership.

### `packages/config`

- environment schemas/loaders;
- service configuration;
- production preflight validation.

No feature/business policy.

### `packages/contracts`

- request/response DTOs;
- Zod schemas;
- public/member/Admin wire contracts;
- shared error contracts.

Contracts are split by domain as they grow. Prisma model types must not leak through the API boundary.

### `packages/database`

- Prisma schema/client;
- HOOMA-owned migrations;
- transaction/database helpers;
- safe development fixtures where appropriate.

Generated Prisma types remain strongly typed; do not replace transaction/client types with `any`.

### `packages/domain`

Only genuinely shared domain/value primitives that do not belong to one product domain, for example common result/error helpers, time/grapheme primitives, or slugs.

No HTTP or database dependencies.

### `packages/frontend`

Owns product/domain feature UI and frontend API integration that is genuinely shared by HOOMA's Web and Telegram delivery surfaces.

Current examples include Communities/HOOMA, Teams, Play/Events and Whistle feature presentation.

It must not contain secrets or import Prisma/database infrastructure.

### `packages/storage`

Object-storage abstraction and S3-compatible adapters when media storage is used.

No feature authorization policy.

### `packages/testing`

Typed fixtures/builders and disposable infrastructure helpers used by real tests. It must never introduce a production fake-user/auth bypass.

### `packages/ui`

Platform-neutral design tokens, common presentation components and governed shared brand/assets.

Do not move feature business state or platform runtime ownership into `packages/ui`.

---

## 5. Backend module structure and dependency direction

Substantial API domains follow this shape where applicable:

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
    redis-*.ts
    external-*.ts

  http/
    <domain>.routes.ts
    schemas.ts
```

Small domains may omit empty folders, but they may not collapse transport, authorization, business policy, persistence and infrastructure into one uncontrolled file.

Dependency direction:

```text
http -> application -> domain
infrastructure -> application/domain ports
bootstrap/container -> concrete implementations
```

Forbidden dependencies include:

```text
domain -> Prisma
application -> Express
HTTP route/controller -> direct Prisma business logic
frontend -> database package
worker -> HTTP controller
one domain -> another domain's Prisma repository directly
```

Cross-domain collaboration must use explicit application interfaces, policies or orchestrators.

---

## 6. Canonical domain ownership

| Concept | Canonical owner |
|---|---|
| Login identity/session | Identity/Auth |
| User presentation/profile | Identity |
| Global App Admin authority | Platform Admin |
| Sensitive-operation history | Audit |
| HOOMA neighborhood community + membership | Communities |
| Football Team, roster, responsibilities/capabilities | Teams |
| Team lineup | Teams |
| Team challenge, accepted-match coordination, TeamGame | Teams |
| Event lifecycle, RSVP/waitlist, formation, check-in | Events |
| Play discovery/use case | Play over Events |
| Shared transient Whistle engine | Whistle |
| Physical venue | Places |
| Pitch capability/application | Pitch over Place |
| Watch venue capability/application | Watch over Place |
| FanHub discovery classification | Places/Watch projection, never a role |
| ULTRAS supporter community | ULTRAS |
| Gamer profile/squad/challenge | Gamers |
| Help/request + claims | Requests |
| Ride coordination/location privacy | Rides |
| Fundraiser/contribution | Fundraising |
| Payment rails/intents/settlement | Payments |
| Media metadata | Media |
| Media bytes | Object storage |
| Async work | Outbox + Worker |
| Post-activity Replay | Replay |
| Aggregated Home/Now views | Discovery/read models only |

A new feature may project another domain's canonical data; it must not clone that data into a new physical entity merely for convenience.

---

## 7. Persistence architecture

Persistence ownership is fixed by semantics:

- **PostgreSQL** = durable business truth and durable metadata;
- **Redis/Valkey** = disposable/transient state only where explicitly designed;
- **S3-compatible object storage** = media bytes when Media is implemented.

Rules:

- Prisma schema, migration SQL, repositories and service assumptions must agree.
- Every durable schema change uses a committed migration; no production `prisma db push` shortcut.
- Database constraints/indexes enforce important invariants where appropriate; UI checks are not concurrency control.
- Do not add speculative tables for unassigned future features.
- Before first public release, migration-history consolidation may occur only as an explicit, reviewed database task proven against a clean disposable database. It is not a standing requirement that blocks ordinary feature work.
- After release, shipped migration history is forward-only.

### Whistle persistence boundary

Whistle is a deliberate hybrid:

- PostgreSQL stores metadata/quota/context/expiry truth only;
- Redis stores transient body and viewer-specific reveal state;
- Whistle body must never fall back to PostgreSQL, audit metadata, outbox payloads, notifications, analytics, URLs or logs.

---

## 8. Identity and authentication architecture

HOOMA has one canonical `User`.

Two independent authentication transports resolve to it.

### Web

```text
login username + password
-> WebCredential
-> User
-> WebSession
```

- Argon2id passwords;
- opaque random session token;
- only the session-token hash persists;
- secure HttpOnly cookie in production;
- explicit expiry/revocation;
- browser state-changing requests use origin/CSRF protection.

### Telegram

```text
Telegram Mini App initData
-> cryptographic validation
-> TelegramIdentity
-> User
```

Bot identity/configuration stays in environment variables so the Telegram bot can be replaced without source rewrites.

### Conflict rule

If valid Web and Telegram credentials in one request resolve to different Users, return:

```text
AUTH_CONFLICT
```

Never guess, silently merge, or choose one identity.

---

## 9. Authorization and API boundaries

Public privacy-safe reads:

```text
/api/public/v1/*
```

Authenticated/private member actions:

```text
/api/v1/*
```

Global Platform Admin actions:

```text
/api/v1/admin/*
```

Rules:

- public discovery does not force login;
- authentication happens at protected action/private-data boundaries;
- authorization is enforced server-side;
- UI hiding is never security;
- `PLATFORM_ADMIN` is global only;
- scoped domains use their own terminology and capabilities rather than generic `ADMIN`.

---

## 10. Frontend architecture

Current HOOMA frontend ownership is:

```text
apps/web/src/
  app/router/
  app/shell/
  account/
  auth/
  profile/
  settings/
  telegram/
  ...platform/application presentation

packages/frontend/src/
  communities/
  teams/
  events/
  whistle/
  ...shared feature UI/API integration

packages/ui/
  platform-neutral components/tokens/assets

apps/telegram/
  deployment/runtime facade serving the shared HOOMA frontend build
```

The shared router initializes Telegram runtime information when available and uses the same business feature components with the correct authentication transport.

Rules:

- one permanent navigation model;
- real React Router configuration, not `window.location.pathname` hand-routing;
- route-level lazy loading where useful;
- one shared frontend API transport contract;
- Web session cookies and Telegram `tma <initData>` auth remain distinct transports;
- Telegram safe-area/lifecycle/navigation behavior remains explicitly supported;
- no second duplicate feature tree merely because Telegram is a separate deployment service.

---

## 11. Locked navigation and routing

Permanent bottom navigation is exactly:

```text
Home | Play | Watch | HOOMA | Pitch
```

Home gateway:

```text
HOOMA | Teams | ULTRAS | Gamers
Places | Requests | Ride | FundMe
```

HOOMA community creation gateway:

```text
HOOMA | TEAM | ULTRAS | GAMERS
```

This chooser is a product gateway, **not** a generic database `CommunityType`. Each option enters its own domain-specific creation flow.

Places tabs:

```text
LOUNGES/CAFES | PITCH | FANHUB
```

Default is `LOUNGES/CAFES`.

Core route contracts include:

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

A route may truthfully present an unavailable/coming-soon state until its vertical slice is implemented; it must not fake backend completion.

---

## 12. Configuration and deployment

Replaceable configuration belongs in environment variables, never source.

At minimum this includes database/Redis/storage credentials, Web/API origins and Telegram bot/mini-app configuration.

Current Railway architecture contains separate deployable services for API, Web, Telegram, PostgreSQL and private Redis; Worker is deployed/activated according to its actual implementation needs.

Production claims require evidence from the exact deployed commit. A successful build alone does not prove a complete user flow.

---

## 13. Verification architecture

Repository verification is read-only. CI must detect drift, not repair or commit it.

The available full verification chain is:

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

Migration-specific work additionally proves `db:migrate:deploy` against the correct disposable/intended database.

Not every documentation/UI-only task needs every command, but every task must run the strongest applicable checks and report exactly what was and was not verified according to `AGENTS.md` and `docs/LIVING_BUILD_PLAN.md`.

---

## 14. Safe architecture evolution

When adding or changing a feature:

1. Identify the canonical owning domain.
2. Search for existing models/contracts/services/routes/UI before creating anything.
3. Trace all applicable consumers and persistence boundaries.
4. Define the smallest complete vertical slice.
5. Extend existing architecture instead of creating a parallel implementation.
6. Update `requirements.md` only when product behavior changes.
7. Update `docs/DECISIONS.md` when an architectural decision changes.
8. Update `docs/CANONICAL_MODEL.md` when canonical data/authority changes.
9. Verify with real infrastructure where concurrency, persistence, TTL or deployment semantics matter.
10. Report proof, exact changed files, current commit, remaining risk and an evidence-based score.

There is no permanent global feature order in this file. The product owner chooses the next feature; architecture and real dependencies determine the safe implementation sequence for that feature.
