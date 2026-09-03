# HOOMA — STRUCTURE

Status: **Primary architecture contract**  
Repository/workspace: `funmarket/HoomaUltimate`  
Product name: **HOOMA**

`HoomaUltimate` is only the repository/workspace name. It must not become application branding, UI copy, API branding, or product terminology.

---

## 0. Purpose

This file defines the architecture HOOMA must preserve as it grows. It is not a feature-status ledger, implementation queue, compatibility contract with older HOOMA code, or permission to carry known structural debt into `main`.

Older/live HOOMA repositories are read-only donors. They may inform proven behavior and visuals, but never become runtime, schema, migration, authentication, or architecture authority.

---

## 1. Governing sources and living-document rule

Every implementation follows root `AGENTS.md` and `docs/LIVING_BUILD_PLAN.md` for working discipline.

When sources conflict, use the order in `AGENTS.md`:

1. latest explicit product-owner instruction;
2. `requirements.md` for product behavior;
3. this `structure.md` for architecture;
4. `docs/DECISIONS.md` for architectural decisions;
5. `docs/CANONICAL_MODEL.md` for canonical data/authority;
6. current source/database/runtime as evidence of current state.

Before creating a model, route, service, package, store, component, script, contract, migration, or API client, search for the existing owner of that concept.

Documentation is part of the source contract. Every completed task must update the affected authoritative documents in the same task. Open PR behavior must be described as in-flight, never as merged foundation truth.

---

## 2. Repository topology

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
  AGENTS.md
  structure.md
  requirements.md
  progress.md
  package.json
  package-lock.json
```

Do not add a new top-level app/package merely to avoid an existing domain boundary.

---

## 3. Runtime ownership

### `apps/api`

Owns HTTP transport, request parsing, auth integration, application-service orchestration, repository implementations, transaction/locking boundaries, API namespaces, and runtime infrastructure adapters.

Business policy belongs in application/domain layers, not directly in HTTP handlers.

### `apps/web`

Owns the canonical React application entry, browser routing, Web authentication screens, shared application shell, responsive presentation, and initialization of runtime-specific behavior.

### `apps/telegram`

Acts as the Telegram deployment/runtime facade for the shared HOOMA frontend. Telegram-specific auth, viewport, safe-area, lifecycle, BackButton, haptics, and native interactions remain explicit runtime responsibilities.

### `apps/worker`

Owns asynchronous execution only: outbox consumption, retries/idempotent delivery, cleanup, media processing when implemented, Telegram delivery when configured, and Replay/background work when implemented.

Worker must not become a second business-policy service.

---

## 4. Shared package ownership

### `packages/auth`

Authentication primitives only. No product authorization policy.

### `packages/config`

Environment/config validation and production preflight. No feature policy.

### `packages/contracts`

Wire schemas/types split by owning domain. `index.ts` may be a re-export surface; it must not become a hidden cross-domain implementation monolith. Prisma model types do not leak through API contracts.

### `packages/database`

Prisma schema/client, committed migrations, and database helpers.

### `packages/domain`

Only genuinely cross-domain value primitives. It is not a dumping ground for feature business logic.

### `packages/frontend`

Shared Web/Telegram product feature UI and domain API integration.

### `packages/storage`

Object-storage abstraction/adapters. No feature authorization.

### `packages/testing`

Typed fixtures/builders and disposable infrastructure helpers for real tests.

### `packages/ui`

Platform-neutral components, tokens, and governed shared assets. No feature business state.

---

## 5. Backend domain structure and dependency direction

Substantial API domains follow this shape where applicable:

```text
apps/api/src/modules/<domain>/
  domain/
  application/
  infrastructure/
  http/
