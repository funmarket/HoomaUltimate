# HOOMA Requests | FundMe | Donations Implementation Plan

Status: **ACTIVE LIVING EXECUTION PLAN**

This file is the repository living plan for the Requests | FundMe | Donations implementation. It preserves the attached product plan as the implementation program and records verified execution state as work proceeds.

Authoritative repository: `funmarket/HoomaUltimate`
Authoritative branch: `phase-0-foundation`
Working branch: none — Slice 4R merged to `phase-0-foundation` at `ff57413ffbe31d8cfc688c793b08f6671a99ce5c`; next implementation branch is not authorized yet.
Original attached-plan baseline: `c304fed4c925cbcd578fdbafb21926f927e400f5`
Slice 1 base foundation HEAD: `b07167f9beb0003eceddb3fd73bfbff53417a618`
Slice 2 base foundation HEAD: `a5bd502f58a746a1a89d33ba4afb28506c2e35b3`
Slice 3 base foundation HEAD: `e885c34d1de3027871f3845e9c7a57fbed28a981`
Slice 4R recovery base foundation HEAD: `0e2b80c714324efc41afc8138e080a19b5f0a69a`
Stranded Slice 4 branch (SOURCE MATERIAL ONLY - never merged, rebased into, or cherry-picked as a batch): `feat/help-slice-4-requests-frontend` at `e7124f04af798f21fd9b8be7d001cd28da5643d1` (9 commits ahead / 15 behind its merge base `3033dce8e1ff1c4d7c5a4e54a51fdda0e83df523`).
Current task: `Slice 4R complete — awaiting next authorized slice`
Exact next task: after Slice 4R is integrated and live-smoke-tested, start `Slice 4.5 - Request expiry Worker execution`.

## Execution loop

Every task must follow:

```text
INSPECT -> TEST/PROVE -> CHANGE -> VERIFY -> SCORE -> UPDATE PLAN -> NEXT TASK
```

Allowed task statuses:

```text
NOT_STARTED
IN_PROGRESS
BLOCKED
IMPLEMENTED_PENDING_VERIFICATION
VERIFIED
FAILED_SCORE_GATE
COMPLETE
```

`COMPLETE` requires implementation, focused tests, required regression checks, diff inspection, no unauthorized changes, score greater than 8.5, and this live plan updated.

## Product boundary

Requests is the help/need domain: somebody needs something.
FundMe is the fundraising domain: somebody needs financial support.
Donations is the free-item giving domain: somebody has a useful item to give away.

Do not turn Requests into Play, Donations into a marketplace, or FundMe into a wallet. Existing domains remain authoritative for their own objects and workflows.

## Required top-level IA target

The finished Help surface is:

```text
HOOMA HELP
[ Requests ] [ FundMe ] [ Donations ]
```

Preserve:

```text
/requests
/requests/fundme
/fundme -> /requests/fundme
```

Add `/requests/donations` only when the Donations frontend/backend slice is ready. Do not expose fake functional controls.

## Naming and ownership rules

Requests backend names:

```text
HelpRequest
HelpRequestResponse
```

Donations backend names:

```text
DonationOffer
DonationClaim
DonationImage
```

FundMe backend names:

```text
Fundraiser
FundraiserBudgetItem
FundraiserContribution
FundraiserUpdate
FundraiserMedia
```

Do not create `Request`, `FootballRequest`, `FundMe`, or stringly typed `ownerType` / `ownerId` persistence.

Backend modules must stay separate:

```text
apps/api/src/modules/requests/
apps/api/src/modules/donations/
apps/api/src/modules/fundraising/
```

Shared contracts must stay narrow. `help.ts` contains only concepts genuinely shared by Requests, FundMe, and Donations.

## Publisher model rule

Every authenticated user can publish personally. Official publisher contexts are:

```text
USER
HOOMA COMMUNITY
TEAM
ATHLETES COMMUNITY
```

Persistence must use concrete foreign keys, not polymorphic strings. `createdByUserId` is the audit actor. The publisher entity controls current management authority.

## Current verified facts

Verified on 2026-09-17 against live branch state:

