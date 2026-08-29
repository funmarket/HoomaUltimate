# HOOMA Home/Create-Flow IA Simplification

Status: source verified; PR opened.

This file is the task-specific live execution and handoff ledger for the Home/create-flow information architecture simplification. It records evidence for this branch only. It does not outrank the product owner's latest instruction, `requirements.md`, `structure.md`, `docs/DECISIONS.md`, or `docs/CANONICAL_MODEL.md`.

## Locked Product Contract

Home has exactly six gateways:

```text
HOOMA | Teams | Spots | Pitch | Ride | Requests
```

Required destinations:

```text
HOOMA    -> /hooma
Teams    -> /teams
Spots    -> /places
Pitch    -> /pitch
Ride     -> /rides
Requests -> /requests
```

Bottom navigation remains exactly:

```text
Home | Play | Watch | HOOMA | Pitch
```

The `/hooma` create chooser is exactly:

```text
HOOMA | TEAM | ULTRAS
```

Boundary rules:

- Gamers is removed from the Home gateway grid and HOOMA create chooser only.
- Gamers source, API, contracts, schema, tests and routes remain intact.
- ULTRAS remains unavailable in the create chooser and must not route into Communities or create a `Community.type`.
- Requests is a frontend-only shell in this task.
- FundMe is a Requests page tab at `/requests/fundme`; `/fundme` redirects there.
- Ride is a frontend-only shell at `/rides`.
- No database, Prisma, migration, backend API, or contract expansion is authorized by this task.

## Live Execution State

Last updated: 2026-08-29T12:23:00+01:00

Repository: `funmarket/HoomaUltimate`

Implementation worktree:

```text
C:\Users\GrowB\.codex\visualizations\2026\08\29\01a04ce7-ba5a-7c41-9e99-8a362fcc04cf\product-home-ia-simplify
```

Dirty main checkout: deliberately untouched.

Branch: `product/home-ia-simplify`

Implementation commit:

```text
513c7fef3576c9978c886f13529f34e845f4c67d
```

Current `origin/phase-0-foundation` HEAD:

```text
b32863ea6b60b24821c1286aaf995756f4f17e65
```

PR #159:

```text
MERGED
mergeCommit b32863ea6b60b24821c1286aaf995756f4f17e65
```

Open PR overlap:

```text
No open PRs returned by gh pr list at the latest concurrency check.
```

Pull request:

```text
https://github.com/funmarket/HoomaUltimate/pull/160
```

Working tree status:

```text
Modified source/docs/tests for this task plus new Requests/Rides/ADR/test/fixhome files.
No database, contracts, or API-domain source files are modified.
```

## Documents And Source Inspected

Mandatory governing files re-read before the `fixhome.md` backfill edit:

- `AGENTS.md`
- `docs/LIVING_BUILD_PLAN.md`
- `C:\Users\GrowB\Downloads\fixhome.md`
- `requirements.md` navigation/domain sections
- `structure.md` navigation/domain sections
- `docs/DECISIONS.md`
- `docs/CANONICAL_MODEL.md` frozen future-domain sections

Additional implementation owners inspected:

- `packages/ui/src/home/home-gateways.ts`
- `packages/ui/src/home/HomeGatewayGrid.tsx`
- `packages/ui/src/home/HomeGatewayCard.tsx`
- `apps/web/src/home/HomePage.tsx`
- `packages/frontend/src/communities/HoomaPage.tsx`
- `packages/frontend/src/index.ts`
- `packages/frontend/scripts/copy-css.mjs`
- `apps/web/src/app/router/HoomaRouter.tsx`
- `packages/ui/src/navigation/HoomaBottomNav.tsx`
- relevant Home/router/create-flow tests

## Changed Files

- `apps/web/src/app/router/HoomaRouter.tsx`
- `docs/ASSET_MANIFEST.md`
- `docs/DECISIONS.md`
- `docs/HOME_BRAND_SPEC.md`
- `docs/adr/ADR-048-home-create-flow-ia.md`
- `fixhome.md`
- `packages/frontend/src/communities/HoomaPage.tsx`
- `packages/frontend/src/index.ts`
- `packages/frontend/src/requests/RequestsPage.tsx`
- `packages/frontend/src/requests/requests.css`
- `packages/frontend/src/rides/RidesPage.tsx`
- `packages/frontend/src/rides/rides.css`
- `packages/ui/src/home/home-gateways.ts`
- `progress.md`
- `requirements.md`
- `structure.md`
- `tests/frontend-router.test.mjs`
- `tests/home-gateway-image-loading.test.mjs`
- `tests/hooma-create-chooser.test.mjs`
- `tests/navigation-contract.test.mjs`
- `tests/requests-rides-shell.test.mjs`

## Slice Ledger

Earlier slice entries in this section are reconstructed/backfilled from this execution session. They were not written contemporaneously after each slice.

### Slice 0 - Refresh, concurrency check, and baseline

Status: `[x]` reconstructed/backfilled.

