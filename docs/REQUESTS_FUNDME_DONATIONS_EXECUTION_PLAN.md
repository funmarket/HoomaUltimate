# HOOMA Requests | FundMe | Donations — Living Execution Plan

This file is the single repository execution record for the owner-approved **HOOMA Requests | FundMe | Donations Implementation Plan**. It does not replace, simplify, reorder, or reinterpret the approved product plan. Product requirements remain exactly those in the owner-provided plan source identified below; this file adds only verified live-state facts, task status, evidence, scores, blockers, risks, approved amendments, and the exact next task.

## Authoritative sources

- Repository: `funmarket/HoomaUltimate`
- Authoritative branch: `phase-0-foundation`
- Owner-approved implementation plan source SHA-256: `1974f842635bbb518424fed4e300368d92a0ddb28f1eefe95d74e48bf0e476c3`
- Owner-approved execution protocol source SHA-256: `02730bb3078c3c9a052ed3b8476c289974ffadf3868d1795123f12cf42310d98`
- Original planning baseline recorded by the approved plan: `c304fed4c925cbcd578fdbafb21926f927e400f5`
- Current refreshed `phase-0-foundation` HEAD: `b07167f9beb0003eceddb3fd73bfbff53417a618`
- Current command: `Slice 0 — Freshness Gate`
- Exact next task after this record is verified: `Task 1.1 — Shared Help contract primitives`
- Approved plan amendments: **none**

## Non-negotiable product boundary

The authoritative product plan remains:

```text
REQUESTS
“I need something.”

FUNDME
“I need financial support for something.”

DONATIONS
“I have something useful I want to give away.”
```

Requests remains a need/help domain, FundMe remains a fundraising domain, and Donations remains a free-item giving domain. Existing HOOMA Identity, Communities, Teams, Athletes Communities, Places/Pitch, Ride, Events, TeamChallenge, Whistle, Notifications, Discovery, Platform Admin, Audit, Redis, Outbox, Worker and ObjectStorage remain canonical and must not be duplicated.

The current Requests gateway target remains `Requests | FundMe | Donations`. No fake functionality is authorized. FundMe payments remain behind the explicit payment-provider decision gate.

## Task status ledger

| Slice | Plan task | Status |
| --- | --- | --- |
| 0 | Freshness gate | COMPLETE |
| 1 | Shared contracts + account publisher contexts | NOT_STARTED |
| 2 | Requests database/domain | NOT_STARTED |
| 3 | Requests responses + lifecycle | NOT_STARTED |
| 4 | Requests frontend | NOT_STARTED |
| 5 | Donations database/domain | NOT_STARTED |
| 6 | Donation frontend | NOT_STARTED |
| 7 | Donation media | NOT_STARTED |
| 8 | Request ↔ Donation matching | NOT_STARTED |
| 9 | Help content reports/admin | NOT_STARTED |
| 10 | FundMe core | NOT_STARTED |
| 11 | FundMe frontend + admin | NOT_STARTED |
| 12 | Payment-provider decision gate | NOT_STARTED |
| 13 | FundMe payments | BLOCKED |
| 14 | FundMe goal/result | NOT_STARTED |
| 15 | Notifications/Worker | NOT_STARTED |
| 16 | HOOMA NOW | NOT_STARTED |
| 17 | Final Help UI polish | NOT_STARTED |

`Slice 13` is deliberately `BLOCKED` until Slice 12 produces an explicitly approved provider decision. No provider has been selected by this execution record.

## Slice 1 task breakdown

The approved Slice 1 scope remains limited to shared contracts and account publisher context; no Help tables are authorized in Slice 1.

| Task | Scope | Status |
| --- | --- | --- |
| 1.1 | Shared Help contract primitives: `HelpAudienceScope`, `HelpCategory`, shared item taxonomy, genuinely shared Help primitives only | NOT_STARTED |
| 1.2 | Extend `meResponse` with `athletesCommunities` contract | NOT_STARTED |
| 1.3 | Identity repository/query readback for Athletes community membership | NOT_STARTED |
| 1.4 | Focused contract/identity tests and Slice 1 regression verification | NOT_STARTED |

