# HOOMA — RIDE / REQUESTS / FUNDME LIVE IMPLEMENTATION PLAN

Status: **ACTIVE SCOPED EXECUTION PLAN**  
Repository: `funmarket/HoomaUltimate`  
Target branch: `phase-0-foundation`  
Plan refreshed: **2026-09-01**  
Foundation HEAD at refresh: `6ca765128aa4576d02af787374684575d11d35ed`  
Product name: **HOOMA**

> This is the live execution ledger for Ride, Requests, and later FundMe/Payments work. It does not replace `AGENTS.md`, `docs/LIVING_BUILD_PLAN.md`, `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, or accepted ADRs. Merged `phase-0-foundation` is current product truth. Open PRs are **in-flight only** until merged and read back.

---

# 0. Mandatory execution discipline

Every agent working from this plan must:

1. Read `AGENTS.md` and `docs/LIVING_BUILD_PLAN.md`.
2. Read the relevant current product/architecture sources: `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, and applicable ADRs.
3. Fetch latest `phase-0-foundation` and record its exact SHA before editing.
4. Inspect every open PR and overlapping branch before taking ownership.
5. Trace the complete applicable path before writing:

   ```text
   UI / state
   -> frontend domain client
   -> contracts
   -> HTTP route
   -> auth/authz
   -> application service / policy
   -> repository port
   -> infrastructure repository
   -> Prisma schema + committed migration
   -> PostgreSQL / object storage / Redis / Worker as applicable
   -> runtime / Railway
   ```

6. Fix the authoritative owner. Do not patch only a screen when the defect is server/persistence/domain policy.
7. Do not create duplicate tables, services, repositories, contracts, state owners, feed copies, or generic cross-domain catch-alls.
8. Re-check foundation and overlapping PRs before commit and before merge.
9. Keep open-PR behavior marked `[~] IN PROGRESS`. Only merged/read-back behavior may be `[x] DONE`.
10. Do not claim completion from source inspection or green CI alone when the task requires migration, PostgreSQL, object-storage, runtime, mobile, or authorization proof.

Status notation:

- `[ ] TODO`
- `[~] IN PROGRESS`
- `[!] BLOCKED`
- `[x] DONE`
- `[-] DEFERRED`

---

# 1. Current repository state at this refresh

## Foundation truth

`phase-0-foundation` is:

```text
6ca765128aa4576d02af787374684575d11d35ed
```

That commit merged PR #209:

```text
feat(rides): project community Ride requests into HOOMA NOW
```

PR #209 head:

```text
10c143a6424975b86fc722634ea8f744faf2e83f
```

PR #209 exact-head CI passed before merge.

## Active overlapping work

At this refresh there are no open PRs targeting `phase-0-foundation`.

PR #210 has merged and is now foundation truth:

```text
PR #210
fix(rides): repair community interaction, mobile audience, and owner edits
branch: fix/rides-community-interaction-mobile-manage
final head: c0670bd10f35bacd315727d792e3a93c0458fdcd
merge commit: 43dde47b9ce4466a52e01faf3a1dc4f5a592e818
state: MERGED
exact-head check: verify SUCCESS
```

PR #231 has also merged and moved `phase-0-foundation` forward:

```text
PR #231
feat(play): upgrade formation builder pitch without changing two-team flow
final head: 05b9ad8869fb031dcae2dadf4b9c8559b86013bf
merge commit: 525b3b6b842bca5892c74cf213e982e3a0385fa0
state: MERGED
exact-head check: verify SUCCESS
```

Do not reopen PR #210 or rebuild its Ride work. Current Ride work resumes from the merged foundation state.

---

# 2. Locked domain ownership

| Concept                                                                                  | Canonical owner                                        |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| User identity / presentation                                                             | Identity                                               |
| HOOMA Community + membership                                                             | Communities                                            |
| Event / Match-Day activity                                                               | Events / Play / Watch according to existing boundaries |
| Physical venue identity                                                                  | Places                                                 |
| RideOffer, RideRequest, RideParticipation, RideMeetingPoint, Ride vehicle-photo metadata | **Rides**                                              |
| Help/resource Request + RequestClaim                                                     | **Requests**                                           |
| FundraiserCampaign + FundraiserContribution                                              | **Fundraising**                                        |
| Payment intent/provider/idempotency/settlement                                           | **Payments**                                           |
| Managed binary Ride photo bytes                                                          | Object storage through `@hooma/storage`                |
| HOOMA NOW / Discovery composition                                                        | Presentation/read model only                           |
| Whistle body/retention/quota                                                             | Existing **Whistle** domain                            |

