# HOOMA implementation progress

This file is a non-authoritative execution and verification log. Product behavior and architecture truth remain in `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, and the applicable ADRs.

## Athletes hardening sequence

Target base: `phase-0-foundation`

Progression gate: each step must score **more than 8/10** under `docs/LIVING_BUILD_PLAN.md` before the next step starts. A score of 9 requires exact-commit deployment to the intended runtime plus live runtime/health evidence.

- [COMPLETE] Step A — Athletes authorization boundaries and Photo transaction unit of work
- [COMPLETE] Step B — Athletes Photo Board signed delivery optimization
- [COMPLETE] Step C — WebSession `lastSeenAt` activity projection and Active Athletes redesign
- [COMPLETE] Step D — Whistle older-history access and canonical user-profile navigation

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
- Pull request: `#271` implementation; `#272` runtime closeout.
- Base commit: `60bf028ca722363d17e1ce47dd6816b78cfd4414`.
- Final verified feature head: `7e8b9c9273cae79e49949f25dde81da26bb8950c`.
- Merge commit on `phase-0-foundation`: `2fe5e467c14ac29a83eb2aa35218523d695919c7`.
- Scope: keep Photo Board metadata private and Athletes-owned while replacing API byte proxying with active-member-authorized, short-lived signed object-storage GET delivery. The browser requests delivery only when a photo approaches the viewport, receives a five-minute bearer URL, and downloads optimized bytes directly from object storage. Founder-only upload/delete policy, server-side WebP optimization, pagination, deletion outbox cleanup, and the canonical metadata schema remain unchanged.
- Storage boundary: `ObjectStorage` remains the shared byte-storage contract for existing domains; signed reads are a separate `ObjectStorageReadUrlSigner` capability implemented by S3 storage so unrelated consumers are not forced into Athletes delivery behavior.
- Database migration: none.
- Verification repair: the full CI ladder exposed one stale Athletes hardening test that still mocked the removed authenticated byte-proxy route plus changed-file formatting drift. Both were corrected without bypassing or weakening any gate.
- CI: final implementation run `#1871` (`34661477776`) passed on exact feature head `7e8b9c9273cae79e49949f25dde81da26bb8950c`; runtime-closeout PR `#272` also passed the complete verification ladder in run `#1873` (`34664988039`).
- Exact-commit production deployment: Railway production API deployment `369e6e2a-d2e2-478a-9f08-f1ce7bc75166` reached `SUCCESS` for merge commit `2fe5e467c14ac29a83eb2aa35218523d695919c7`. HOOMA Web deployment `f1522462-d0df-4535-813e-802fb8dbf61e` and HOOMA Telegram deployment `3604305b-5c3e-415e-9708-e0769ac1aca5` also reached `SUCCESS` for the same exact commit. The Worker deployment `15b58a2a-89dd-4437-8b66-b1c663098cf7` was also online on that release. The subsequent docs-only closeout commit `9b6988c080e44e8aa896323c87db7bf60ce3d4fa` also deployed successfully.
- Runtime/config evidence: production has the complete `OBJECT_STORAGE_*` configuration and `hooma-athletes-photos` bucket in `ams`. A fresh production smoke test then exercised the real application path without auth bypass or direct database patching: register temporary web user, create private `APPROVAL_REQUIRED` Athletes community, upload a real PNG through `POST /api/v1/athletes/:id/photos`, receive optimized WebP metadata, request `GET /api/v1/athletes/:communityId/photos/:photoId/delivery`, perform a direct GET against the returned signed object-storage URL, delete through the application API, observe Worker cleanup, archive the community, and logout.
- End-to-end signed-delivery proof: the uploaded image was optimized to `image/webp` with a 14,916-byte payload; the delivery URL carried the expected AWS SigV4 query parameters with a 300-second expiry; the direct object-storage GET returned HTTP 200, `image/webp`, and exactly 14,916 bytes. After application deletion, the same signed URL returned HTTP 404 after about 5 seconds, proving the Worker removed the underlying object rather than only the metadata row.
- Smoke-test cleanup: the temporary Athletes community was archived and the session logged out. A temporary user remains because HOOMA currently has no user-delete API; no direct SQL was used to remove it.
- Score: **10/10** under `docs/LIVING_BUILD_PLAN.md`. Step B is now proven through source, full CI, exact-commit deployment, real production auth/session behavior, upload/optimization, signed URL generation, direct object delivery, application deletion, and asynchronous object cleanup.
- Progression: Step C is **unblocked and started**.