## Verified starting state — 2026-09-16

### Repository freshness

- `phase-0-foundation` is verified at `b07167f9beb0003eceddb3fd73bfbff53417a618`.
- The approved plan was written against `c304fed4c925cbcd578fdbafb21926f927e400f5`.
- The refreshed branch is two commits ahead of the original planning baseline and not behind it.
- The baseline change arrived through PR `#315`, `feat: add platform admin user security`.
- Open pull requests targeting `phase-0-foundation` at the final Slice 0 freshness read: **none**.
- PR #315 touched Admin/Identity/contracts/DI/Prisma areas used by later Help slices, but it did not implement Requests, FundMe, Donations, or a competing Help backend.

### Railway runtime / database

Railway project: `HoomaUltimate`, production environment `e00f159a-f2e7-4db7-a377-56e7c1c4f23d`.

Successful active deployments inspected for the refreshed SHA `b07167f9beb0003eceddb3fd73bfbff53417a618`:

- Worker deployment: `f0ddb42e-e93b-46f1-8585-1144d57746a6`
- Telegram deployment: `5d532a58-12e4-4a5d-a25f-402e048d036a`
- API deployment: `83e0ce02-5922-4b33-8e4f-80c680db021f`
- Web deployment: `3a1f9759-d160-4055-a69d-de1adf5280f0`

API deployment evidence on the exact refreshed SHA:

- Prisma detected `47 migrations`.
- Migration `20260916142000_app_manager_users_capability` was applied.
- Railway logged `All migrations have been successfully applied.`
- API started on port 3000.
- `/health/ready` healthcheck succeeded.
- The Railway build generated Prisma Client `v6.19.3` and successfully built packages and the API.

No Railway, database, environment, storage or deployment mutation was performed by Slice 0.

### Existing Requests frontend and routing

Current frontend owner remains:

```text
packages/frontend/src/requests/
├── RequestsPage.tsx
└── requests.css
```

Current page state remains an honest shell:

- tabs: `Requests | FundMe`
- no Request loading/creation/response persistence
- no FundMe persistence or money collection
- no Donations tab or Donation claims

Current routes remain:

```text
/requests
/requests/fundme
/fundme → /requests/fundme
```

The web router already uses the existing `AccountProvider` and `authenticationHref(returnTo)` behavior that later Help routes must reuse.

### Contracts and `/me`

No Help-domain contract files exist yet:

```text
packages/contracts/src/help.ts
packages/contracts/src/requests.ts
packages/contracts/src/donations.ts
packages/contracts/src/fundraising.ts
```

Current `meResponseSchema` exposes Community and Team publisher context but **does not expose Athletes communities**.

Verified current account fields include:

- `communities[{ id, name, slug, role }]`
- `teams[{ id, name, slug, badgeUrl, isPlayer, responsibilities, capabilities }]`
- no `athletesCommunities`

`/api/v1/me` is Identity-owned. `PrismaIdentityRepository` currently reads Communities and Teams directly and has no Athletes-membership projection. This confirms the approved Slice 1 account-context gap is still real.

### Current authority owners

- HOOMA Community roles remain `FOUNDER | COACH | MEMBER`.
- Team responsibility model remains `COACH | ASSISTANT`, with existing Team capability semantics. Help must not repurpose unrelated Team capabilities to mean fundraising/help authority.
- Athletes Community roles remain `FOUNDER | MODERATOR | MEMBER`; current Athletes manager behavior recognizes Founder/Moderator while founder-only operations remain distinct.
- These existing authority models can support the plan's Help publisher rules without a duplicate authority system.

### Platform Admin overlap

Current platform-manager capabilities are:

```text
REVIEW_PITCH_APPLICATIONS
VIEW_AUDIT
MANAGE_ADMIN_ISSUES
MANAGE_USERS
```