```

Small domains may omit empty folders, but they may not collapse transport, authorization, business policy, persistence, and infrastructure into an uncontrolled catch-all.

Expected direction:

```text
http -> application -> domain
infrastructure -> application/domain ports
bootstrap/container -> concrete implementations
```

Forbidden direction includes:

```text
domain -> Prisma
application -> Express
HTTP -> direct Prisma business logic
frontend -> database package
worker -> HTTP controller
one domain -> another domain's Prisma repository
lower-level canonical domain -> higher-level product domain
```

Cross-domain collaboration uses explicit application interfaces or orchestrators.

### No monolithic authorities

HOOMA must not create or expand monolithic scripts, contract files, services, repositories, frontend clients/stores, controllers, or modules that own unrelated domains.

A module called `shared`, `common`, `management`, `platform`, or `utils` is not exempt from ownership rules. Shared code may contain only genuinely shared primitives, never hidden business ownership.

A script must be single-purpose and bounded. Do not create a giant migration/repair/normalization script that changes independent domains together.

When a file begins accumulating unrelated responsibilities, stop and split at the authoritative domain boundary before adding more behavior.

This rule exists for scalability and user experience as well as code cleanliness: unrelated products must not be forced to load, lock, validate, cache, query, or rerender together when the user is using one flow.

---

## 6. Canonical domain ownership

| Concept                                              | Canonical owner                             |
| ---------------------------------------------------- | ------------------------------------------- |
| Login identity/session                               | Identity/Auth                               |
| User presentation/profile                            | Identity                                    |
| Global App Admin authority                           | Platform Admin                              |
| Sensitive-operation history                          | Audit                                       |
| HOOMA neighborhood community + membership            | Communities                                 |
| Football Team, roster, responsibilities/capabilities | Teams                                       |
| Athletes sports community, membership, join requests | Athletes                                    |
| Team lineup                                          | Teams                                       |
| Team challenge + accepted TeamGame coordination      | Teams                                       |
| Event lifecycle, RSVP/waitlist, formation, check-in  | Events                                      |
| Play Open Matches, player listings, match visibility | Play over Events                            |
| Shared transient Whistle engine                      | Whistle                                     |
| Physical venue                                       | Places                                      |
| Place ownership/claim lifecycle                      | Places                                      |
| Pitch capability/application/pricing                 | Pitch over canonical Place                  |
| Watch activity/event use of venue                    | Watch/Events using canonical Place directly |
| FanHub discovery classification                      | Places/Watch projection, never a role       |
| ULTRAS supporter community                           | ULTRAS                                      |
| Gamer profile/squad/challenge                        | Gamers                                      |
| Help/request + claims                                | Requests                                    |
| Ride coordination/location privacy                   | Rides                                       |
| Fundraiser/contribution                              | Fundraising                                 |
| Payment rails/intents/settlement                     | Payments                                    |
| Domain-owned managed media metadata                  | Owning product domain until generic Media is explicitly authorized |
| Media bytes                                          | Object storage                              |
| Async work                                           | Outbox + Worker                             |
| Post-activity Replay                                 | Replay                                      |
| Aggregated Home/Now views                            | Discovery/read models only                  |

Physical `Place` is the venue source of truth. Pitch extends Place through Pitch-owned capability/application behavior. Watch references canonical Place; it does not require a duplicate Watch venue entity or a generic capability model merely for symmetry.

ADR-050 explicitly unfreezes durable Ride and Requests vertical slices. Rides owns ride offers, ride requests, participation, private meeting-point policy and Ride vehicle-photo metadata. Requests owns help/resource requests and quantity-based partial claims. Fundraising, Payments and generic Media remain separate owners and are not implemented merely because Ride or Requests begins.

ADR-052 authorizes Community-scoped RideRequest audience projection into HOOMA NOW without changing ownership. Ride owns the canonical request, audience scope and exact `RideRequestCommunityAudience` target rows. Community owns membership facts used for requester and viewer authorization. HOOMA NOW is presentation/composition only and must not create copied RideRequest payloads, a second lifecycle, a second status field, or a Community-owned Ride request table.

ADR-054 authorizes the Athletes foundation as its own HOOMA-connected domain inside the existing API/frontend/database architecture. Athletes owns `AthletesCommunity`, `AthletesMembership`, and `AthletesJoinRequest`; it reuses canonical `User` and must not extend or store lifecycle records in the Communities or Teams tables.

---

## 7. Persistence architecture

- **PostgreSQL** = durable business truth and durable metadata.
- **Redis/Valkey** = explicitly transient/disposable state.
- **S3-compatible object storage** = managed media bytes for domain-owned media flows such as Ride/Gamers and any future generic Media architecture.

Rules:

- Prisma schema, migration SQL, repository behavior, service assumptions, and contracts must agree.
- Every durable schema change uses a committed migration; no production `prisma db push` shortcut.
- Important invariants use database constraints/indexes/locking where appropriate.
- Tables remain single-purpose and owned by their domain semantics.
- Do not add speculative tables for unassigned future features.
- After release, shipped migration history is forward-only.

### Whistle persistence boundary

Whistle metadata/quota/context/expiry truth is durable where designed; Whistle body remains Redis-only and must never fall back to PostgreSQL, audit metadata, outbox payloads, notifications, analytics, URLs, or logs.

---

## 8. Identity and authentication

HOOMA has one canonical `User`.

```text
WebCredential/WebSession -> User
TelegramIdentity         -> User
```

If valid Web and Telegram credentials resolve to different Users, return `AUTH_CONFLICT`. Never guess, silently merge, or choose one identity.

Replaceable Telegram bot identity/configuration belongs in environment variables.

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

Authorization is server-side. UI hiding is never security. `PLATFORM_ADMIN` is global only; scoped domains use their own roles/capabilities.

---

## 10. Frontend architecture

Current HOOMA frontend ownership:

```text
apps/web/src/
  application shell/runtime-specific presentation

packages/frontend/src/
  domain feature UI and API integration

