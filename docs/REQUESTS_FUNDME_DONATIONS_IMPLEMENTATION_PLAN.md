# HOOMA Requests | FundMe | Donations Implementation Plan

Status: **ACTIVE LIVING EXECUTION PLAN**

This file is the repository living plan for the Requests | FundMe | Donations implementation. It preserves the attached product plan as the implementation program and records verified execution state as work proceeds.

Authoritative repository: `funmarket/HoomaUltimate`
Authoritative branch: `phase-0-foundation`
Working branch: `feat/help-slice-1-contracts-contexts`
Original attached-plan baseline: `c304fed4c925cbcd578fdbafb21926f927e400f5`
Current verified foundation HEAD: `b07167f9beb0003eceddb3fd73bfbff53417a618`
Current task: `Slice 1 - Shared contracts + account publisher contexts`
Exact next task: implement only shared Help contracts and `meResponse.athletesCommunities` account publisher context.

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

- `phase-0-foundation` HEAD is `b07167f9beb0003eceddb3fd73bfbff53417a618`.
- The latest live commit is `feat: add platform admin user security (#315)`.
- No open PR targeting `phase-0-foundation` was found during Slice 0 inspection.
- The attached implementation baseline `c304fed4c925cbcd578fdbafb21926f927e400f5` is stale but still the product/architecture plan source.
- Current Requests frontend exists at `packages/frontend/src/requests/RequestsPage.tsx` and `packages/frontend/src/requests/requests.css`.
- Current Requests tabs are only `Requests | FundMe`.
- Current routes are `/requests`, `/requests/fundme`, and `/fundme -> /requests/fundme`.
- Current Requests/FundMe UI is an honest placeholder and does not claim backend behavior.
- No Requests, Donations, or Fundraising backend module exists yet.
- `packages/contracts/src/help.ts` does not exist yet.
- Current `meResponseSchema` exposes `communities` and `teams`, but not `athletesCommunities`.
- Identity `findMe` currently reads HOOMA communities, teams, responsibilities, and team capabilities, but not Athletes memberships.
- Prisma already has `AthletesCommunity`, `AthletesMembership`, and `AthletesRole`.
- Active Railway API/Web/Telegram/Worker services are configured from `phase-0-foundation`; old `HoomaUltimate` service points to `main` and is not the current implementation source.
- Railway API deployment `83e0ce02-5922-4b33-8e4f-80c680db021f` succeeded for `b07167f9beb0003eceddb3fd73bfbff53417a618` and applied migration `20260916142000_app_manager_users_capability`.

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
- Contracts `meResponseSchema` verified to lack `athletesCommunities`.
- Identity repository/service verified to lack Athletes memberships in `findMe` and returned `MeResponse`.
- Prisma schema verified to already contain Athletes community membership source tables.
- Railway production status and deployment logs verified current API deployment and migration application.

Score: **9/10**

Score justification:

Fresh source and deployment inspection completed, no overlap found, stale baseline recognized, and the next safe slice is unambiguous. A 10 is not claimed because this environment has not yet run a local repository test command.

Unresolved risks:

- Local verification may expose type or format issues after code mutations.
- GitHub connector edits are one-file commits unless a lower-level tree commit is used.
- The existing codebase places root `MeResponse` schema in `packages/contracts/src/index.ts`; care is needed to add `help.ts` without creating a giant shared contract.

### Slice 1 - Shared contracts + account publisher contexts

Status: `IN_PROGRESS`

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

Allowed files for this slice:

```text
packages/contracts/src/help.ts
packages/contracts/src/index.ts
packages/contracts/package.json
apps/api/src/modules/identity/application/identity.repository.ts
apps/api/src/modules/identity/application/identity.service.ts
apps/api/src/modules/identity/infrastructure/prisma-identity.repository.ts
focused tests proving meResponse athletesCommunities and contracts
this live plan file
```

Current Slice 1 findings:

- `meResponseSchema` currently returns `communities` and `teams` only.
- `IdentityService.me` maps `user.communities` and `user.teams` only.
- `PrismaIdentityRepository.findMe` can query `athletesMemberships` from the existing Prisma model without a new migration.
- `AthletesRole` values are `FOUNDER`, `MODERATOR`, `MEMBER`.
- `@hooma/contracts` uses explicit package subpath exports, so `packages/contracts/package.json` must export `./help` for the new shared contract module to be consumable consistently.

Files changed so far:

```text
docs/REQUESTS_FUNDME_DONATIONS_IMPLEMENTATION_PLAN.md
```

Migrations created: none.

Tests added: none yet.

Tests run: none yet.

Verification evidence: Slice 1 inspection complete, production mutation not yet started.

Score: not scored yet.

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