The contract now hard-codes `capabilities.max(4)`. The original plan recorded the same source-of-truth defect when the count was three. The factual number changed; the defect pattern remains. Slice 9 must still replace the hard-coded maximum with one authoritative capability list before/when Help capabilities are added.

### Prisma / API modules

No Help models or backend modules exist yet.

Missing planned Prisma files:

```text
packages/database/prisma/requests.prisma
packages/database/prisma/donations.prisma
packages/database/prisma/fundraising.prisma
```

Missing planned API modules:

```text
apps/api/src/modules/requests/
apps/api/src/modules/donations/
apps/api/src/modules/fundraising/
```

Existing public/member routers remain `/api/public/v1` and `/api/v1` and contain no Help routes.

### Shared infrastructure to reuse

Verified present and canonical:

- PostgreSQL / Prisma
- Redis
- one `@hooma/storage` ObjectStorage abstraction
- one Worker runtime
- one Outbox pipeline
- existing UserNotification subsystem
- Platform Admin / Audit
- Identity
- HOOMA Communities
- Teams
- Athletes Communities
- Places/Pitch
- Ride
- Discovery
- Whistle

Current Worker uses the existing Outbox runner and storage abstraction. No Help Worker or Help Outbox exists, and none should be created.

Current Discovery remains query-based and currently projects `EVENTS`, `TEAMS`, and `GAMERS`; this matches the approved later Slice 16 approach of extending Discovery rather than replacing it with a new feed architecture.

### Money contract

Existing HOOMA money contract is verified as:

```text
TND → exponent 3
EUR → exponent 2
USD → exponent 2
```

This matches the approved FundMe plan and remains the required money representation basis for later fundraising slices.

### Tests / repository gates

Current repository test inventory includes unit, integration, architecture, component, and concurrency patterns applicable to later Help slices.

Current root gates are verified as:

```text
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
```

`npm run check` includes the non-integration/non-security combined gate documented in `package.json`.

No local source mutation or behavioral test was required for the read-only freshness inspection. Local clone execution was unavailable because the execution container could not resolve `github.com`; authoritative GitHub connector reads and Railway deployment/runtime evidence were used instead.

### Governing-document drift discovered

Current repository governance documents still describe the older Requests quantity/partial-claim model (`Request` / `RequestClaim`) and older FundMe freeze language.

The latest owner-approved plan explicitly requires the newer broad Help model:

```text
HelpRequest
HelpRequestResponse
```

with generic response states and manual fulfillment, plus the later Fundraiser slices and explicit payment-provider decision gate.

Repository governance gives the latest explicit product-owner instruction precedence over `requirements.md`, `structure.md`, `docs/DECISIONS.md`, and `docs/CANONICAL_MODEL.md`. Therefore:

- the latest approved Help plan remains authoritative;
- the old quantity/partial-claim wording is stale for this implementation;
- no fallback to the old `RequestClaim` model is authorized;
- this is a documented factual drift, not a self-authorized product-plan amendment;
- governing-doc synchronization must occur only in the appropriate affected implementation task, not as unrelated Slice 0 cleanup.

### Unresolved risks / hard gates

1. **Payment provider — BLOCKED by design.** No provider is selected. Do not implement FundMe contributions before the explicit Slice 12 decision.
2. **Object storage bucket policy — later verification required.** Railway exposes a storage resource named `hooma-athletes-photos`; ObjectStorage works, but later Donation/FundMe media work must verify whether the active bucket is intentionally multi-domain before reusing it.
3. **Account/entity deletion semantics — later verification required.** Before Help/FundMe schema mutations, inspect canonical deletion/retention behavior; do not guess CASCADE/RESTRICT/SET NULL.
4. **Repository governing docs are stale for Requests response semantics.** Latest owner plan has explicit precedence; synchronize only when the affected implementation task reaches that contract.
5. **Baseline dependency audit warning.** The inspected Railway build reported four npm-audit findings (`1 moderate`, `3 high`). Slice 0 does not authorize dependency remediation; no audit fix or upgrade was attempted.

## Execution Record — Slice 0

Status: `COMPLETE`