packages/ui/
  platform-neutral presentation/tokens/assets

apps/telegram/
  Telegram deployment/runtime facade for shared frontend
```

Rules:

- one permanent navigation model;
- one shared frontend transport contract;
- domain-owned API clients rather than one cross-product management client;
- Web cookies and Telegram initData remain distinct auth transports;
- Telegram safe-area/lifecycle/navigation remains explicitly supported;
- no duplicate feature tree merely because Telegram is separately deployed;
- domain state should load independently enough that one product flow does not make unrelated products block or rerender.

---

## 11. Current navigation and routing

Permanent bottom navigation:

```text
Home | Play | Watch | HOOMA | Athletes
```

`Athletes` owns the fifth permanent navigation slot and routes to `/athletes`. Pitch remains a real standalone product at `/pitch`; it was removed only from the permanent bottom navigation.

Current Home gateway is the shipped 3 x 2 source-backed layout:

```text
HOOMA | Teams | Pitch
Places | Ride | Requests
```

Current availability on `phase-0-foundation`:

- HOOMA -> `/hooma`
- Teams -> `/teams`
- Pitch -> `/pitch`
- Places -> `/places`
- Ride -> `/rides` Ride-owned gateway with current child routes `/rides/matchday`, `/rides/anywhere`, `/rides/request`, `/rides/requests/:requestId/edit`, `/rides/offers`, `/rides/offers/new`, `/rides/offers/:offerId`, `/rides/offers/:offerId/edit`, and `/rides/mine`
- Requests -> `/requests` honest frontend shell, with `/requests/fundme` tab and `/fundme` compatibility redirect

Gamers remains an independent implemented route family at `/gamers`, but it is no longer listed from the Home gateway. Athletes is an independent implemented route family at `/athletes` and is reached from permanent navigation. ULTRAS remains an independent future domain and is not routed from Home. FundMe is grouped under Requests as `/requests/fundme`; `/fundme` redirects there as a compatibility navigation route only.

This section records current application state. Product-owner changes update both the source and this contract in the same task.

HOOMA creation is Communities-owned and creates only canonical HOOMA neighborhood/local Communities. Teams and future supporter-community domains keep their own creation surfaces and select any required HOOMA context inside their own flows. The only current cross-flow continuation is the literal Team handoff from `/hooma/new?after=team-create` back to `/teams/new?communityId=<created-id>` after successful HOOMA creation.

Ride may grow only through its own domain-owned vertical slices under ADR-050. Requests may grow only through its own Requests-owned slices. Those authorizations do not change the current Home gateway, permanent navigation, FundMe tab grouping, Gamers independence, ULTRAS unavailability, or the rule that Fundraising and Payments require separate authorization.

The current HOOMA creation action is:

```text
Create a HOOMA Community -> /hooma/new
```

There is no HOOMA-owned Team or ULTRAS selector. ULTRAS is unavailable until its independent domain ships. Gamers remains independent and is not part of HOOMA creation.

Core routes include:

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
/requests/fundme
/rides
/fundme
/profile
/settings
/admin
```

A route may truthfully show coming-soon/unavailable state until its real vertical slice exists.

---

## 12. Configuration and deployment

Replaceable configuration belongs in environment variables, including database/Redis/storage credentials, origins, Telegram bot configuration, and Mini App configuration.

Production claims require evidence from the exact deployed commit. A successful build alone does not prove a complete user flow.

---

## 13. Verification architecture

Repository verification is read-only. CI detects drift; it must not repair or commit source.

Applicable verification includes:

```text
npm ci
npm run db:generate
npm run db:validate
npm run db:migrate:deploy   # migration work / disposable or intended DB
npm run architecture:check
changed-file formatting gate
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run deploy:preflight
npm run security:check
npm run db:migrate:status
```

A gate that did not run because an earlier gate failed is not evidence of success.

---

## 14. Safe architecture evolution

For every task:

1. Identify the canonical owning domain.
2. Search existing models/contracts/services/routes/repositories/UI/scripts/docs.
3. Trace all consumers and persistence boundaries.
4. Check open PRs and concurrent ownership before editing.
5. Define the smallest complete vertical slice.
6. Extend the existing authority instead of creating a parallel implementation.
7. Keep dependency direction one-way; use orchestration for cross-domain workflows.
8. Update `requirements.md` when product behavior changes.
9. Update this file when architecture/current topology changes.
10. Update `docs/DECISIONS.md` when an architectural decision changes.
11. Update `docs/CANONICAL_MODEL.md` when canonical data/authority changes.
12. Update current-state/history documentation when implementation state changes.
13. Verify with real infrastructure where concurrency, persistence, TTL, migrations, or deployment semantics matter.
14. Report exact changed files, documentation updates, proof, current commit, remaining risk, and evidence-based score.

No task is complete while affected governing documentation still describes the old source state.