Dependency rule:

```text
http -> application -> domain
infrastructure -> application/domain ports
bootstrap/container -> concrete implementations
```

Forbidden shortcuts include:

```text
CommunityRideRequest copy tables
GenericPost / GenericAction / GenericRequest
CommunityActionService
SocialService
cross-domain Prisma repository imports
HTTP -> Prisma business logic
Ride -> Requests infrastructure
Requests -> Rides infrastructure
Requests -> Fundraising/Payments persistence
Discovery/HOOMA NOW -> canonical Ride writes
```

Ride Request and the top-level Requests product are separate concepts:

```text
RideRequest = passenger needs transportation
Request     = user/community needs gear, resource, or support
```

They must not share a generic Request table/service merely because both use the word “request”.

---

# 3. Locked Ride product rules now in foundation

## Ride contexts

```text
MATCHDAY -> Matchday Ride
GENERAL  -> Anywhere Ride
```

Both remain one Ride domain, one repository family, one API family, and one persistence model.

## Compensation

Ride may advertise:

```text
FREE
CASH
```

Ride does not execute payment. No checkout, settlement, card processing, or fake paid state belongs in Ride.

Current governed cash currencies implemented in the Ride slice are `TND`, `EUR`, and `USD`, using integer minor-unit conversion.

## RideRequest audience

User-facing choices are exactly:

```text
Everyone
One of my HOOMAs
All my HOOMAs
```

Persistence rules:

- `Everyone` -> `audienceScope = GLOBAL`, zero Community audience rows.
- `One of my HOOMAs` -> `audienceScope = COMMUNITY`, exactly one explicit Community target.
- `All my HOOMAs` -> write command only. The server resolves current active memberships and persists exact target rows. No permanent `ALL_MY_HOOMAS` flag exists.
- Later Community joins do not expand an existing RideRequest automatically.
- Browser membership lists are UX only; server membership is authorization authority.

## HOOMA NOW projection

Accepted ADR:

```text
docs/adr/ADR-052-community-ride-requests-hooma-now.md
```

Canonical rule:

> A Community-scoped RideRequest is one Ride-owned canonical request whose current active state is projected into HOOMA NOW for explicitly authorized HOOMA Communities; Community and HOOMA NOW never copy, own, or independently manage that RideRequest.

A Community Ride request appears in a Community's HOOMA NOW only when all applicable conditions are true:

```text
audienceScope = COMMUNITY
explicit audience target includes that Community
RideRequest.status = OPEN
expiresAt > now
Community is ACTIVE
requester is still an active member of that Community
viewer is an active member of that Community
```

Community-scoped requests must remain excluded from public Ride request discovery and public exact-ID detail.

A request becoming `MATCHED`, `CANCELLED`, `EXPIRED`, or `COMPLETED`, or passing `expiresAt`, must disappear from the active HOOMA NOW projection without creating/deleting a second Community-owned Ride record.

## Ride exact-location privacy

Exact meeting-point data is private by server policy. It may be read only by authorized Ride parties according to the accepted participation lifecycle. Public Ride/HOOMA NOW projection exposes only privacy-safe area/destination information.

## Ride vehicle media

- binary bytes live in object storage;
- Ride owns `RideOfferVehiclePhoto` metadata;
- no Prisma `Bytes`, base64, generic MediaAsset, or public bucket credentials;
- public serving remains through Ride-authorized API delivery;
- replacement/delete must preserve metadata/object consistency;
- remaining provider-level reconciliation hardening belongs to `RIDE-009`.

---

# 4. Current Ride task ledger

## PLAN-000 / GOV-001 / RIDE-001 through RIDE-006 / ARCH-RIDE-001

Status: **[x] DONE**

These slices established Ride governance, contracts, Prisma persistence/migrations, concurrency-safe repositories, application authorization, transport-neutral Ride errors, HTTP routes/bootstrap wiring, and Ride vehicle-photo storage.

Historical evidence remains in merged PR history. Do not reopen these tasks unless a current regression proves the original invariant is broken.

---

## RIDE-007 — Real Ride frontend vertical slice

Status: **[~] IN PROGRESS**

This umbrella remains open because later product corrections expanded acceptance beyond the original frontend merge.

Already merged capabilities include:

- real Ride frontend API client and routes;
- Ride offers list/detail/create;
- Ride request create;
- participation and owner-management paths from prior Ride slices;
- vehicle photo UI;
- Matchday/Anywhere context;
- FREE/CASH compensation;
- mobile Ride hub;
- authenticated My Rides server readback;
- Community-scoped RideRequest audience;
- Community HOOMA NOW projection.

Do **not** rewrite merged working slices simply because this umbrella is still open.

RIDE-007 can close only after:

1. `RIDE-007C` final acceptance audit passes;
2. `RIDE-007D` is complete;
3. `RIDE-007E` remains verified as merged foundation truth;
4. `RIDE-007F` remains verified as merged foundation truth;
5. final mobile/Web/Telegram-safe Ride smoke finds no unresolved defect in the assigned Ride scope.

---

## RIDE-007A — Ride context + compensation governance/contracts

Status: **[x] DONE**

Merged foundation behavior defines `MATCHDAY | GENERAL` and advertised `FREE | CASH` terms while Payments remains separate.

---

## RIDE-007B — Ride context/compensation persistence + API

Status: **[x] DONE**

Merged persistence/API support includes Ride context filters and canonical FREE/CASH read/write behavior.

---

## RIDE-007C — Mobile Ride hub + Matchday/Anywhere/My Rides UX

Status: **[~] IN PROGRESS — CLOSEOUT AUDIT, NOT REIMPLEMENTATION**

Merged work now includes:

- PR #204 mobile Ride hub;
- PR #205 explicit context/compensation form completion;
- PR #207 authenticated actor-owned My Rides server readback;
- PR #208 Ride context tiles routing to the Ride request form while preserving `/rides/matchday` and `/rides/anywhere` routes.

PR #207:

```text
head: 84cc66f34bb35c4c50b20bb262313e6a9faf3fc3
merge: 6dc7cebfb03be01281d41fc0470d8bc4dd261f17
```

PR #208:

```text
head: d4559704c2af8aabb01a3a3355e9c2e24684a1dd
merge: f53c6b2564637feab916a28b3099999e69d9bfa2
```

The plan must no longer say `/rides/mine` is missing; that blocker was resolved by PR #207.

Remaining RIDE-007C work is evidence/acceptance only unless a failing test or runtime defect proves a source correction is required:

- now that PR #210 is merged, run phone-width smoke at minimum 360/390/430;
- verify `/rides`, `/rides/matchday`, `/rides/anywhere`, `/rides/request`, `/rides/offers`, `/rides/offers/new`, offer detail/manage/edit, request edit, and `/rides/mine`;
- prove no horizontal overflow/runtime exception;
- prove My Rides reconstructs from authenticated server readback, not browser memory;
- prove vehicle photos remain contained/uncropped according to current Ride styling;
- preserve bottom nav `Home | Play | Watch | HOOMA | Pitch`.

If those gates pass after #210, mark RIDE-007C DONE without rebuilding it.

---

## RIDE-007D — Privacy-safe static Ride maps

Status: **[ ] TODO**

Goal: add static Ride map previews only through a privacy-safe server-side boundary.

Required work:

- inspect existing map/provider abstractions before creating one;
- use only approximate/public-safe inputs for public Ride map previews;
- exact meeting-point map generation requires driver/accepted-passenger authorization;
- provider credentials remain server-side;
- no private exact coordinates in client props, public provider URLs, analytics, public caches, or public Vite variables;
- document attribution/caching/private-map rules;
- polished fallback when coordinates are unavailable.

Forbidden:

- live tracking;
- background GPS;
- turn-by-turn navigation;
- PostGIS route engine merely for decoration;
- client-side private lat/lng map construction.

DONE gate:

- authorization regressions prove outsiders cannot obtain exact meeting-point maps;
- accepted passenger/driver can obtain the authorized exact preview;
- public map previews are privacy-safe;
- provider/config/runtime path is proven.

---

## RIDE-007E — Community-scoped RideRequest audience + HOOMA NOW projection

Status: **[x] DONE**

Merged by PR #209.

Evidence:

```text
PR: #209
head: 10c143a6424975b86fc722634ea8f744faf2e83f
merge: 6ca765128aa4576d02af787374684575d11d35ed
CI: exact-head success before merge
ADR: docs/adr/ADR-052-community-ride-requests-hooma-now.md
```

Merged behavior:

- GLOBAL vs COMMUNITY audience persistence;
- exact Community audience join rows;
- server-resolved `ALL_CURRENT` write command;
- Community membership validation;
- no public leak of Community-scoped RideRequests;
- owner My Rides readback includes audience information;
- Community member-only Ride read path;
- canonical RideRequest projected into existing HOOMA NOW;
- no Community-owned copy/feed table/lifecycle.

The post-#209 interaction/UI defects were isolated under `RIDE-007F` / PR #210 and are now merged. Do not revert `RIDE-007E` to TODO or rebuild its source unless fresh failing proof identifies a new defect.

---

## RIDE-007F — Community Ride interaction + mobile SHARE WITH + owner edit correction

Status: **[x] DONE**

Merged implementation:

```text
PR #210
branch: fix/rides-community-interaction-mobile-manage
final head: c0670bd10f35bacd315727d792e3a93c0458fdcd
merge commit: 43dde47b9ce4466a52e01faf3a1dc4f5a592e818
mergedAt: 2026-09-01T15:31:57Z
exact-head check: verify SUCCESS
```

Verified foundation source now contains the corrective outcomes below:

1. A HOOMA NOW Community Ride card must not send the member to a generic Ride landing page.
2. The existing HOOMA NOW item expands the exact canonical RideRequest in place.
3. Expansion reads requester presentation through a Ride-owned member-authorized interaction path and canonical Identity/UserPresentation boundary.
4. Direct response reuses the existing direct-user Whistle capability; no Ride chat/message persistence is introduced.
5. `SHARE WITH` removes duplicated audience-question UI and is phone-first one-column, expanding only at larger widths.
6. My Offers exposes owner `Edit` and `Manage` actions.
7. My Requests exposes owner `Edit`.
8. Offer/Request edits reuse canonical forms and existing PATCH routes; editing never creates replacement duplicate Ride records.
9. Request audience PATCH is omitted unless the owner explicitly changes SHARE WITH so exact persisted Community targets are preserved.
10. Authorization remains server-side for Community interaction and owner management.

Merged PR #210 changed-file scope included Ride application/infrastructure/http interaction code, Ride frontend form/mine/API code, HOOMA NOW presentation, direct Whistle client reuse, router/container wiring, contracts, UI, and focused tests.

Read-back anchors in current foundation:

- `apps/web/src/app/router/HoomaRouter.tsx` registers owner edit routes for `/rides/requests/:requestId/edit` and `/rides/offers/:offerId/edit`.
- `packages/frontend/src/rides/RideRequestCreatePage.tsx` reuses the canonical request form for create/edit and omits audience PATCH unless SHARE WITH changes.
- `packages/frontend/src/rides/RideMinePage.tsx` reads My Rides from `/api/v1/rides/mine` and exposes owner edit/manage links.
- `packages/frontend/src/discovery/HoomaNowSection.tsx` expands Community RideRequest cards in-place and keeps HOOMA NOW as projection UI.
- `apps/api/src/modules/rides/http/ride.routes.ts` exposes member-owned manage/update/cancel endpoints and Community request feed endpoints through Ride service authorization.

---

# 5. Requests product — current state and execution plan

The top-level Requests product remains an honest shell in foundation.

Current truth:

- `/requests` exists;
- `/requests/fundme` exists as a tab/shell;
- there is no completed Requests domain vertical slice;
- there is no canonical `apps/api/src/modules/requests` implementation yet;
- Request creation, claiming, quantity allocation, fulfillment, and persistence must not be faked in frontend state;
- FundMe remains separate from Requests persistence.

Requests should begin only after `RIDE-007C` closeout and `RIDE-007D` map work are resolved or explicitly deferred. Do not mix Requests implementation into remaining Ride closeout/map work.

---

## REQ-001 — Requests governance + contracts/domain policy

Status: **[ ] TODO**

Goal: establish the exact Requests product contract before persistence.

Required work:

```text
packages/contracts/src/requests.ts
apps/api/src/modules/requests/domain/*
apps/api/src/modules/requests/application/*
```

Required decisions/proof:

- Request means help/resource support, not transportation and not fundraising;
- define canonical lifecycle/status vocabulary;
- define quantity/unit/expiry behavior;
- confirm whether partial claims are allowed under current governance;
- define privacy-safe public projection;
- define requester/claimer capabilities and terminal transitions;
- Community/Event/Place references only where current product behavior truly requires them;
- no generic post/feed model;
- no Ride/Fundraising/Payments imports.

DONE gate:

- contracts and policies compile/test;
- governing docs agree;
- no persistence is added unless separately authorized with REQ-002.

---

## REQ-002 — Requests Prisma schema + committed migration