### Step C — WebSession activity and Active Athletes redesign

- Branch: `feat/athletes-websession-last-seen`.
- Pull request: `#274`.
- Base commit: `8f8d01b302e9fb46e07ac4f569f6bbf96c3ac81a`.
- Final verified feature head: `9a36e277c96d00251a6cdd16ce46f0f11dc21794`.
- Merge commit on `phase-0-foundation`: `5ec5f870f2903c6d969fc3255dfd5b6f5d1f02fd`.
- Scope: use only canonical `WebSession.lastSeenAt` for web activity truth; touch it at the Identity session-resolution boundary with a 60-second per-session throttle; expose a narrow Identity-owned batched reader for Athletes; redesign Active Athletes rows to show avatar, display name, `@username`, role, and last-seen text while retaining canonical `/profile/:username` navigation.
- Activity projection: the member list remains the canonical active Athletes membership list. Identity returns the most recent `lastSeenAt` among that user's active, unrevoked, unexpired WebSessions; members with no such session remain in the list with nullable `lastSeenAt` and UI text `No recent web activity` rather than being hidden or assigned invented online/offline state.
- Explicit non-goals preserved: no Redis presence, no green/red online dots, no Telegram activity fallback, no new presence table, no duplicate user card/profile model, no N+1 identity reads, and no schema migration.
- Governance verification: `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, and this progress ledger were aligned to the actual implementation. Abandoned PR `#276` was not reused because it contained broad unrelated documentation deletion and incorrect wording that would have hidden members without active WebSessions.
- CI verification: exact final PR head `9a36e277c96d00251a6cdd16ce46f0f11dc21794` passed CI `#1890` (`34694996557`): install, Prisma generation/validation/migrate deploy, architecture check, changed-file formatting, changed-source lint, typecheck, package build, unit tests, full build, real integration tests, deploy preflight, security check, and migration status.
- Exact-commit production deployment: Railway production API deployment `2b831d92-5114-4b59-9083-ec84fb4c52d9`, HOOMA Web deployment `9d90a3af-2a84-4bd7-9132-0900560854ac`, HOOMA Telegram deployment `1d7b4811-32fd-4bde-a812-a021f9bb5cb6`, and HOOMA Worker deployment `f668d271-693a-4522-be8e-c61980ac86ae` all reached `SUCCESS` for exact merge commit `5ec5f870f2903c6d969fc3255dfd5b6f5d1f02fd`.
- Runtime evidence: production API pre-deploy ran `prisma migrate deploy`, found 42 migrations, and reported no pending migrations; startup reported `HOOMA API listening on 3000`. Railway HTTP logs on that exact deployment then showed authenticated Athletes Whistle requests returning HTTP 304 with no upstream errors, proving the deployed authenticated request/session boundary remained operational after Step C.
- Targeted smoke limitation: a separate synthetic register/create/member-read/archive/logout smoke was prepared, but the execution runner could not resolve any `*.up.railway.app` hostname. The failure occurred before the first HTTP request, so it created no temporary production user/community and supplied no additional functional evidence. No direct SQL, alternate provider, infrastructure mutation, or bypass was used to manufacture proof.
- Score: **9/10** under `docs/LIVING_BUILD_PLAN.md`. Exact final-head CI, governing-document alignment, exact-commit API/Web/Telegram/Worker production deployment, production migration/startup health, and real authenticated Athletes traffic are proven. A score of 10 is not claimed because this closeout did not obtain a fresh targeted production member-list readback demonstrating the rendered `lastSeenAt` value end-to-end.
- Progression: Step D is **unblocked but not started**.

### Step D — Whistle history and canonical user navigation