- Slice 1 was based on `phase-0-foundation` HEAD `b07167f9beb0003eceddb3fd73bfbff53417a618` (`feat: add platform admin user security (#315)`).
- Slice 2 was based on integrated Slice 1 foundation HEAD `a5bd502f58a746a1a89d33ba4afb28506c2e35b3` (merge of PR #316).
- Slice 3 is based on integrated Slice 2 foundation HEAD `e885c34d1de3027871f3845e9c7a57fbed28a981` (merge of PR #318).
- The attached implementation baseline `c304fed4c925cbcd578fdbafb21926f927e400f5` is stale but remains the product/architecture plan source.
- Current Requests frontend exists at `packages/frontend/src/requests/RequestsPage.tsx` and `packages/frontend/src/requests/requests.css` and was not modified by Slice 3.
- Current Requests tabs remain only `Requests | FundMe`.
- Current routes remain `/requests`, `/requests/fundme`, and `/fundme -> /requests/fundme` on the frontend.
- Current Requests/FundMe UI remains an honest placeholder and does not claim backend behavior.
- `packages/contracts/src/help.ts` remains the narrow shared Help audience, category, and item taxonomy contract source.
- `meResponseSchema` continues to expose `athletesCommunities` publisher contexts from Slice 1.
- Slice 2 introduced the separate Requests backend module, `HelpRequest` persistence, public/member read routes, create authorization, and DI wiring.
- Slice 3 adds `HelpRequestResponse` persistence, response privacy/actions, request lifecycle mutations, expiry preparation, and compare-and-set concurrency protection only.
- Slice 3 implementation head `3a3d3a199e46cc74314f3a09ce67babea4b2a766` passed the complete CI workflow in run `35220160129` before this ledger closeout update.

## Slice ledger

### Slice 0 - Freshness gate

Status: `COMPLETE`

Scope:

```text
refresh phase-0-foundation
record HEAD
inspect open PRs
inspect overlap
inspect Railway SHA
inspect migration status
```

Files changed:

```text
docs/REQUESTS_FUNDME_DONATIONS_IMPLEMENTATION_PLAN.md
```

Migrations created: none.

Tests added: none.

Tests run:

```text
Repository and Railway inspection only; no local code execution was available in this connector-only slice.
```

Verification evidence:

- Branch HEAD verified from GitHub branch API.
- Requests page and CSS verified from current source.
- Router verified for `/requests`, `/requests/fundme`, and `/fundme` redirect.
- Contracts `meResponseSchema` verified to lack `athletesCommunities` before Slice 1.
- Identity repository/service verified to lack Athletes memberships in `findMe` and returned `MeResponse` before Slice 1.
- Prisma schema verified to already contain Athletes community membership source tables.
- Railway production status and deployment logs verified current API deployment and migration application at the Slice 0 baseline.

Score: **9/10**

Score justification:

Fresh source and deployment inspection completed, no overlap found, stale baseline recognized, and the next safe slice was unambiguous. A 10 was not claimed because that inspection slice did not run local repository test commands.

Unresolved risks:

- GitHub connector edits are one-file commits unless a lower-level tree commit is used.
- The existing codebase places root `MeResponse` schema in `packages/contracts/src/index.ts`; shared Help contracts must remain narrow as later slices are implemented.

### Slice 1 - Shared contracts + account publisher contexts

Status: `COMPLETE`

Authorized implementation only:

```text
help shared contracts
HelpAudienceScope
HelpCategory
item taxonomy
meResponse athletesCommunities
identity query/readback
tests
```

Explicit non-goals:

```text
No Help tables
No Requests module
No Donations module
No Fundraising module
No frontend fake controls
No Donations tab exposure
No payment provider code
No migration unless proven necessary
```

Files changed:

```text
packages/contracts/src/help.ts
packages/contracts/src/index.ts
packages/contracts/package.json
apps/api/src/modules/identity/application/identity.repository.ts
apps/api/src/modules/identity/application/identity.service.ts
apps/api/src/modules/identity/infrastructure/prisma-identity.repository.ts
tests/help-shared-contracts.test.ts
tests/help-account-publisher-context.test.ts
docs/REQUESTS_FUNDME_DONATIONS_IMPLEMENTATION_PLAN.md
```

Migrations created: none.

Tests added:

```text
tests/help-shared-contracts.test.ts
tests/help-account-publisher-context.test.ts
```

Tests run and required regression gates:

```text
npm ci
npm run db:generate
npm run db:validate
npm run db:migrate:deploy
npm run architecture:check
changed-file Prettier check
changed-source lint
npm run typecheck
npm run build:packages
npm test
npm run build
npm run test:integration
npm run deploy:preflight
npm run security:check
npm run db:migrate:status
```

Verification evidence:

- Exact implementation head `fd861bf1a4b00739d9e964cbc710dfd6856439ee` passed all CI gates in workflow run `35161861982`.
- Shared contracts are exported without adding Requests, Donations, or Fundraising persistence or UI behavior.
- `IdentityService.me` returns `athletesCommunities` from the authoritative identity repository result.
- `PrismaIdentityRepository.findMe` reads only active Athletes memberships and projects community identity plus role.
- Focused tests cover the shared Help contract values and the `/me` Athletes publisher-context readback/query behavior.
- The Slice 1 diff remains confined to the nine authorized files listed above.

Score: **9.3/10**

Score justification:

The authorized Slice 1 contract and account-context work is implemented with focused tests, no migration, no frontend/domain scope expansion, and the full repository CI gate passed on the exact implementation head. The score remains below 10 because production deployment is not required or claimed for this contract-only slice prior to merge.

Unresolved risks:

- Later publisher authorization must continue to derive current authority from canonical community/team/Athletes membership sources rather than caching authority in Help tables.
- Slice 2 must be a separate domain slice and must not retroactively expand PR #316.

### Slice 2 - Requests database/domain

Status: `COMPLETE`

Authorized implementation only:

```text
Requests persistence + migration
Requests contracts
repository
service
publisher/audience authorization
public/member routes
DI wiring
focused tests
```

Explicit non-goals:

```text
No Request responses
No lifecycle mutation routes
No Requests frontend implementation
No Donations backend/frontend
No FundMe backend/frontend
No payment provider code
No unrelated domain cleanup
```

Files changed:

```text
apps/api/src/bootstrap/container.ts
apps/api/src/http/errors/error-handler.ts
apps/api/src/http/public-v1/router.ts
apps/api/src/http/v1/router.ts
apps/api/src/modules/requests/application/request.repository.ts
apps/api/src/modules/requests/application/request.service.ts
apps/api/src/modules/requests/domain/request-error.ts
apps/api/src/modules/requests/http/request.routes.ts
apps/api/src/modules/requests/infrastructure/prisma-request.repository.ts
packages/contracts/package.json
packages/contracts/src/requests.ts
packages/database/prisma/migrations/20260917003000_help_requests/migration.sql
packages/database/prisma/requests.prisma
tests/requests-contracts.test.ts
tests/requests-domain.integration.test.ts
tests/requests-service.test.ts
docs/REQUESTS_FUNDME_DONATIONS_IMPLEMENTATION_PLAN.md
```

Migrations created:

```text
20260917003000_help_requests
```

Tests added:

```text
tests/requests-contracts.test.ts
tests/requests-service.test.ts
tests/requests-domain.integration.test.ts
```

Tests run and required regression gates:

```text
npm ci
npm run db:generate
npm run db:validate
npm run db:migrate:deploy
npm run architecture:check
changed-file Prettier check
changed-source lint
npm run typecheck
npm run build:packages
npm test
npm run build
npm run test:integration
npm run deploy:preflight
npm run security:check
npm run db:migrate:status
```

Verification evidence:

- Exact implementation head `c2b71e236cf4e9c61ccb9e449a65cec30daa6d92` passed all CI gates in workflow run `35170183466`.
- Prisma generation, schema validation, all 48 migrations, architecture checks, formatting, lint, typecheck, package build, unit tests, application build, integration tests, deploy preflight, security check, and migration status all passed.
- `HelpRequest` persistence uses concrete publisher/audience foreign keys and the plan-defined status/field model; no polymorphic owner strings were added.
- Publisher authority is read from canonical current HOOMA community, team responsibility, and Athletes membership sources rather than cached authority in Requests.
- Public reads are restricted to public Requests; member reads include only public, own, or currently authorized community/Athletes audience Requests.
- The diff is confined to the Requests slice, contracts/database wiring, focused tests, and this living plan; no frontend, Donations, FundMe, Whistle, Play, Ride, Watch, Pitch, Gamers, Teams behavior, or Telegram auth implementation was changed.

Score: **9.3/10**

Score justification:

Slice 2 implements the authorized Requests persistence/domain/read/create boundary with focused contract, service, and integration coverage and a complete green repository CI run. The score remains below 10 because production deployment is not part of this slice and later lifecycle/response behavior intentionally remains for Slice 3.

Unresolved risks:

- Request response persistence and lifecycle transitions remain intentionally absent until Slice 3.
- Later lifecycle authorization must continue to derive current publisher authority from canonical entity sources.
- Frontend behavior remains intentionally unchanged until Slice 4.

### Slice 3 - Requests responses + lifecycle

Status: `COMPLETE`

Authorized implementation only:

```text
HelpRequestResponse persistence + contracts
respond
withdraw
accept
decline
fulfill
cancel
expiry preparation
current publisher-authority management checks
response privacy
compare-and-set concurrency protection
focused tests
```

Explicit non-goals:

```text
No Requests frontend implementation
No Donations backend/frontend
No FundMe backend/frontend
No Worker scheduling or notifications
No reopening lifecycle
No unrelated domain cleanup
```

Files changed:

```text
apps/api/src/http/errors/error-handler.ts
apps/api/src/modules/requests/application/request.repository.ts
apps/api/src/modules/requests/application/request.service.ts
apps/api/src/modules/requests/domain/request-error.ts
apps/api/src/modules/requests/http/request.routes.ts
apps/api/src/modules/requests/infrastructure/prisma-request.repository.ts
packages/contracts/src/requests.ts
packages/database/prisma/migrations/20260917020000_help_request_responses_lifecycle/migration.sql
packages/database/prisma/requests.prisma
tests/requests-concurrency.integration.test.ts
tests/requests-responses-contracts.test.ts
tests/requests-responses-lifecycle.test.ts
tests/requests-service.test.ts
docs/REQUESTS_FUNDME_DONATIONS_IMPLEMENTATION_PLAN.md
```

Migrations created:

```text
20260917020000_help_request_responses_lifecycle
```

Tests added:

```text
tests/requests-concurrency.integration.test.ts
tests/requests-responses-contracts.test.ts
tests/requests-responses-lifecycle.test.ts
```

Tests run and required regression gates:

```text
npm ci
npm run db:generate
npm run db:validate
npm run db:migrate:deploy
npm run architecture:check
changed-file Prettier check
changed-source lint
npm run typecheck
npm run build:packages
npm test
npm run build
npm run test:integration
npm run deploy:preflight
npm run security:check
npm run db:migrate:status
```

Verification evidence:

- Exact implementation head `3a3d3a199e46cc74314f3a09ce67babea4b2a766` passed all CI gates in workflow run `35220160129` before this ledger closeout update.
- `HelpRequestResponse` uses the plan-defined `PENDING`, `ACCEPTED`, `DECLINED`, and `WITHDRAWN` states with a database uniqueness guarantee on `(requestId, responderUserId)`.
- Response reads are private to the current request manager or the response author; unauthorized access uses not-found behavior.
- Request managers cannot respond to their own Request, and duplicate response creation is rejected.
- Lifecycle management derives current Community, Team, or Athletes authority rather than historical creator authority for entity-published Requests.
- Accept/decline/withdraw and request fulfill/cancel transitions use conditional updates; concurrency integration tests prove duplicate response creation and competing terminal mutations cannot both win.
- Expiry preparation atomically transitions due `OPEN`/`IN_PROGRESS` Requests to `EXPIRED`; Worker scheduling remains intentionally outside this slice.
- The diff is confined to Requests contracts/database/domain/routes/tests and this living plan; no frontend, Donations, FundMe, Whistle, Play, Ride, Watch, Pitch, Gamers, Teams behavior, or Telegram auth implementation was changed.

Score: **9.3/10**

Score justification:

Slice 3 implements the authorized response and lifecycle boundary with database constraints, privacy/authority checks, compare-and-set mutation safety, focused unit/integration coverage, and a complete green repository CI run on the implementation candidate. The score remains below 10 because deployment/Worker scheduling are outside this slice and the final ledger-only head still requires its own CI verification before merge readiness.

Unresolved risks:

- Worker-driven recurring expiry execution remains intentionally deferred to the later Notifications/Worker slice; this slice only provides the atomic expiry operation.
- Requests frontend behavior remains intentionally unchanged until Slice 4.
- Historical Slice 3 merge gate: PR #320 remained unmerged until its exact final ledger head passed CI and explicit merge authorization was provided; it was subsequently merged as `3033dce8e1ff1c4d7c5a4e54a51fdda0e83df523`.

### Slice 4 - Requests frontend

Status: `COMPLETE`

Final Slice 4R state: **COMPLETE**. Recovery work started from `phase-0-foundation` HEAD `0e2b80c714324efc41afc8138e080a19b5f0a69a` and was merged by PR #336 to `phase-0-foundation` as `ff57413ffbe31d8cfc688c793b08f6671a99ce5c`.

Slice 4R scope (only this):

```text
recover the single Requests frontend API boundary
Requests public/member feed with the existing query filters
Request cards and Help tabs (Requests / FundMe only)
Request creation
Request detail, one-shot responses, manager lifecycle controls
routes /requests/new and /requests/:requestId
focused Requests frontend tests
restrained dark Help visual system
```

Explicitly excluded from Slice 4R:

```text
Donations backend, frontend, route or tab
FundMe implementation (honest placeholder only)
any Requests Prisma change or migration
Requests backend redesign or new endpoints
Request chat / comments / DMs
Whistle, HOOMA NOW, notifications or Worker execution
unrelated cleanup, global UI framework or icon dependency
```

Recovery rule: `feat/help-slice-4-requests-frontend` is read-only source material. Its useful frontend files are adapted to the current foundation file by file; the branch is never merged, rebased into, or cherry-picked as a batch. Stale parts (disabled Donations tab, solid-lime control system, monolithic pages) are discarded instead of recovered.

Final Slice 4R evidence:

- PR: #336
- Recovery head: `c01cea4f197a95967ca6f934cda91da888d857fe`
- Merge SHA: `ff57413ffbe31d8cfc688c793b08f6671a99ce5c`
- Post-merge CI: run `35622862450` — `SUCCESS`
- Railway HOOMA Web deployment: `338297c9-c9d3-40b9-b6fa-3403d0696078`
- Railway source SHA: `ff57413ffbe31d8cfc688c793b08f6671a99ce5c`
- Railway status: `SUCCESS`

Live-verification truth:

- Production bundle/deployment verified.
- Rendered-browser visual smoke check was unavailable because the agent browser harness failed.
- Do not state that the painted UI was visually verified.
- The public production Requests API contained zero Requests at verification time, so no populated production Request detail page could be exercised.

Known Requests follow-ups (not implemented and not authorized by this closeout):

Slice 4.6 candidate hardening:

- safe responder profile projection
- cursor pagination / Load more
- debounce free-text filters

Next slice after this: `Slice 4.5 - Request expiry Worker execution` (not implemented in Slice 4R).

### Slice 5 - Donations database/domain

Status: `NOT_STARTED`

### Slice 6 - Donation frontend

Status: `NOT_STARTED`

### Slice 7 - Donation media

Status: `NOT_STARTED`

### Slice 8 - Request to Donation matching

Status: `NOT_STARTED`

### Slice 9 - Help content reports/admin

Status: `NOT_STARTED`

### Slice 10 - FundMe core

Status: `NOT_STARTED`

### Slice 11 - FundMe frontend + admin

Status: `NOT_STARTED`

### Slice 12 - Payment-provider decision gate

Status: `NOT_STARTED`

### Slice 13 - FundMe payments

Status: `NOT_STARTED`

### Slice 14 - FundMe goal/result

Status: `NOT_STARTED`

### Slice 15 - Notifications/Worker

Status: `NOT_STARTED`

### Slice 16 - HOOMA NOW

Status: `NOT_STARTED`

### Slice 17 - Final Help UI polish

Status: `NOT_STARTED`

## No-drift boundaries

Do not casually modify:

```text
Watch
Pitch
Gamers
Ride
Play
Teams behavior
Athletes behavior beyond account context readback
Whistle contract
bottom navigation
Telegram auth
```

Cross-domain edits require explicit need and must be recorded here before mutation.