Status: **[ ] TODO**

Dependencies: `REQ-001`

Goal: create only canonical Requests persistence.

Expected canonical concepts:

```text
Request
RequestClaim
```

Required work:

- canonical User references;
- approved optional Community/Event/Place references only if governed;
- quantity/unit/expiry/lifecycle fields;
- claim relationship and idempotency/concurrency constraints;
- deliberate indexes for public/member/owner/claim reads;
- bounded committed migration;
- docs/schema/migration consistency.

Forbidden:

- Ride tables;
- Fundraising tables;
- Payment tables;
- generic JSON action/request blobs.

DONE gate:

- clean disposable PostgreSQL migration deploy/status/readback;
- schema tests and canonical-model docs agree.

---

## REQ-003 — Requests repository + concurrency-safe claim lifecycle

Status: **[ ] TODO**

Dependencies: `REQ-002`

Goal: implement canonical Request/RequestClaim persistence with database-safe allocation.

Required PostgreSQL proof:

- concurrent claims cannot exceed remaining quantity;
- release restores availability where policy permits;
- expired/cancelled/terminal Requests reject new claims;
- duplicate retries do not create uncontrolled duplicate state;
- remaining quantity derives from canonical RequestClaim state;
- terminal transitions cannot be rewritten for convenience.

No frontend counter may be the authority for remaining quantity.

---

## REQ-004 — Requests application/authz + HTTP APIs

Status: **[ ] TODO**

Dependencies: `REQ-003`

Goal: expose Requests through the established public/member boundary.

Required work:

- actor identity from canonical auth;
- privacy-safe public list/detail;
- authenticated create/edit/cancel;
- claim/release/complete according to REQ-001 policy;
- stable Requests-owned error codes;
- bounded Requests router/container wiring;
- server-side owner/claimer authorization;
- API -> service -> repository -> PostgreSQL readback tests.

No FundMe backend belongs here.

---

## REQ-005 — Requests frontend real vertical slice

Status: **[ ] TODO**

Dependencies: `REQ-004`

Goal: replace only the Requests tab shell with the real Requests product.

Required work:

```text
packages/frontend/src/requests/api.ts
Requests feed
Request detail
Create Request
claim / release / complete UI per policy
quantity remaining
loading / empty / error / pending / success / terminal states
```

Preserve:

```text
Requests | FundMe
```

Opening Requests must not load Fundraising/Payments merely because the FundMe tab is visible.

DONE gate:

- phone/Web action -> Requests API -> authz -> service -> repo -> PostgreSQL -> readback proven;
- 360/390/430 mobile and Telegram-safe behavior checked;
- FundMe remains an honest shell until its own owning domains are authorized.

---

# 6. Later Ride / Discovery / Payment tasks

## RIDE-008 — Ride matching V1

Status: **[ ] TODO**

Dependencies: completed core Ride frontend and map/privacy decisions as applicable.

Use deterministic Ride-owned matching from canonical Ride facts such as context, destination/Event compatibility, time window, area/waypoint compatibility, required seats, and active status.

No generic RecommendationService and no speculative geospatial monolith.

---

## RIDE-009 — Ride media cleanup/reconciliation hardening

Status: **[ ] TODO**

Goal: close remaining provider-level stale-object/reconciliation/runtime observability risk from the otherwise-complete Ride media slice.

Do not create a giant generic cleanup script. Use bounded Ride-owned object prefix/metadata/outbox/worker behavior after tracing current facilities.

---

## RIDE-010 — Ride reliability/confirmation lifecycle

Status: **[ ] TODO**

Goal: add only product-owner-confirmed completion/cancellation/confirmation facts that can support real derived reliability.

No global `User.rating` shortcut and no invented review facts.

---

## DISC-001 — Ride + Requests discovery / Match-Day projections

Status: **[ ] TODO**

Dependencies: `REQ-005` and the required Ride owner slices.

Discovery is projection only. It must not own copied Ride/Request rows or generic JSON feed records.

---

## PAY-001 — Payments separate authorization/design

Status: **[ ] TODO**

Initial rails remain:

```text
CASH
TELEGRAM_STARS
```

Payments owns payment intents, provider state, idempotency, callbacks, and settlement. It does not own Ride, Request, or Fundraising records.

No credit cards are implied by this plan.

---

## FUND-001 — Fundraising/FundMe separate vertical slice

Status: **[ ] TODO**

Dependencies: `PAY-001` plus explicit product-owner authorization.