Branch: `product/home-ia-simplify`

Base compared:

```text
origin/phase-0-foundation b32863ea6b60b24821c1286aaf995756f4f17e65
```

Evidence:

- Main checkout at `C:\Users\GrowB\Desktop\HOOMAulimate` had mass deleted files and was behind remote; it was deliberately not used for implementation.
- Clean worktree created at `product-home-ia-simplify` from post-PR #159 base.
- `gh pr view 159` shows PR #159 merged into `b32863ea6b60b24821c1286aaf995756f4f17e65`.
- `gh pr list --state open` returned `[]` during the latest concurrency check.
- `git fetch origin phase-0-foundation` completed before the latest concurrency check.
- Current implementation HEAD and `origin/phase-0-foundation` are the same pre-commit SHA, `b32863ea6b60b24821c1286aaf995756f4f17e65`.

New findings:

- Planning snapshot `00a9d44cac3c389040308c21a49e4e600dea3f7a` was stale because PR #159 had merged.
- The current base already includes PR #159.
- No currently open PR overlaps this task.

### Slice 1 - Governing documentation and ADR

Status: `[x]` reconstructed/backfilled.

Files changed:

- `requirements.md`
- `structure.md`
- `docs/DECISIONS.md`
- `docs/HOME_BRAND_SPEC.md`
- `docs/ASSET_MANIFEST.md`
- `docs/adr/ADR-048-home-create-flow-ia.md`
- `progress.md`
- `fixhome.md`

Evidence:

- `docs/adr` numbering was checked before adding the ADR; ADR-048 was the next unused number for this task.
- `requirements.md` now locks six Home gateways and the `HOOMA | TEAM | ULTRAS` chooser.
- `structure.md` now records the 3 x 2 Home layout, Requests/FundMe routing, Ride shell, and retained Gamers routes.
- `docs/DECISIONS.md` records ADR-048 and limits the supersession of ADR-036/ADR-038 to Home/create IA plus Requests/Ride frontend shells/routes.
- `docs/HOME_BRAND_SPEC.md` and `docs/ASSET_MANIFEST.md` now describe six active Home cards while retaining old artwork as retained/future assets.
- `docs/CANONICAL_MODEL.md` was audited and not changed because future Requests, Ride, FundMe, Payments and ULTRAS persistence remain frozen.

### Slice 2 - Home gateway source and tests

Status: `[x]` reconstructed/backfilled.

Files changed:

- `packages/ui/src/home/home-gateways.ts`
- `tests/navigation-contract.test.mjs`
- `tests/home-gateway-image-loading.test.mjs`

Evidence:

- `HOME_GATEWAYS` now contains exactly `hooma`, `teams`, `spots`, `pitch`, `ride`, `requests`.
- Labels are exactly `HOOMA`, `Teams`, `Spots`, `Pitch`, `Ride`, `Requests`.
- Hrefs are exactly `/hooma`, `/teams`, `/places`, `/pitch`, `/rides`, `/requests`.
- Subtitles are exactly `Community`, `Manage squads`, `Cafés & lounges`, `Find a pitch`, `To the match`, `Gear and support`.
- Bottom navigation tests remain intact and still enforce `Home | Play | Watch | HOOMA | Pitch`.

### Slice 3 - HOOMA create chooser

Status: `[x]` reconstructed/backfilled.

Files changed:

- `packages/frontend/src/communities/HoomaPage.tsx`
- `tests/hooma-create-chooser.test.mjs`

Evidence:

- `CreationType` is exactly `"HOOMA" | "TEAM" | "ULTRAS"`.
- `CREATION_ORDER` is exactly `["HOOMA", "TEAM", "ULTRAS"]`.
- `GAMERS` was removed from the chooser only.
- `ULTRAS` remains `available: false` and `href: null`.
- No `CommunityType` was introduced.
- HOOMA creation still uses the existing Communities-owned create path and returns to `/hooma`.

### Slice 4 - Requests shell and FundMe tab

Status: `[x]` reconstructed/backfilled.

Files changed:

- `packages/frontend/src/requests/RequestsPage.tsx`
- `packages/frontend/src/requests/requests.css`
- `tests/requests-rides-shell.test.mjs`

Evidence:

- `RequestsPageTab` is exactly `"requests" | "fundme"`.
- Page-local tabs are `Requests | FundMe`.
- `/requests/fundme` renders the FundMe tab.
- The shell has no `fetch`, API client, donation form, amount entry, payment form, fake claim, fake request listing, or backend pretence.

### Slice 5 - Ride shell

Status: `[x]` reconstructed/backfilled.

Files changed:

- `packages/frontend/src/rides/RidesPage.tsx`
- `packages/frontend/src/rides/rides.css`
- `tests/requests-rides-shell.test.mjs`

Evidence:

- `RidesPage` is a standalone frontend shell.
- It does not list drivers, request location access, create bookings, use geolocation, call `fetch`, or create an API dependency.

