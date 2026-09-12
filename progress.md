# HOOMA implementation progress

This file is a non-authoritative execution and verification log. Product behavior and architecture truth remain in `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, and the applicable ADRs.

## Athletes hardening sequence

Target base: `phase-0-foundation`

Progression gate: each step must score **more than 8/10** under `docs/LIVING_BUILD_PLAN.md` before the next step starts. A score of 9 requires exact-commit deployment to the intended runtime plus live runtime/health evidence.

- [SOURCE COMPLETE] Step A — Athletes authorization boundaries and Photo transaction unit of work
- [SOURCE COMPLETE] Step B — Athletes Photo Board signed delivery optimization
- [ ] Step C — WebSession `lastSeenAt` activity projection and Active Athletes redesign
- [ ] Step D — Whistle older-history access and canonical user-profile navigation

### Step A — Athletes authorization boundaries and Photo transaction unit of work

- Branch: `refactor/athletes-authorization-photo-uow`
- Pull requests: `#268` implementation; `#269` integration-test verification repair.
- Base commit: `ecaecf82e2ab8479ed22d9d7c136f5a54ec4a21a`.
- Final verified implementation commit on `phase-0-foundation`: `2971c532dad40c179a708861e2f4babdee8cccf9`.
- Scope: replace broad/concrete Athletes authorization dependencies with explicit application ports; remove Prisma Photo infrastructure re-entry into `AthletesService`; preserve Founder/member policy, lifecycle row locking, upload recovery intent, Photo deletion outbox cleanup, and all existing user-visible behavior.
- Database migration: none.
- Source review: completed. Authorization direction, transaction/row-lock behavior, recovery intent, deletion outbox behavior, and affected governing documentation were reviewed.
- Verification repair: after `#268` merged, the full CI log exposed two stale PostgreSQL integration tests that still called the removed public Photo repository `create(...)` API. `#269` updated only those tests to use the canonical locked `AthletesPhotoUnitOfWork` + `createPrepared(...)` path used by production code.
- CI: run `#1843` (`34655378436`) passed on exact repair head `fd1a75c10712e30ffdd5898395a04eff09be6e49`: install, Prisma generation/validation/migrate deploy, architecture check, changed-file formatting, changed-source lint, typecheck, package build, unit tests, full build, PostgreSQL integration tests, deploy preflight, security check, and migration status.
- Merge: `#268` merged as `feb3226d6b692140d4231ce899e6bac1704f8bc7`; verification repair `#269` merged as `2971c532dad40c179a708861e2f4babdee8cccf9`.
- Exact-commit runtime deployment: Railway production API deployment `5b1b7887-c4a3-4941-9119-02697cdc10d1` reached `SUCCESS` for commit `2971c532dad40c179a708861e2f4babdee8cccf9`. Railway production Worker deployment `061b7e11-762e-468d-a242-98837885a915` also reached `SUCCESS` for the same commit.
- Runtime/data evidence: production API pre-deploy ran `prisma migrate deploy`, found 42 migrations, and reported no pending migrations; API startup reported `HOOMA API listening on 3000`. Railway HTTP evidence after the deploy showed successful authenticated Athletes Whistle requests with no upstream errors. Worker startup reported the Outbox engine active with two handlers registered, and its production service configuration includes the required `OBJECT_STORAGE_*` variable set used by Athletes Photo cleanup.
- Score: **9/10** under `docs/LIVING_BUILD_PLAN.md`. Source, regression, real PostgreSQL integration, exact-commit production deployment, API runtime traffic, migration state, and Worker startup/configuration are proven. A score of 10 is not claimed because this closeout did not perform a fresh authenticated Photo upload/delete/object-cleanup user-path smoke test in production.
- Progression: Step B was unblocked and has now reached source completion.

### Step B — Athletes Photo Board signed delivery optimization

- Branch: `feat/athletes-photo-signed-delivery`.
- Pull request: `#271`.
- Base commit: `60bf028ca722363d17e1ce47dd6816b78cfd4414`.
- Final source-verification head before merge: `90e6f82f05b3504a5624841e65c6f1e3289dced5`.
- Scope: keep Photo Board metadata private and Athletes-owned while replacing API byte proxying with active-member-authorized, short-lived signed object-storage GET delivery. The browser requests delivery only when a photo approaches the viewport, receives a five-minute bearer URL, and downloads optimized bytes directly from object storage. Founder-only upload/delete policy, server-side WebP optimization, pagination, deletion outbox cleanup, and the canonical metadata schema remain unchanged.
- Storage boundary: `ObjectStorage` remains the shared byte-storage contract for existing domains; signed reads are a separate `ObjectStorageReadUrlSigner` capability implemented by S3 storage so unrelated consumers are not forced into Athletes delivery behavior.
- Database migration: none.
- Verification repair: the full CI ladder first exposed one stale Athletes hardening test that still mocked the removed authenticated byte-proxy route. That test was updated to the signed-delivery contract without changing product behavior. Formatting was then corrected without bypassing or weakening the changed-file format gate.
- CI: run `#1870` (`34661241601`) passed on exact source-verification head `90e6f82f05b3504a5624841e65c6f1e3289dced5`: install, Prisma generation/validation/migrate deploy, architecture check, changed-file formatting, changed-source lint, typecheck, package build, unit tests, full build, PostgreSQL/Redis integration tests, deploy preflight, security check, and migration status.
- Source score: **8/10** under `docs/LIVING_BUILD_PLAN.md`. The bounded vertical slice, authorization boundary, direct signed delivery, regression coverage, real PostgreSQL/Redis integration suite, build/preflight/security gates, and migration state are proven. Exact-commit production deployment and live signed-object delivery evidence were not performed in this task, so a score of 9 is not claimed.
- Progression: Step C remains blocked by the sequence's **more than 8/10** gate until Step B receives exact-commit runtime deployment and live evidence in a separate deployment closeout.

### Step C — WebSession activity and Active Athletes redesign

Not started. Must wait for Step B score > 8/10.

### Step D — Whistle history and canonical user navigation

Not started. Must wait for Step C score > 8/10.