`/requests/fundme` remains the UI entry, but persistence/client/service ownership belongs to Fundraising, not Requests.

---

## WHISTLE-RIDE-001 — Ride-context Whistle authorization bridge

Status: **[ ] TODO**

This future task is distinct from PR #210's direct-user Whistle reuse.

PR #210 may reuse the already-existing direct-user Whistle capability to let a Community member contact a Ride requester. That does **not** authorize a new Ride chat, Ride message table, or a general Ride-context Whistle board.

Any future Ride-context Whistle bridge still requires explicit authorization and must preserve shared Whistle quota/retention/transient-body rules.

---

# 7. Current recommended execution order

PR #210 is merged. Do not start a second overlapping correction for the same scope unless a new failing proof identifies a real source defect.

Current order:

```text
1. RIDE-007C closeout audit
   - no rewrite of already-merged My Rides/mobile work
   - run final 360/390/430 route/mobile acceptance after #210
   - mark DONE only if its existing gate passes

2. RIDE-007D
   - privacy-safe static maps

3. RIDE-007 umbrella closeout
   - reconcile A/B/C/D/E/F
   - final Ride vertical-slice proof

4. REQ-001
5. REQ-002
6. REQ-003
7. REQ-004
8. REQ-005

9. RIDE-008 matching
10. RIDE-009 media hardening
11. RIDE-010 reliability
12. DISC-001
13. PAY-001 when authorized
14. FUND-001 when authorized
15. WHISTLE-RIDE-001 when separately authorized
```

Independent later tasks may be reordered only after checking file/domain overlap and product-owner priority. Do not infer permission to run simultaneous schema/router/frontend changes against the same sources.

---

# 8. Verification ladder for every remaining task

Use the strongest applicable proof:

```text
source re-read
architecture/docs reconciliation
touched-file Prettier
changed-source lint
architecture:check
typecheck
package/app builds
focused unit/regression tests
npm test
real disposable PostgreSQL integration when persistence/concurrency is involved
db:generate
db:validate
db:migrate:deploy
db:migrate:status
object-storage/Worker proof when media is involved
mobile/browser route smoke where UI is involved
exact-head GitHub CI
merge with expected-head protection
post-merge foundation readback
```

Canonical repository commands where applicable:

```text
npm ci
npm run db:generate
npm run db:validate
npm run db:migrate:deploy
npm run architecture:check
npm run typecheck
npm run build:packages
npm test
npm run build
npm run test:integration
npm run deploy:preflight
npm run security:check
npm run db:migrate:status
git diff --check
```

Do not use a production Railway database casually for migration verification. Prefer the repository's disposable PostgreSQL/CI path unless an explicitly authorized live-runtime verification requires otherwise.

---

# 9. Stop conditions

Stop and report instead of improvising if:

- `phase-0-foundation` moves with overlapping changes after ownership begins;
- another agent opens an overlapping Ride or Requests schema/API/UI PR;
- a new open PR appears that touches the same Ride/HOOMA NOW/Whistle/mobile/manage sources;
- Community Ride interaction would require a second RideRequest copy or Community-owned lifecycle;
- Requests implementation starts depending on Ride/Fundraising/Payments persistence;
- exact Ride meeting information would become public;
- quantity/seat correctness depends on frontend counters instead of database invariants;
- a static-map approach exposes private coordinates or provider secrets client-side;
- a media fix requires PostgreSQL blobs/base64 or a generic Media monolith;
- completion can only be claimed by skipping required PostgreSQL, authz, migration, storage, mobile, or exact-head CI proof.

---

# 10. Definition of current success

The authorized Ride/Requests program is not complete until:

```text
Ride canonical lifecycle remains single-source and privacy-safe.
Community-scoped RideRequests work through one canonical RideRequest and HOOMA NOW projection.
PR #210 corrective interaction/mobile/manage behavior remains merged and verified.
RIDE-007C acceptance is closed without stale-plan reimplementation.
Privacy-safe Ride maps are complete or explicitly deferred by the product owner.
Requests owns a real Request + RequestClaim vertical slice.
Requests claims are concurrency-safe in PostgreSQL.
Fundraising and Payments remain separately owned.
Discovery remains projection-only.
Whistle remains one shared transient engine.
No cross-domain monolith or duplicate source of truth was introduced.
Every DONE task is merged, verified, and read back from foundation.
```

Until then, report the exact incomplete task ID instead of declaring Ride/Requests/FundMe globally complete.