### Slice 6 - Frontend exports and routes

Status: `[x]` reconstructed/backfilled.

Files changed:

- `packages/frontend/src/index.ts`
- `apps/web/src/app/router/HoomaRouter.tsx`
- `tests/frontend-router.test.mjs`

Evidence:

- Frontend barrel imports `requests/requests.css` and `rides/rides.css`.
- Frontend barrel exports `RequestsPage` and `RidesPage`.
- Router registers `/requests`, `/requests/fundme`, `/rides`.
- Router redirects `/fundme` to `/requests/fundme` with `replace`.
- Router retains `/gamers` and `/gamers/games/:gameSlug`.
- No `/ultras` route was added.

### Slice 7 - Drift sweep and no-database proof

Status: `[x]` reconstructed/backfilled.

Evidence:

- `git diff --name-only -- packages/database` returned empty.
- `git diff --name-only -- packages/contracts` returned empty.
- `git diff --name-only -- apps/api/src/modules` returned empty.
- `rg -n "All nine|9 primary|3 x 3|3x3|nine-card|nine card|exactly nine|eight containers|eight primary" docs/ASSET_MANIFEST.md docs/HOME_BRAND_SPEC.md requirements.md structure.md progress.md tests` returned only ledger command text after the implementation docs were reconciled.
- Gamers route tests remain present and Gamers source was not changed.
- Bottom navigation source was not changed.

### Slice 8 - Verification and final concurrency review

Status: `[x]` source verified and PR opened.

PASS:

- `node --test tests/navigation-contract.test.mjs tests/home-gateway-image-loading.test.mjs tests/frontend-router.test.mjs tests/hooma-create-chooser.test.mjs tests/requests-rides-shell.test.mjs` passed 11/11.
- Chunked non-integration unit run using the same file inclusion/exclusion rule as `scripts/run-tests.mjs` passed 160/160.
- `npm run architecture:check` passed.
- `npm run db:generate` passed after approved network access to download the Prisma engine.
- `DATABASE_URL=postgresql://user:pass@localhost:5432/hooma_validation npm run db:validate` passed.
- `npm run typecheck` passed after local Prisma client generation.
- `npm run build` passed with Vite's existing large chunk warning.
- `npm run deploy:preflight` passed.
- `git diff --check` passed with line-ending warnings only.
- Touched-file Prettier check passed.
- Targeted ESLint check for changed TS/TSX files passed.

BASELINE FAILURE - NOT INTRODUCED BY `product/home-ia-simplify`:

- In a separate untouched baseline worktree at `b32863ea6b60b24821c1286aaf995756f4f17e65`, `npm run format:check` failed on 380 files.
- In the same baseline worktree, `npm run lint` failed on `apps/api/src/modules/platform-admin/application/platform-admin.authorizer.ts` with `@typescript-eslint/no-empty-object-type`.

STANDARD TEST HARNESS DID NOT EXECUTE:

- `npm test` failed before executing tests with Windows `spawn EINVAL` from `scripts/run-tests.mjs`.
- The wrapper was inspected and it selects non-integration files ending with `.test.ts` or `.test.mjs`, excluding `.integration.test.ts`.
- The equivalent non-integration file set was then run in smaller `npx tsx --test` chunks and passed 160/160.

NOT VERIFIED:

- No live deployment was created.
- No browser/UI smoke test was run against a local or deployed server.
- Integration tests were not run because this IA-only task does not add database/backend behavior and no disposable integration infrastructure was required for the changed slice.

## Final Pre-Commit Checklist

- [x] Home gateway count exactly six.
- [x] Home gateway order exactly `HOOMA`, `Teams`, `Spots`, `Pitch`, `Ride`, `Requests`.
- [x] Home gateway hrefs exactly `/hooma`, `/teams`, `/places`, `/pitch`, `/rides`, `/requests`.
- [x] Bottom navigation unchanged.
- [x] HOOMA create chooser exactly `HOOMA`, `TEAM`, `ULTRAS`.
- [x] `GAMERS` removed only from Home/create discovery.
- [x] Gamers routes preserved.
- [x] No `/ultras` implementation added.
- [x] No `CommunityType` or `Community.type` added.
- [x] Requests/FundMe shell has no backend/API/persistence/payment behavior.
- [x] Ride shell has no backend/API/persistence/location/booking behavior.
- [x] `packages/database` diff empty.
- [x] `packages/contracts` diff empty.
- [x] `apps/api/src/modules` diff empty.
- [x] Open PR list checked and empty before final commit preparation.

## Remaining Work

- Review PR #160.
- Do not merge until the product owner explicitly approves merge.

## Implementation Score

Current score: 8/10.

Reason: complete source-level IA implementation with strong focused/unit/static/build/preflight evidence and baseline proof for repo-wide formatter/lint failures. Not 10/10 because no live deployment or browser end-to-end smoke verification was performed, and standard `npm test` wrapper still fails before execution on Windows.

Next issue started: No.