Baseline SHA:
`c304fed4c925cbcd578fdbafb21926f927e400f5` (original plan baseline)

Refreshed authoritative SHA:
`b07167f9beb0003eceddb3fd73bfbff53417a618`

Goal:
Revalidate the current source, overlapping work, deployment SHA, migration state, current Help shell, contracts, schema, API composition, authority owners, shared infrastructure, tests and repository gates before feature implementation.

Files changed by Slice 0:

- `docs/REQUESTS_FUNDME_DONATIONS_EXECUTION_PLAN.md` only, on isolated branch `help/requests-fundme-donations-slice-0`

Feature/source files changed:

- none

Database:

- no schema change
- no migration created
- production migration state inspected only

Tests added:

- none

Checks/evidence performed:

- refreshed `phase-0-foundation` HEAD → PASS
- open PR check against `phase-0-foundation` → PASS, none open
- original baseline vs refreshed HEAD overlap inspection → PASS
- Railway deployed SHA inspection for Web/API/Telegram/Worker → PASS
- Railway migration/deploy log inspection → PASS, 47 migrations applied, ready healthcheck succeeded
- current Requests page/CSS/router inspection → PASS
- current contracts and `/me` source trace → PASS
- current Prisma/module/public+member router/DI inspection → PASS
- Community/Team/Athletes authority inspection → PASS
- Platform Admin capability inspection → PASS
- Worker/Outbox/ObjectStorage/Notifications/Discovery inspection → PASS
- current test inventory and root gate inspection → PASS
- governing-doc precedence/conflict classification → PASS
- no feature/runtime/deployment mutation → PASS

Verification:
`PASS`

### Slice 0 score

```text
Plan fidelity:          1.0 / 1.0
Architecture:           1.0 / 1.0
Correctness:            1.0 / 1.0
Authorization/privacy:  0.9 / 1.0
Data integrity:         1.0 / 1.0
Tests/evidence:         0.8 / 1.0
Error handling:         0.9 / 1.0
UI/API quality:         0.9 / 1.0
Maintainability:        0.9 / 1.0
Regression safety:      1.0 / 1.0
                       ----
TOTAL:                  9.4 / 10
```

PASS GATE: `YES` — total is greater than `8.5`.

Deductions:

- No local behavioral suite was run because Slice 0 is a read-only freshness task and the execution container could not resolve GitHub for a local clone; source/runtime evidence came from authoritative GitHub and Railway reads.
- Authorization/privacy, error handling, and UI/API categories were inspection-only because Slice 0 changes no behavior.
- The repository's older Requests governance text remains to be synchronized in the appropriate affected task; Slice 0 intentionally did not perform opportunistic documentation cleanup.

Unexpected findings:

- baseline moved from `c304fed4...` to `b07167f9...` through PR #315;
- Admin capability count is now four, while the hard-coded-max defect pattern remains;
- governing docs still describe the superseded Request/RequestClaim quantity model;
- current Railway storage resource name is Athletes-specific;
- baseline Railway build surfaced existing npm-audit findings.

Plan impact:

- no product requirement changed;
- no slice reordered;
- no approved amendment is required;
- later implementation must use the refreshed SHA as its starting factual baseline and re-read it again before each major slice.

Exact next task:
`Task 1.1 — Shared Help contract primitives`

## Task 1.1 execution contract

Status: `NOT_STARTED`

Authorized scope from Slice 1:

```text
packages/contracts/src/help.ts
packages/contracts/src/index.ts
focused contract tests needed to prove the shared Help primitives
```

Task 1.1 must implement only genuinely shared Help contract primitives, beginning with the approved `HelpAudienceScope`, broad `HelpCategory`, and shared item taxonomy. It must not add Help database tables, fundraising logic, Donation lifecycle logic, Requests response behavior, UI, routes, payment-provider code, or unrelated refactors.

Before Task 1.1 mutation, re-read current `phase-0-foundation` HEAD/open PRs and inspect exact current contract/test conventions again. Test-first and the >8.5 score gate remain mandatory.
