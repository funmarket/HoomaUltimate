# HOOMA Requests | FundMe | Donations Implementation Plan

Status: **ACTIVE LIVING EXECUTION PLAN**

This file is the repository living plan for the Requests | FundMe | Donations implementation. It preserves the attached product plan as the implementation program and records verified execution state as work proceeds.

Authoritative repository: `funmarket/HoomaUltimate`
Authoritative branch: `phase-0-foundation`
Working branch: `feat/help-slice-1-contracts-contexts`
Original attached-plan baseline: `c304fed4c925cbcd578fdbafb21926f927e400f5`
Slice 1 base foundation HEAD: `b07167f9beb0003eceddb3fd73bfbff53417a618`
Current task: `Slice 2 - Requests database/domain`
Exact next task: start Slice 2 from the integrated Slice 1 foundation and implement only the Requests database/domain scope defined by this plan.

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

Verified on 2026-09-16 against live branch state:

- Slice 1 was based on `phase-0-foundation` HEAD `b07167f9beb0003eceddb3fd73bfbff53417a618` (`feat: add platform admin user security (#315)`).
- The attached implementation baseline `c304fed4c925cbcd578fdbafb21926f927e400f5` is stale but remains the product/architecture plan source.
- Current Requests frontend exists at `packages/frontend/src/requests/RequestsPage.tsx` and `packages/frontend/src/requests/requests.css`.
- Current Requests tabs remain only `Requests | FundMe`.
- Current routes remain `/requests`, `/requests/fundme`, and `/fundme -> /requests/fundme`.
- Current Requests/FundMe UI remains an honest placeholder and does not claim backend behavior.
- No Requests, Donations, or Fundraising backend module has been introduced by Slice 1.
- `packages/contracts/src/help.ts` now defines the narrow shared Help audience, category, and item taxonomy contracts and is exported through `@hooma/contracts/help`.
- `meResponseSchema` now exposes `athletesCommunities` publisher contexts.
- Identity `findMe` now reads active Athletes memberships (`leftAt: null`) and returns community id/name/slug plus role.
- Prisma already has `AthletesCommunity`, `AthletesMembership`, and `AthletesRole`; Slice 1 required no migration.
- Slice 1 implementation head `fd861bf1a4b00739d9e964cbc710dfd6856439ee` passed the complete CI workflow in run `35161861982`.

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

Status: `NOT_STARTED`

### Slice 3 - Requests responses + lifecycle

Status: `NOT_STARTED`

### Slice 4 - Requests frontend

Status: `NOT_STARTED`

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
