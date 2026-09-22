# HOOMA Requests | FundMe | Donations Implementation Plan

Status: **ACTIVE LIVING EXECUTION PLAN**

This file is the repository living plan for the Requests | FundMe | Donations implementation. It preserves the attached product plan as the implementation program and records verified execution state as work proceeds.

Authoritative repository: `funmarket/HoomaUltimate`
Authoritative branch: `phase-0-foundation`
Current merged foundation at this reconciliation: `eda53dda71c5ae6d6a4f52d72151bd10edfeb9fd` (PR #346).
Current in-flight Requests work at this reconciliation: PR #347, `feat(play): add canonical Requests projection`, head `43db0974c6926ac7392a80e64cce047cd01b3c82`, based on the current foundation.
Original attached-plan baseline: `c304fed4c925cbcd578fdbafb21926f927e400f5`
Stranded Slice 4 branch (SOURCE MATERIAL ONLY - never merged, rebased into, or cherry-picked as a batch): `feat/help-slice-4-requests-frontend` at `e7124f04af798f21fd9b8be7d001cd28da5643d1`.
Current task: `RQ-FIX-4 - Play Requests projection is in-flight in PR #347`.
Next planned projection after RQ-FIX-4 integration: `RQ-FIX-5 - Athletes Requests projection`.

Newer explicit product-owner direction approved on 2026-09-22 extends the post-RQ-FIX Requests program with `Request Type = Sport | Community`, Community taxonomy independent from Sport, broader sport-specific needs, manual Other values, optional Request image (managed upload or validated URL), optional full address, and the approved premium Request-card presentation. These additions must extend the canonical Requests/taxonomy/media/location/Whistle owners and must not duplicate the merged RQ-FIX architecture.

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

## Current verified snapshot — 2026-09-22

Fresh foundation/source state at this reconciliation:

- `phase-0-foundation` is `eda53dda71c5ae6d6a4f52d72151bd10edfeb9fd` through merged PR #346.
- Requests hardening PR #340 and RQ-FIX PRs #341 through #346 are merged; their historical details remain in the ledger below.
- PR #347 (`feat(play): add canonical Requests projection`) is currently open, head `43db0974c6926ac7392a80e64cce047cd01b3c82`, base `eda53dda71c5ae6d6a4f52d72151bd10edfeb9fd`. Its behavior is in-flight, not foundation truth.
- The Requests frontend is real: `RequestsPage`, `RequestCreatePage`, `RequestDetailPage`, `RequestFeed`, `RequestCard`, taxonomy filters, response flows and one Requests API client are present under `packages/frontend/src/requests/`.
- Current merged taxonomy persistence is `HelpTaxonomySubcategory -> HelpTaxonomyNeed -> HelpTaxonomyNeedSurface`, using canonical `AthletesSport` for the sport-first baseline and server-owned surface eligibility.
- Current `HelpRequest` persistence includes `sport`, `subcategoryId`, `needId` and `customNeed` plus legacy `category` / `itemKind` compatibility fields retained during the transition.
- Current Request contracts/service accept and validate the corrected sport/subcategory/need selection, project resolved taxonomy presentation, enforce custom/product metadata policy and apply surface filtering before pagination.
- Existing publisher/audience authorization, response privacy/actions, lifecycle, cursor ordering and Worker expiry remain foundations to preserve.
- Main Requests uses `surface=REQUESTS`. Play projection remains in-flight in PR #347. Athletes projection remains planned RQ-FIX-5 work.
- `placeId` remains a real optional Request FK/location reference and must not be removed by assumption.
- Historical Requests migrations are applied history and are forward-only; new corrections use new migrations.
- The newer 2026-09-22 owner-approved `Request Type = Sport | Community`, broader taxonomy, manual Other, image, full-address and premium-card direction is authorized product work but is **not yet merged foundation behavior**.

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

Historical Requests hardening follow-ups from the pre-redesign plan:

- safe responder profile projection
- cursor pagination / Load more
- debounce free-text filters

Safe responder profile projection remains deferred to RQ-FIX-6 after the sport-first taxonomy and corrected Request DTO exist. Cursor Load more, Request-id deduplication, City/Houma debounce, and one-time optional identity resolution were reconciled as taxonomy-independent behavior and merged in PR #340 before RQ-FIX-1.

Slice 4.5 implementation is tracked below.

### Slice 4.5 - Request expiry Worker execution

Status: `COMPLETE`

Final implementation branch: `feat/help-slice-4-5-request-expiry-worker`

Base: `phase-0-foundation` at `3f03653aca0b02ab2b4b97fa17d4ab791a7b9254`

PR: #338 — merged to `phase-0-foundation` as `aa5fba64cfb1c4f1704040a46064cae94995f1a1`

Authorized scope:

```text
reuse one canonical due-Request expiry mutation
expire only OPEN / IN_PROGRESS Requests with a non-null expiresAt at or before the Worker cutoff
run one expiry sweep when the Worker starts
repeat the sweep every 60 seconds
prevent overlapping Request expiry runs
track and await an in-flight expiry run during graceful Worker shutdown
focused RED-first Worker expiry tests
no Request schema or migration change
```

Implementation:

- `@hooma/database` now owns `expireDueHelpRequests(...)`, the single atomic persistence mutation.
- `PrismaRequestRepository.expireDue(...)` delegates to that shared mutation, preserving the existing API/service contract.
- `apps/worker/src/requests/request-expiry.ts` is a thin Worker wrapper around the shared mutation.
- `apps/worker/src/main.ts` runs Request expiry once at startup and then every 60 seconds with overlap and shutdown guards.

TDD / verification evidence so far:

- RED-first test head: `8abd8896403ef4e16538476d7224f93c5467c157`
- RED CI: run `35632473995` — failed at `npm test` before the Worker implementation existed, after setup/typecheck/build:packages prerequisites passed.
- Implementation code through: `ae34713ad09308bf267e2796939902fb133a0e81`
- Verified implementation head: `73284bcd6aca31317cdba66650b5d376fc9c9a07`
- Exact-head CI: run `35633693922` — `SUCCESS` (changed-file format/lint, typecheck, unit tests, build, integration, deploy preflight, security and migration status all passed).
- Final ledger head: `5a81da329e20268cb182201153e84b8ed18bf561`
- Final exact-head CI: run `35634276713` — `SUCCESS`
- Merge SHA: `aa5fba64cfb1c4f1704040a46064cae94995f1a1`

Explicitly excluded:

```text
Requests UI redesign
Donations implementation
FundMe implementation
new Request endpoints
new Prisma schema or migration
notifications
unrelated Worker cleanup
Slice 4.6 implementation
```

Slice 4.5 is closed. The former Slice 4.6 is superseded by the RQ-FIX correction program below. Do not start Donations implementation until the Requests correction program is completed and integrated.

## Requests sport-first correction authority — RQ-FIX program

This section supersedes the former flat Requests taxonomy and former Slice 4.6-next ordering. Historical Slice 1-4.5 records remain evidence of what actually shipped; this RQ-FIX section governs the correction program from the current foundation.

### Product authority

Requests is one canonical local-needs domain.

The **current merged baseline** is sport-first:

```text
AthletesSport
  -> HelpTaxonomySubcategory
      -> HelpTaxonomyNeed
```

For that existing Sport branch, `ATHLETES_SPORTS` / `AthletesSport` remains the canonical sport authority; no duplicate Sport table or enum is allowed.

The **approved next product root** is:

```text
Request Type
├── Sport
└── Community
```

Community does not require a Sport. The existing shared taxonomy boundary must be extended cleanly for Community rather than replaced or duplicated. The exact relational extension is an implementation decision to make after inspecting existing constraints/migration safety; this plan does not authorize a parallel Community taxonomy system.

The same canonical `HelpRequest` domain powers:

```text
Main Requests
Play Requests projection
Athletes Requests projection
```

Do not create `PlayRequest`, `AthletesRequest`, `FootballRequest`, or any duplicate request persistence.

Rides remains separate. FundMe remains separate. Donations remains a future separate giving domain. Donations may reuse PRODUCT taxonomy leaves but must not expose COMMUNITY_ROLE needs.

### Shared taxonomy model target

Use a relational shared taxonomy, with semantics owned by the leaf Need rather than inferred from frontend labels:

```text
HelpTaxonomySubcategory
- id
- sport: AthletesSport
- slug
- label
- sortOrder
- active
- timestamps
- UNIQUE(sport, slug)

HelpTaxonomyNeed
- id
- subcategoryId
- slug
- label
- kind: PRODUCT | COMMUNITY_ROLE | COMMUNITY_SUPPORT
- allowsCustomText
- sortOrder
- active
- timestamps
- UNIQUE(subcategoryId, slug)

HelpTaxonomyNeedSurface
- needId
- surface: REQUESTS | PLAY | ATHLETES | DONATIONS
- UNIQUE(needId, surface)
```

Eligibility is server/data policy, not duplicated React logic.

Inactive nodes are unavailable for new creation but remain resolvable for historic Requests. Used taxonomy nodes should be deactivated instead of casually deleted.

The initial taxonomy must be inserted by the forward migration/data migration with deterministic stable IDs/slugs; the repository currently has no canonical seed command that deployment can rely on.

### Corrected Request contract — current baseline and approved extension

Current merged sport classification is:

```text
sport
subcategoryId
needId
customNeed?
```

The approved next contract adds an explicit Request Type so Community classification can exist without a Sport while preserving the current Sport path.

Preserve publisher/audience, title/description, place/city/houma/locationNote, neededByAt/expiresAt, lifecycle state, responses, and Worker expiry behavior.

Product metadata remains conditional:

```text
PRODUCT
  -> quantityNeeded / sizeLabel / conditionPreference allowed

COMMUNITY_ROLE or COMMUNITY_SUPPORT
  -> product metadata rejected by backend validation, not merely hidden by UI
```

`customNeed` is accepted only when the selected Need explicitly has `allowsCustomText = true`.

The Request read DTO should carry resolved taxonomy presentation (sport + subcategory + need labels/identity) so cards/details/projections do not perform client-side taxonomy joins.

### Projection rule

Request list querying must support a server-side surface projection before cursor pagination:

```text
surface=REQUESTS
surface=PLAY
surface=ATHLETES
```

Repository ordering remains deterministic (`createdAt DESC, id DESC`), but taxonomy eligibility must be applied before pagination. Play and Athletes must not fetch generic pages and filter them afterward in React.

The shared public taxonomy endpoint target is:

```text
GET /api/public/v1/help/taxonomy?surface=REQUESTS
GET /api/public/v1/help/taxonomy?surface=PLAY
GET /api/public/v1/help/taxonomy?surface=ATHLETES
GET /api/public/v1/help/taxonomy?surface=DONATIONS
```

The taxonomy backend belongs in a separate `apps/api/src/modules/help-taxonomy/` boundary. Do not move taxonomy persistence into PlayService, AthletesService, or Request HTTP controllers.

### Database correction rule

Never edit historical Requests migrations. Use expand -> inspect/backfill -> compatible switch -> contract.

The new Request hierarchy must be relationally constrained so a Request cannot combine a Sport with a subcategory from another sport or a Need from another subcategory. Service validation is required, but database integrity must also be enforced as far as PostgreSQL/Prisma can safely express it.

Do not guess legacy production mappings from titles/descriptions. Inspect real production combinations before backfill. Ambiguous rows are preserved until explicitly reconciled.

Start with focused taxonomy/query indexes. Do not add a broad city+houma+sport index without query-plan evidence.

### RQ-FIX-0 - architecture and ledger reconciliation

Status: `COMPLETE`

Authorized scope:

- fresh-check live foundation and overlapping PR state
- inspect current Requests contracts, Prisma model, Play/Athletes integration state, and living ledger
- make this sport-first correction program the current repository authority
- reconcile the former Slice 4.6 direction with the sport-first correction program
- preserve historical Slice 1-4.5 evidence
- record the owner-authorized narrowed PR #340 merge without pulling responder-presentation contract work forward
- keep RQ-FIX-0 itself documentation-only

Exit gate:

- exact diff contains only this living plan
- no historical evidence was erased
- final documentation head passes required repository verification for the slice
- PR remains unmerged pending explicit owner authorization

### RQ-FIX-1 - shared sports taxonomy foundation

Status: `COMPLETE`

Implementation branch: `feat/requests-rq-fix-1-taxonomy`

Base foundation: `36fa68ac28e0b7f600cc230a6578a90dda08f547`

PR: #342

Implemented scope:

- added `packages/contracts/src/help-taxonomy.ts` with PRODUCT / COMMUNITY_ROLE / COMMUNITY_SUPPORT Need kinds and REQUESTS / PLAY / ATHLETES / DONATIONS surfaces
- kept `ATHLETES_SPORTS` / `AthletesSport` as the only canonical sport authority; no second sport enum/list was introduced
- exported `@hooma/contracts/help-taxonomy`
- added `packages/database/prisma/help-taxonomy.prisma` with relational Subcategory -> Need -> NeedSurface models
- added uniqueness and focused activity/order indexes without changing `HelpRequest`
- added forward migration `20260921233000_help_taxonomy_foundation`; no historical migration was edited
- deterministically seeded 22 sport subcategories, 40 Needs, and 110 surface-eligibility rows
- seeded required examples including Football / Turf Shoes, Football / Goalkeeper, Running / Pace Partner, and Gym & Fitness / Spotter
- encoded `allowsCustomText` on explicit OTHER leaves rather than inferring custom-text behavior from slugs
- added separate `apps/api/src/modules/help-taxonomy/` repository, service, Prisma infrastructure, and HTTP route boundary
- mounted public `GET /api/public/v1/help/taxonomy?surface=...` under the existing public-v1 router
- filtered active taxonomy and surface eligibility in the repository before response projection
- hard-enforced Donations as PRODUCT-only at the repository boundary in addition to deterministic seed policy
- preserved canonical Athletes sport ordering in the service, with OTHER last
- added RED-first contract, service, and integration coverage
- did not switch or backfill `HelpRequest` taxonomy fields; that remains RQ-FIX-2A/2B

Changed targets for this slice:

```text
packages/contracts/src/help-taxonomy.ts
packages/contracts/package.json
packages/database/prisma/help-taxonomy.prisma
packages/database/prisma/migrations/20260921233000_help_taxonomy_foundation/migration.sql
apps/api/src/modules/help-taxonomy/application/help-taxonomy.repository.ts
apps/api/src/modules/help-taxonomy/application/help-taxonomy.service.ts
apps/api/src/modules/help-taxonomy/infrastructure/prisma-help-taxonomy.repository.ts
apps/api/src/modules/help-taxonomy/http/help-taxonomy.routes.ts
apps/api/src/bootstrap/container.ts
apps/api/src/http/public-v1/router.ts
tests/help-taxonomy-contracts.test.ts
tests/help-taxonomy-service.test.ts
tests/help-taxonomy.integration.test.ts
docs/REQUESTS_FUNDME_DONATIONS_IMPLEMENTATION_PLAN.md
```

Verification evidence:

- implementation head `e3249c033967ce6ab5fb81fb946cc0f9da33b9d2` passed the complete repository CI workflow in run `35662300714`
- ledger-inclusive head `7c718d783f836ed02ca05fa52ec9472480d9b0b2` passed the complete repository CI workflow in run `35662789917`
- both runs passed database generation/validation/migration deploy, architecture check, changed-file formatting, changed-source lint, typecheck, package build, unit tests, full build, integration tests, deploy preflight, security check, and migration status
- the diff remained confined to the authorized RQ-FIX-1 targets listed above
- no `HelpRequest` field, lifecycle behavior, response behavior, Play ownership, Athletes ownership, Rides, FundMe, or Donations implementation was changed
- PR #342 merged on 2026-09-21 as `c6c95657c0b6b4ccffa2cd7c2d5eeb437623c91d` after its exact-head verification.
- RQ-FIX-1 is integrated and no longer blocks later slices.

Score: **9.4/10**

Score justification:

RQ-FIX-1 establishes the shared taxonomy as a separate contracts/database/API boundary, keeps `AthletesSport` canonical, uses only a forward migration with deterministic seed data, enforces Donations PRODUCT-only server-side, and passes full repository CI including integration coverage. The score is below 10 because no production deployment or live HTTP smoke test is required or claimed for this foundation slice; those are not substitutes for the green repository evidence.

### RQ-FIX-2A - Request schema expansion + legacy data reconciliation

Status: `COMPLETE`

Merged PR: #344 -> `86e93bd6b4e419290f9cd22a53449cf593c5f332`

Implemented outcome:

- added nullable `subcategoryId` / `needId` references through forward migration;
- preserved legacy `category` / `itemKind` compatibility during transition;
- added relational hierarchy integrity and focused indexes;
- added schema/integration coverage;
- historical migrations were not rewritten.

### RQ-FIX-2B - corrected Request backend + projections

Status: `COMPLETE`

Merged PR: #345 -> `f7666f1bd71815503a308701294e9e5a1d1896dc`

Implemented outcome:

- canonical sport/subcategory/need validation;
- Request surface filtering in the repository before pagination;
- resolved taxonomy presentation in Request DTOs;
- product/custom metadata validation from selected Need policy;
- existing publisher/audience/lifecycle/response/expiry semantics preserved;
- legacy category/itemKind compatibility retained during transition.

### RQ-FIX-3 - sport-first standalone Requests frontend

Status: `COMPLETE`

Merged PR: #346 -> `eda53dda71c5ae6d6a4f52d72151bd10edfeb9fd`

Implemented outcome:

- Sport -> Subcategory -> Specific Item/Need cascading creation flow;
- standalone UI switched away from generic Category / Item Kind controls;
- reusable `RequestFeed` and `RequestTaxonomyFilters`;
- taxonomy-driven filters/cards/detail;
- conditional product metadata UI;
- main `/requests` surface uses `surface=REQUESTS`.

### RQ-FIX-4 - Play Requests projection

Status: `IN_PROGRESS`

In-flight PR: #347, head `43db0974c6926ac7392a80e64cce047cd01b3c82`, base `eda53dda71c5ae6d6a4f52d72151bd10edfeb9fd`.

This PR is not foundation truth until merged. Current changed files include the Play page/pane/styles, Request-create return-flow handling, and focused Play projection coverage.

Scope:

- Play tabs become Games | Players | Requests | Mine
- Requests pane consumes canonical Requests using `surface=PLAY`
- creation delegates to canonical `/requests/new`
- no Request persistence/service ownership moves into Play

### Post-RQ-FIX approved Requests enhancement — 2026-09-22

Status: `AUTHORIZED_NOT_YET_IN_FOUNDATION`

Locked product direction:

```text
Request Type
├── Sport
└── Community
```

Rules:

- Community does not require a Sport;
- sport taxonomy must expand to realistic sport-specific player/partner/coach/training/advice/equipment needs;
- appropriate branches retain an explicit Other/manual-need escape hatch;
- the existing canonical user-entered Request title remains first-class and separate from taxonomy/custom need;
- add one optional Request image capability supporting managed upload or validated image URL without creating duplicate media infrastructure;
- add optional full address while preserving city/Houma/location-note and future integration with the existing location/Stadia owner;
- a stored full address is not automatically a public exact-address projection;
- the supplied Request-card design is the locked presentation source of truth: pitch-black canvas, hero image, top-right location pill, sport/community identity, large user title, requester identity, taxonomy chips, description, real metadata, and canonical Whistle composer;
- dark-mode app canvas remains pitch black; blue/yellow/gold are controlled accents, not page backgrounds;
- Play/Athletes/Main Requests continue to project the same canonical `HelpRequest` IDs;
- no duplicate Request, taxonomy, media, location/geocoder, Identity or Whistle systems.

Implementation must first reconcile overlap with in-flight PR #347 and extend the canonical merged RQ-FIX source rather than restarting Requests from an older plan.

### RQ-FIX-5 - Athletes Requests projection

Status: `NOT_STARTED`

Scope:

- Athletes hub becomes Communities | Requests with Communities as default
- existing Communities behavior stays intact
- Requests pane consumes canonical Requests using `surface=ATHLETES`
- no Request persistence/service ownership moves into Athletes

### RQ-FIX-6 - operational hardening

Status: `NOT_STARTED`

Scope:

- reuse canonical `UserPresentationReader` for responder presentation
- batch presentation reads; no N+1 profile lookup
- RequestFeed cursor Load more with deduplication and stale-generation protection
- debounce City/Houma text filters
- resolve identity once rather than on every filter change
- add safe responder presentation against the corrected Request response DTO; pagination/debounce/one-time identity behavior already merged via reconciled PR #340

### RQ-FIX-7 - legacy contract/schema removal

Status: `NOT_STARTED`

Precondition:

- prove no deployed/frontend/API/repository path still depends on legacy category/itemKind
- prove all retained Requests that must survive have valid new taxonomy links
- stop if production contains unresolved legacy rows

Scope after proof:

- remove legacy Request category/itemKind contract paths
- forward migration removes legacy columns/enums
- tighten new taxonomy FKs/nullability as appropriate
- prove responses/lifecycle/expiry survive migration
- never rewrite historical migrations

### RQ-FIX global exclusions

Until a slice explicitly names its narrow integration point, do not change:

```text
Rides behavior
FundMe implementation
Donations implementation
Watch
Pitch
Gamers
Whistle
Teams behavior
Telegram authentication
global navigation
unrelated styling/refactors
```

Play and Athletes changes are limited to their RQ-FIX-4 / RQ-FIX-5 Requests projection surfaces; their existing domain mechanics remain authoritative.

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