- Branch: `feat/whistle-current-day-history`.
- Pull request: `#278`.
- Base commit: `928cb9fa2a730dd90a9a8c04fc9a849587291746`.
- Final verified feature head: `9f1892d41ac2ae4915f06efbc7c03691242a56a7`.
- Merge commit on `phase-0-foundation`: `fe7a86a971232dbd533d31f513a5df1b20eb901d`.
- Scope: add opaque keyset pagination for older Whistle metadata rows within the current UTC day only; retain Redis-only Whistle bodies and PostgreSQL-only metadata; preserve the global 33-grapheme / 11-per-UTC-day quota and existing server-side authorization; expose one shared `Load older` interaction across Community/Event/Athletes/Ride, Gamer Direct, and User Direct Whistle rooms; preserve the user's viewport when older rows are prepended; merge newest polling with already-loaded history; drop stale client history when the UTC reset changes; and link author presentation to the existing canonical `/profile/:username` route.
- Persistence/model impact: no Prisma schema change and no migration. The existing `WhistleMetadata` ordering supports `(createdAt DESC, id DESC)` keyset traversal. Transient Whistle body storage, expiry, and durable metadata ownership are unchanged.
- Explicit non-goals preserved: no permanent archive, no previous-day reads, no durable bodies, no Reveal state, no new messaging table, no quota/auth redesign, and no duplicate profile/card implementation.
- CI repair: exact-head CI `#1903` initially exposed two Step D unit regressions before integration ran: the component-level `whistle-history.css` import leaked into emitted package JavaScript and failed Node consumers, and the Ride source-shape guard no longer saw the canonical zero-cursor `api.whistles.ride(contextId)` call. The CSS rules were moved into the existing exported `whistle.css`, the orphan stylesheet was removed, and the Ride fetch path now keeps the canonical current-page call while using the cursor only for older pages. No production Redis/configuration change was required.
- CI verification: exact final feature head `9f1892d41ac2ae4915f06efbc7c03691242a56a7` passed CI `#1908` (`34700480118`): install, Prisma generation/validation/migrate deploy, architecture check, changed-file formatting, changed-source lint, typecheck, package build, full unit tests, full build, real PostgreSQL+Redis integration tests, deploy preflight, security check, and migration status.
- Integration proof: the permanent Whistle history integration test creates an authenticated Community fixture, seeds 105 active current-day metadata rows across 11 users, stores their bodies in Redis with the current UTC-day TTL, verifies a 100-row first page and 5-row second page with a non-overlapping opaque cursor traversal, confirms Redis body hydration and UTC reset metadata, and rejects an invalid cursor with HTTP 400.
- Governance audit: `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, and `docs/DECISIONS.md` were reviewed against the implementation. Step D does not change their canonical Whistle retention, storage, quota, auth, or identity rules, so no governing-document edit is required.
- Exact-commit production deployment: Railway API deployment `dcca9846-6299-4f47-b894-d3329b0caa95`, HOOMA Web deployment `7f2eb6f7-478c-47cb-9948-88d168db2d3a`, HOOMA Telegram deployment `7eeb6577-60ff-4e15-a9dc-dcc69936b82b`, and HOOMA Worker deployment `ed70e19a-ae1e-4ba3-b9db-36aa404ae455` all reached `SUCCESS` for exact merge commit `fe7a86a971232dbd533d31f513a5df1b20eb901d`.
- Runtime evidence: production API pre-deploy loaded the PostgreSQL schema, found 42 migrations, and reported no pending migrations; startup reported `HOOMA API listening on 3000`. After the new deployment became active, Railway HTTP logs showed authenticated `GET /api/v1/whistles/contexts/ATHLETES/:id` requests returning HTTP 200 and 304 with no upstream errors, proving the deployed Whistle authorization/read path remained operational on the exact merge commit.
- Score: **9/10** under `docs/LIVING_BUILD_PLAN.md`. Source, exact final-head CI, real PostgreSQL+Redis history integration, exact-commit API/Web/Telegram/Worker deployment, migration/startup health, and real authenticated Whistle traffic are proven. A score of 10 is not claimed because this closeout did not perform a fresh production user-path smoke that creates enough same-day Whistles to exercise `Load older` and then clicks an author through to `/profile/:username` end to end.
- Progression: Step D is **complete**. No next implementation step has been started.
