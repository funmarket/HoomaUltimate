# HOOMA implementation progress

This file is a non-authoritative execution and verification log. Product behavior and architecture truth remain in `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, and the applicable ADRs.

## Athletes hardening sequence

Target base: `phase-0-foundation`

Progression gate: each step must score **more than 8/10** under `docs/LIVING_BUILD_PLAN.md` before the next step starts. A score of 9 requires exact-commit deployment to the intended runtime plus live runtime/health evidence.

- [COMPLETE] Step A — Athletes authorization boundaries and Photo transaction unit of work
- [COMPLETE] Step B — Athletes Photo Board signed delivery optimization
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
- Progression: Step B was unblocked and is now complete.

### Step B — Athletes Photo Board signed delivery optimization

- Branch: `feat/athletes-photo-signed-delivery`.
- Pull request: `#271`.
- Base commit: `60bf028ca722363d17e1ce47dd6816b78cfd4414`.
- Final verified feature head: `7e8b9c9273cae79e49949f25dde81da26bb8950c`.
- Merge commit on `phase-0-foundation`: `2fe5e467c14ac29a83eb2aa35218523d695919c7`.
- Scope: keep Photo Board metadata private and Athletes-owned while replacing API byte proxying with active-member-authorized, short-lived signed object-storage GET delivery. The browser requests delivery only when a photo approaches the viewport, receives a five-minute bearer URL, and downloads optimized bytes directly from object storage. Founder-only upload/delete policy, server-side WebP optimization, pagination, deletion outbox cleanup, and the canonical metadata schema remain unchanged.
- Storage boundary: `ObjectStorage` remains the shared byte-storage contract for existing domains; signed reads are a separate `ObjectStorageReadUrlSigner` capability implemented by S3 storage so unrelated consumers are not forced into Athletes delivery behavior.
- Database migration: none.
- Verification repair: the full CI ladder exposed one stale Athletes hardening test that still mocked the removed authenticated byte-proxy route plus changed-file formatting drift. Both were corrected without bypassing or weakening any gate.
- CI: final run `#1871` (`34661477776`) passed on exact feature head `7e8b9c9273cae79e49949f25dde81da26bb8950c`: install, Prisma generation/validation/migrate deploy, architecture check, changed-file formatting, changed-source lint, typecheck, package build, unit tests, full build, PostgreSQL/Redis integration tests, deploy preflight, security check, and migration status.
- Exact-commit production deployment: Railway production API deployment `369e6e2a-d2e2-478a-9f08-f1ce7bc75166` reached `SUCCESS` for merge commit `2fe5e467c14ac29a83eb2aa35218523d695919c7`. HOOMA Web deployment `f1522462-d0df-4535-813e-802fb8dbf61e` and HOOMA Telegram deployment `3604305b-5c3e-415e-9708-e0769ac1aca5` also reached `SUCCESS` for the same exact commit. The Worker deployment `15b58a2a-89dd-4437-8b66-b1c663098cf7` is also online on that release.
- Runtime/config evidence: the API is online with one running replica and no current warnings or crashes; its healthcheck is `/health`. Production pre-deploy found all 42 migrations and reported `No pending migrations to apply`; runtime startup reported `HOOMA API listening on 3000`. The API has all required `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY_ID`, `OBJECT_STORAGE_SECRET_ACCESS_KEY`, and `OBJECT_STORAGE_URL_STYLE` variables configured, and the `hooma-athletes-photos` Railway bucket exists in `ams`.
- Live traffic evidence: after the exact-commit deploy, the API continued serving authenticated ATHLETES-context traffic with no upstream errors. No production `/photos/:photoId/delivery` request was present in the available HTTP log window, and the available read-only tooling could not safely manufacture a production member session/photo merely to create one.
- Score: **9/10** under `docs/LIVING_BUILD_PLAN.md`. The complete source/CI ladder, real PostgreSQL/Redis integration, exact-commit API/Web/Telegram production deployment, API health/runtime evidence, migration state, and object-storage runtime configuration are proven. A score of 10 is not claimed because this closeout did not perform a fresh authenticated production Photo delivery request followed by a direct signed-object GET; doing that without an already-available safe member credential/photo would require mutating production test data or bypassing auth, which this verification deliberately did not do.
- Progression: Step C is **unblocked** because Step B now scores more than 8/10.

### Step C — WebSession activity and Active Athletes redesign

Not started. Step B has cleared the >8/10 progression gate.

### Step D — Whistle history and canonical user navigation

Not started. Must wait for Step C score > 8/10.
