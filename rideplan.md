# HOOMA — RIDE / REQUESTS / FUNDME LIVE IMPLEMENTATION PLAN

Status: **ACTIVE SCOPED EXECUTION PLAN**  
Repository: `funmarket/HoomaUltimate`  
Target branch: `phase-0-foundation`  
Plan created from branch HEAD: `585ec1d6aa0d2ebb9ca82d8416a84778f5c7ec11`  
Product name: **HOOMA**

> This is a live execution ledger requested by the product owner. It does **not** replace `AGENTS.md`, `docs/LIVING_BUILD_PLAN.md`, `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, or `docs/DECISIONS.md`. Those files remain authoritative for working discipline, product behavior, architecture, canonical data, and architectural decisions. This plan tells agents exactly how to execute the Ride / Requests / FundMe work without creating duplicate sources of truth or cross-domain monoliths.

---

# 0. How every agent must use this file

Every agent working on any task in this plan must do all of the following before editing source:

1. Read root `AGENTS.md`.
2. Read `docs/LIVING_BUILD_PLAN.md`.
3. Read the relevant sections of `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, and `docs/DECISIONS.md`.
4. Read this entire `rideplan.md` before taking a task.
5. Fetch the latest `phase-0-foundation` and record its exact HEAD SHA.
6. Inspect **all open PRs** and overlapping branches/tasks before editing.
7. Trace the full applicable path before writing:

   ```text
   UI / state
   -> feature frontend API client
   -> domain contract
   -> HTTP route
   -> authentication / authorization
   -> application service / domain policy
   -> repository port
   -> Prisma repository
   -> Prisma schema + committed migration
   -> PostgreSQL / object storage / Redis if applicable
   -> Worker/outbox if applicable
   -> Railway/runtime
   ```

8. Re-check `phase-0-foundation` HEAD immediately before the first write and again before final commit/merge. If HEAD moved, inspect the incoming changes before continuing.
9. Work on **one task ID at a time** unless the product owner explicitly authorizes broader scope.
10. Do not mark a task `DONE` merely because source exists or CI is green. The task must satisfy its exact completion gate below.

## Live status notation

Use these exact statuses in this file:

- `[ ] TODO` — not started.
- `[~] IN PROGRESS` — an agent has actively taken the task; add branch/PR in the task evidence line.
- `[!] BLOCKED` — stopped because an authoritative conflict, overlap, missing infrastructure, or safety issue prevents correct completion.
- `[x] DONE` — implementation and required verification are complete and evidence is recorded.
- `[-] DEFERRED` — explicitly deferred by product-owner decision; not silently skipped.

## Mandatory live-plan update rule

A successful implementation is not complete until this file is updated in the same implementation change or immediately following merge to:

- change the task status to `[x] DONE`;
- record the merged commit SHA or PR number;
- record the verification performed;
- record any remaining risk;
- identify the next task but **do not automatically start it** unless instructed.

Do not mark a task DONE in an open PR as if it were merged foundation truth. While work is open, use `[~] IN PROGRESS` and identify the PR/branch. Change to `[x] DONE` only after merge/read-back evidence required by that task.

---

# 1. Locked architecture for this plan

The implementation must preserve these canonical owners:

| Concept                                                                            | Canonical owner                                                      |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Canonical user identity                                                            | Identity                                                             |
| HOOMA community + membership                                                       | Communities                                                          |
| Football Event / Match-Day activity                                                | Events / Watch / Play as already defined                             |
| Physical venue identity                                                            | Places                                                               |
| Ride offers, ride requests, ride participation, ride-private meeting/location data | **Rides**                                                            |
| Help/resource requests and request claims                                          | **Requests**                                                         |
| Fundraising campaigns and contributions                                            | **Fundraising**                                                      |
| Payment intents, provider state, settlement                                        | **Payments**                                                         |
| Binary photo/media bytes                                                           | **S3-compatible object storage through `@hooma/storage`**            |
| Ride photo metadata/reference                                                      | **Rides**, until a separately authorized generic Media domain exists |
| Aggregated Home/Now/Match-Day projection                                           | Discovery/read models only                                           |
| Async side effects/retries                                                         | Outbox + Worker                                                      |
| Transient Whistle body                                                             | Redis through the existing Whistle domain only                       |

## Required backend boundaries

When the domains are implemented, substantial slices use:

```text
apps/api/src/modules/rides/
  domain/
  application/
  infrastructure/
  http/

apps/api/src/modules/requests/
  domain/
  application/
  infrastructure/
  http/

apps/api/src/modules/fundraising/        # later, separately authorized
  domain/
  application/
  infrastructure/
  http/

apps/api/src/modules/payments/           # later, separately authorized
  domain/
  application/
  infrastructure/
  http/
```

Expected dependency direction:

```text
http -> application -> domain
infrastructure -> application/domain ports
bootstrap/container -> concrete implementations
```

Forbidden:

```text
Rides -> Requests infrastructure
Requests -> Rides infrastructure
Requests -> Fundraising persistence
Payments -> Fundraising/Rides/Requests repositories
Discovery -> canonical Ride/Request writes
HTTP -> Prisma business logic
Domain -> Prisma/Express
Frontend -> database package
```

Cross-domain reads must use narrow application ports/readers, never another domain's Prisma repository.

---

# 2. Explicit anti-monolith rules

The following designs are forbidden for this implementation:

```text
community-actions/
CommunityActionService
SocialService
GenericActionRepository
GenericPost
GenericClaim
GenericBooking
GenericMoneyRequest
Action { type, dataJson }
DiscoveryItem { type, dataJson } as canonical owner
```

Do not combine Ride + Requests + FundMe because they are adjacent in the UI.

Do not build:

```text
RequestsService
  createRequest()
  claimRequest()
  createFundraiser()
  contribute()
  createPaymentIntent()
  settleTelegramStars()
```

Do not expand `packages/frontend/src/api.ts` with a large mixed Ride/Requests/FundMe implementation. Use domain-owned clients:

```text
packages/frontend/src/rides/api.ts
packages/frontend/src/requests/api.ts
packages/frontend/src/fundraising/api.ts       # later
```

Do not introduce Redux/Zustand/React Query or another global state dependency only for these features unless an independently reviewed architecture decision proves the need.

Do not create a giant migration that adds Ride + Requests + Payments + Fundraising together.

---

# 3. Current UI contract that must be preserved

Current Home remains exactly:

```text
HOOMA | Teams | Spots
Pitch | Ride  | Requests
```

Permanent bottom navigation remains:

```text
Home | Play | Watch | HOOMA | Pitch
```

Current route contract remains:

```text
/rides
/requests
/requests/fundme
/fundme -> /requests/fundme
```

FundMe is a **Requests-page navigation tab only**. It does not become Requests-owned persistence.

The existing honest Ride and Requests/FundMe shells must be replaced only when the corresponding real vertical slices are ready. Never replace an honest shell with fake data or disconnected controls.

---

# 4. Media/photo persistence contract — LOCKED FOR THIS PLAN

This section is mandatory. No agent may improvise another media storage pattern.

## 4.1 Where photo bytes live

Binary Ride vehicle photos **must not** be stored in PostgreSQL, Prisma `Bytes`, base64 strings, JSON, logs, audit metadata, or outbox payloads.

Photo bytes belong in the existing S3-compatible object storage through `@hooma/storage` / `ObjectStorage`.

The Ride domain may reuse the existing object-storage infrastructure but must own its own authorization, object-key namespace, metadata, lifecycle, and API surface.

## 4.2 Where photo metadata lives

Until a separately authorized generic Media domain exists, Ride vehicle-photo metadata belongs in a single-purpose Ride-owned table. Recommended canonical model:

```text
RideOfferVehiclePhoto
  id
  rideOfferId          unique — one current vehicle photo per offer in V1
  objectKey            unique
  contentType
  sizeBytes
  createdAt
  updatedAt
```

Relations:

```text
RideOffer 1 ---- 0..1 RideOfferVehiclePhoto
```

Do **not** add generic `MediaAsset`, `Attachment`, or polymorphic `entityType/entityId` tables as part of Ride.

Do not store a public external image URL as the canonical managed upload. The canonical stored reference is the object key. Public/member delivery is through a Ride-owned API/media endpoint or a future separately governed delivery mechanism.

## 4.3 Object-key namespace

Ride-managed vehicle media must use a Ride-owned namespace, for example:

```text
ride-offer-vehicles/<rideOfferId>/<photoId>
```

Never use unstructured global keys such as:

```text
uploads/random.jpg
images/123.png
```

## 4.4 Allowed image types and limits

Reuse the existing project pattern unless the implementation trace proves a newer governed media rule:

```text
image/jpeg
image/png
image/webp
```

The implementation must set an explicit max byte size and enforce it server-side. Do not trust browser MIME/type alone.

## 4.5 Upload workflow

The RideOffer must exist and be owned/managed by the authenticated user before a vehicle image can be attached.

Required flow:

```text
create RideOffer
-> authenticated owner selects/takes photo
-> Ride media endpoint validates owner + state + MIME + byte limit
-> generate Ride-owned object key
-> ObjectStorage.put(...)
-> persist/switch RideOfferVehiclePhoto metadata
-> read back through Ride API
```

A failed image upload must not invalidate a successfully created RideOffer. The UI must allow retry.

## 4.6 Replacement/deletion safety

Photo replacement must not overwrite unrelated objects or leave the database pointing to a missing key by design.

Use versioned object keys. Switch the canonical DB metadata only after the new object upload succeeds. After the DB switch, remove the old object. If old-object deletion cannot be guaranteed synchronously, use the existing outbox/worker pattern for bounded cleanup rather than putting object-storage retry policy into the Ride HTTP controller.

If object upload succeeds but metadata persistence fails, the implementation must attempt immediate cleanup of the newly created object and must record any remaining orphan-object risk in the task evidence. A later bounded reconciliation/cleanup task is required before a 10/10 media completion claim if orphan cleanup is not fully durable.

## 4.7 Photo serving/privacy

A public Ride Offer may expose its intentionally public vehicle photo, but object-storage credentials and raw internal bucket details must never be exposed.

Recommended public delivery path:

```text
GET /api/public/v1/rides/offers/:offerId/photo
```

The route resolves a privacy-safe public Ride Offer, reads the stored object through `ObjectStorage`, and returns the permitted image with the stored content type.

Private media, if introduced later, requires explicit server-side authorization and must not reuse a public media route.

## 4.8 Mobile camera/upload UI

Support both:

```text
TAKE PHOTO
UPLOAD PHOTO
```

using the shared Web/Telegram frontend tree. A browser input may use `accept="image/*"` and `capture="environment"` for camera intent where supported. Do not create a second Telegram-specific feature tree.

---

# 5. Target Ride domain model

Exact names may be adjusted only if existing code or an approved ADR requires it, but the ownership/lifecycles below are mandatory.

## 5.1 RideOffer

Recommended durable shape:

```text
RideOffer
  id
  driverUserId
  eventId?
  destinationPlaceId?
  customDestinationLabel?
  originAreaLabel
  departureAt
  totalSeats
  vehicleMake?
  vehicleModel?
  vehicleColor?
  note?
  status
  createdAt
  updatedAt
```

Recommended status:

```text
OPEN
FULL
DEPARTED
CANCELLED
COMPLETED
```

Rules:

- `driverUserId` comes from authenticated identity, never trusted from request body.
- A Ride Offer must have one valid destination strategy: Event, canonical Place, or explicit custom destination as approved by the governance task.
- Event/Place presentation is read from the owning domain and is not duplicated into Ride as canonical match/venue truth.
- `totalSeats` is a capacity invariant, not a frontend counter.
- Public Ride state must never expose exact private pickup/meeting coordinates.

## 5.2 RideRequest — “Take me to the game”

Recommended durable shape:

```text
RideRequest
  id
  requesterUserId
  eventId?
  destinationPlaceId?
  customDestinationLabel?
  pickupAreaLabel
  desiredDepartureAt
  passengerCount
  note?
  expiresAt
  status
  createdAt
  updatedAt
```

Recommended status:

```text
OPEN
MATCHED
CANCELLED
EXPIRED
COMPLETED
```

Rules:

- public discovery contains only approximate pickup-area information;
- exact address/GPS is not part of the public RideRequest projection;
- the requester identity is derived server-side;
- expiration is enforced server-side, not only hidden in UI.

## 5.3 RideParticipation

Use a separate table. Never store passenger IDs in an array on RideOffer.

```text
RideParticipation
  id
  rideOfferId
  passengerUserId
  seatCount
  status
  requestedAt
  respondedAt?
  cancelledAt?
  completedAt?
```

Recommended status:

```text
REQUESTED
ACCEPTED
REJECTED
CANCELLED
COMPLETED
```

Required invariant:

```text
UNIQUE(rideOfferId, passengerUserId)
```

The driver cannot participate in their own offer as a passenger.

## 5.4 RideMeetingPoint

Exact meeting information requires a separate privacy boundary:

```text
RideMeetingPoint
  id
  participationId       unique
  label
  latitude?
  longitude?
  createdAt
  updatedAt
```

Visibility:

```text
Ride driver                  ALLOWED
that accepted passenger      ALLOWED
other passengers             DENIED
public visitor               DENIED
```

Do not depend on frontend hiding for this rule.

## 5.5 RideOfferWaypoint

V1 passing-through matching may use bounded ordered waypoints rather than a geospatial-route monolith:

```text
RideOfferWaypoint
  id
  rideOfferId
  sequence
  placeId?
  areaLabel
```

Rules:

- `placeId` references canonical Place when a real Place is used;
- `areaLabel` is Ride-owned route presentation, not a duplicate Place entity;
- no JSON route blob;
- no PostGIS/route-provider dependency unless separately justified and approved.

---

# 6. Target Requests domain model

## 6.1 Request

Recommended durable shape:

```text
Request
  id
  requesterUserId
  communityId?
  eventId?
  placeId?
  category
  title
  description
  quantityRequested
  unit?
  expiresAt
  status
  createdAt
  updatedAt
```

Recommended status:

```text
OPEN
FULFILLED
CANCELLED
EXPIRED
```

Do not add Ride or Fundraising state to this table.

## 6.2 RequestClaim

```text
RequestClaim
  id
  requestId
  claimerUserId
  quantity
  status
  claimedAt
  releasedAt?
  completedAt?
```

Recommended status:

```text
CLAIMED
RELEASED
COMPLETED
```

The latest product direction for this plan is **partial quantity claims**, subject to governance reconciliation with existing wording before schema implementation.

Example:

```text
Request: 10 training bibs
Ali claims: 3
Sami claims: 4
Remaining: 3
```

Remaining quantity should initially be derived from canonical active/completed claims rather than maintained as an uncontrolled editable counter.

Concurrency must lock/serialize the Request row or use an equivalent PostgreSQL-safe mechanism so total committed quantity cannot exceed `quantityRequested`.

---

# 7. FundMe and Payments boundary

FundMe remains visible as a tab under Requests:

```text
Requests | FundMe
```

Runtime ownership remains separate:

```text
RequestsPage
  -> Requests tab -> Requests domain
  -> FundMe tab   -> Fundraising domain -> narrow Payments port
```

Future canonical models are expected to remain independently owned:

```text
Fundraising
  FundraiserCampaign
  FundraiserContribution

Payments
  PaymentIntent
  provider/idempotency/settlement state
```

Initial payment rails remain:

```text
CASH
TELEGRAM_STARS
```

Do not add credit cards or donor-era `HYBRID` semantics by implication.

Payments is a lower-level capability. Payments must not become the orchestrator that imports Ride/Requests/Fundraising repositories and mutates product records directly.

---

# 8. Cross-domain ports — required pattern

Rides may need to validate/reference an Event or Place. It must not import their infrastructure repositories.

Use narrow application boundaries such as:

```text
RideEventReferenceReader
  resolveRideDestinationEvent(eventId)

RidePlaceReferenceReader
  resolveRideDestinationPlace(placeId)
```

The exact interface names may follow existing naming conventions, but their scope must remain narrow.

If Community membership becomes relevant for a specific Ride/Request visibility rule, use a narrow read/authorization port rather than injecting the entire CommunityService merely for convenience.

---

# 9. Public/member API boundary

The final routes must follow the repository's public/member split.

## 9.1 Ride public reads

Candidate routes:

```text
GET /api/public/v1/rides/offers
GET /api/public/v1/rides/offers/:offerId
GET /api/public/v1/rides/offers/:offerId/photo
GET /api/public/v1/rides/requests
```

Only privacy-safe data is public.

## 9.2 Ride protected actions

Candidate routes:

```text
POST   /api/v1/rides/offers
PATCH  /api/v1/rides/offers/:offerId
POST   /api/v1/rides/offers/:offerId/cancel
POST   /api/v1/rides/offers/:offerId/photo
DELETE /api/v1/rides/offers/:offerId/photo

POST   /api/v1/rides/offers/:offerId/participations
POST   /api/v1/rides/offers/:offerId/participations/:participationId/accept
POST   /api/v1/rides/offers/:offerId/participations/:participationId/reject
POST   /api/v1/rides/offers/:offerId/participations/:participationId/cancel

POST   /api/v1/rides/requests
PATCH  /api/v1/rides/requests/:requestId
POST   /api/v1/rides/requests/:requestId/cancel

GET    /api/v1/rides/mine
```

Exact REST verbs may be normalized to existing project conventions during implementation, but domain ownership and authorization must not change.

## 9.3 Requests public/member routes

Candidate public reads:

```text
GET /api/public/v1/requests
GET /api/public/v1/requests/:requestId
```

Candidate protected actions:

```text
POST /api/v1/requests
PATCH /api/v1/requests/:requestId
POST /api/v1/requests/:requestId/cancel
POST /api/v1/requests/:requestId/claims
POST /api/v1/requests/:requestId/claims/:claimId/release
POST /api/v1/requests/:requestId/claims/:claimId/complete
GET  /api/v1/requests/mine
```

Actor IDs are always derived from authenticated server identity.

---

# 10. Frontend target structure

Ride:

```text
packages/frontend/src/rides/
  RidesPage.tsx
  RideGateway.tsx
  RideOffersPage.tsx
  RideOfferCard.tsx
  RideOfferForm.tsx
  RideOfferDetail.tsx
  RideRequestForm.tsx
  RideVehiclePhotoInput.tsx
  api.ts
  rides.css
```

Requests:

```text
packages/frontend/src/requests/
  RequestsPage.tsx
  RequestsFeed.tsx
  RequestCard.tsx
  RequestForm.tsx
  RequestDetail.tsx
  RequestClaimControls.tsx
  api.ts
  requests.css
```

Fundraising later:

```text
packages/frontend/src/fundraising/
  FundMePanel.tsx
  FundraiserCard.tsx
  FundraiserForm.tsx
  api.ts
```

The exact component split may be adjusted to avoid tiny artificial files, but one large page component must not absorb API calls, business lifecycle, media upload logic, matching, Requests, and FundMe into one script.

---

# 11. Ride route/UX target

Recommended route tree:

```text
/rides
/rides/request
/rides/offers
/rides/offers/new
/rides/offers/:offerId
```

Main `/rides` gateway presents the two core actions clearly:

```text
TAKE ME TO THE GAME
RIDE OFFERS
```

Ride Offer creation should support:

- destination Event/Place/custom destination as governed;
- origin area;
- departure date/time;
- seats;
- ordered passing-through waypoints where enabled;
- optional vehicle make/model/color;
- optional note;
- optional camera/upload vehicle photo after the RideOffer exists.

Ride Request creation should support:

- destination;
- approximate pickup area;
- desired departure time;
- passenger count;
- optional note.

Required UI states:

```text
loading
empty
validation error
authentication required
forbidden
conflict/full
upload pending/upload failed/upload success
mutation pending
success
cancelled/expired/terminal state
```

---

# 12. Requests route/UX target

Keep current navigation:

```text
/requests
/requests/fundme
/fundme -> /requests/fundme
```

Add only when the real Requests slice exists:

```text
/requests/new
/requests/:requestId
```

Requests should support structured help/resource needs rather than generic permanent social posts.

If a need clearly belongs to another domain, the UI may navigate the user:

```text
transport need -> Ride
money need     -> FundMe
```

Navigation does not transfer canonical persistence ownership.

---

# 13. Concurrency and lifecycle requirements

## 13.1 Ride seat capacity

Use a real PostgreSQL transaction and row lock/equivalent around the RideOffer capacity decision.

Required invariant:

```text
sum(ACCEPTED active seatCount) <= RideOffer.totalSeats
```

Two users competing for the final seat must never both be accepted.

Frontend seat counts are projections only.

## 13.2 Request quantities

Use a real PostgreSQL transaction and row lock/equivalent around claim allocation.

Required invariant:

```text
sum(CLAIMED + COMPLETED quantities as defined by lifecycle) <= Request.quantityRequested
```

Released claims restore availability.

## 13.3 Idempotency

Retry-sensitive actions must not duplicate canonical state. At minimum inspect and define idempotency for:

- Ride participation request retries;
- Ride participation accept/reject retries;
- Request claim retries;
- later Fundraising contributions;
- later payment provider callbacks/events.

Do not add one generic idempotency table for all domains unless the architecture explicitly assigns such an infrastructure primitive. Domain identity/unique constraints should carry invariants where possible.

---

# 14. Discovery and Match-Day integration — projection only

Discovery may later include privacy-safe Ride/Request projections, but canonical writes remain in their owner domains.

A Match-Day or Event surface may later aggregate:

```text
8 Ride Offers
3 Need a Ride
4 Requests
```

That aggregation must read canonical owner data/read models. It must not create a `MatchDay` persistence owner containing copies of Ride/Request/Event records.

Discovery integration is not part of the initial core migrations unless a specific task below explicitly reaches that phase.

---

# 15. Ride matching — later Ride-owned capability

Do not design the first schema around an AI/geospatial matching engine.

Initial matching inputs may be:

- same Event;
- same destination Place;
- compatible departure window;
- matching origin/waypoint area;
- sufficient seats for passenger count.

Matching should return a read result/projection such as `RideMatchCandidate`. Do not create a durable generic `Match` table unless a later product requirement proves durable match identity is necessary.

Potential future geospatial routing/PostGIS/provider integration requires a separate architecture decision and must not be smuggled into core Ride work.

---

# 16. Reliability / confirmation lifecycle — later Ride phase

Do not create an arbitrary universal `User.rating` as part of Ride core.

First preserve real Ride lifecycle facts. Later reliability can derive from facts such as:

- completed rides;
- driver cancellations;
- passenger cancellations;
- no-shows if a complete no-show lifecycle is implemented;
- confirmation kept/missed.

Possible later fields/state transitions:

```text
driverConfirmedAt
passengerConfirmedAt
driverOnWayAt
driverArrivedAt
completedAt
cancelledAt
cancellationReason
```

Add these only in the dedicated phase below when the base lifecycle is already proven.

---

# 17. Whistle boundary

`WhistleContextType.RIDE` existing in an enum does **not** mean Ride Whistle is authorized.

Ride Whistle remains closed until Ride provides a deliberate authorization adapter proving the caller is an allowed Ride participant.

When implemented later:

```text
Whistle -> RideAccessReader -> driver/accepted-participant authorization
```

Do not create Ride chat, Ride messages, or another Whistle body store.

---

# 18. Migration rules

Never use `prisma db push` for this work.

Every durable schema change requires a committed migration and real migration verification.

Do not create one migration for independent domains. Prefer bounded slices such as:

```text
rides-core
rides-vehicle-photo
requests-core
payments-core             # later
fundraising-core          # later
```

If a migration must touch an existing owner table only to add a proper relation, the change must be reviewed from both domain perspectives and remain the minimum required canonical relationship.

Indexes/constraints must reflect real queries and invariants, not speculative indexing of every field.

Suggested Ride indexes to evaluate:

```text
RideOffer(status, departureAt)
RideOffer(eventId, status, departureAt)
RideOffer(destinationPlaceId, status, departureAt)
RideOffer(driverUserId, status)
RideParticipation(rideOfferId, status)
RideParticipation(passengerUserId, status)
RideRequest(status, desiredDepartureAt)
RideRequest(eventId, status)
RideRequest(requesterUserId, status)
RideOfferWaypoint(rideOfferId, sequence)
```

Suggested Requests indexes to evaluate:

```text
Request(status, expiresAt)
Request(requesterUserId, status)
Request(communityId, status)
Request(eventId, status)
RequestClaim(requestId, status)
RequestClaim(claimerUserId, status)
```

---

# 19. Security/privacy acceptance rules

The client must never be authoritative for actor identity. Do not accept trusted authority fields such as:

```text
driverUserId
requesterUserId
passengerUserId
claimerUserId
```

from request bodies for ownership decisions.

Server authorization must prove:

- only RideOffer owner can edit/cancel the offer or manage its vehicle photo;
- only RideOffer owner can accept/reject participation where the chosen lifecycle requires owner approval;
- a user cannot join their own RideOffer as passenger;
- exact RideMeetingPoint is visible only to authorized parties;
- non-owner cannot mutate another RideRequest;
- non-requester cannot cancel/edit another Request;
- a claimer cannot mutate another claimer's claim except where requester-owned completion policy is explicitly defined;
- expired/cancelled/terminal records reject invalid mutations;
- public DTOs strip private identity/location data by construction.

---

# 20. Required verification for Ride core

Before Ride core can be called DONE, permanent tests must prove at least:

1. public Ride offer list/detail returns only safe fields;
2. create RideOffer derives driver from auth;
3. non-owner cannot edit/cancel another RideOffer;
4. invalid Event/Place reference is rejected through correct boundary;
5. driver cannot request their own Ride;
6. duplicate participation does not create duplicate canonical rows;
7. two concurrent users competing for final seat cannot overbook;
8. cancelled/released participation restores availability according to lifecycle;
9. exact meeting point is not in public responses;
10. exact meeting point is denied to unauthorized callers;
11. expired/cancelled offers reject participation;
12. Web + Telegram shared frontend transport still works through the existing universal frontend architecture;
13. migration applies from a clean/disposable PostgreSQL database;
14. read-back proves persisted state matches service assumptions.

Mocks cannot be used to claim PostgreSQL locking correctness.

---

# 21. Required verification for Ride vehicle media

Before vehicle-photo work can be called DONE, permanent tests/evidence must prove at least:

1. JPEG/PNG/WebP accepted as governed;
2. unsupported media type rejected;
3. zero-byte/over-limit payload rejected;
4. non-owner upload rejected;
5. upload requires an existing RideOffer;
6. object bytes are written through `ObjectStorage` and not PostgreSQL;
7. Prisma row contains only Ride-owned object metadata/reference;
8. public photo endpoint serves permitted object without leaking storage credentials;
9. replacing a photo updates canonical metadata and cleans/schedules cleanup of the old object;
10. delete removes canonical metadata and object/cleanup responsibility correctly;
11. upload failure leaves RideOffer usable and UI can retry;
12. camera/upload frontend states work on mobile-sized layout and do not create a second Telegram feature tree;
13. object-storage failure returns a real failure state instead of fake success;
14. orphan-object risk is either durably handled or explicitly kept as an open task preventing a 10/10 claim.

---

# 22. Required verification for Requests core

Before Requests core can be called DONE, permanent tests/evidence must prove at least:

1. public Request read is privacy-safe;
2. requester identity derives from auth;
3. non-owner cannot edit/cancel another Request;
4. partial claim quantity follows the final governed rule;
5. two concurrent claims for the final quantity cannot over-claim;
6. released claim restores remaining availability;
7. expired/cancelled Request rejects new claims;
8. duplicate retry cannot create uncontrolled duplicate claim state;
9. claimer identity derives from auth;
10. completion/release authority is server-side;
11. remaining quantity read-back equals canonical claim state;
12. migration applies to disposable PostgreSQL and read-back proves persistence.

---

# 23. Full verification command set

Each task runs the strongest applicable subset and records exactly what ran. Full-slice verification may include:

```text
npm ci
npm run db:generate
npm run db:validate
npm run db:migrate:deploy
npm run architecture:check
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run deploy:preflight
npm run security:check
npm run db:migrate:status
```

A skipped later check because an earlier check failed is not a pass.

Deployment/live claims additionally require evidence from the exact deployed commit.

---

# 24. Shared-file collision warning

Ride/Requests/FundMe are separate domains, but their implementation may touch shared choke points:

```text
packages/database/prisma/schema.prisma
packages/contracts/src/index.ts
apps/api/src/bootstrap/container.ts
apps/api/src/http/v1/router.ts
apps/api/src/http/public-v1/router.ts
apps/web/src/app/router/HoomaRouter.tsx
requirements.md
structure.md
docs/CANONICAL_MODEL.md
docs/DECISIONS.md
rideplan.md
```

Therefore agents must not race separate Ride/Requests branches against the same foundation without checking overlap. Prefer sequential merge of the numbered tasks below.

---

# 25. LIVE EXECUTION LEDGER

This is the authoritative scoped execution order for this plan. Agents must start with the first `TODO` whose dependencies are DONE unless the product owner explicitly reorders work.

## PLAN-000 — Baseline architecture audit and live plan

Status: **[x] DONE**

Scope completed:

- re-read `AGENTS.md` and `docs/LIVING_BUILD_PLAN.md`;
- confirmed current domain architecture and no-monolith rules;
- confirmed current honest Ride/Requests/FundMe shells and route grouping;
- confirmed existing `@hooma/storage` object-storage abstraction can be reused without another upload/storage framework;
- confirmed current backend has no canonical Rides/Requests/Fundraising/Payments modules yet;
- confirmed current branch had no open PRs at plan creation;
- created this live execution contract.

Evidence:

```text
Baseline HEAD before plan write: 585ec1d6aa0d2ebb9ca82d8416a84778f5c7ec11
Open PRs at audit: 0
```

Remaining risk: branch may move after plan creation; every agent must re-run the pre-build gate.

---

## GOV-001 — Explicitly unfreeze Ride + Requests backend work and reconcile product rules

Status: **[x] DONE**

Dependencies: `PLAN-000`

Goal: authorize the actual Ride and Requests durable vertical slices without accidentally authorizing Fundraising/Payments or changing unrelated domains.

Required work:

1. Trace ADR-038 / ADR-048 and current `requirements.md` Ride/Requests sections.
2. Add/update a dedicated ADR explicitly authorizing:
   - Rides domain/persistence/API/frontend vertical slice;
   - Requests domain/persistence/API/frontend vertical slice.
3. Keep Fundraising and Payments separately owned and not automatically implemented by this authorization.
4. Reconcile the Requests wording so quantity/partial-claim behavior is unambiguous before schema work. If final product direction is partial quantity claims, update the older “exclusive claims” wording explicitly.
5. Lock Ride destination behavior: Event / Place / custom destination rules.
6. Lock Ride participation acceptance policy and cancellation rules needed for the core schema.
7. Lock Ride media rule from Section 4 of this plan.
8. Update affected authoritative docs:
   - `requirements.md`;
   - `structure.md` only if architecture/current topology wording needs adjustment;
   - `docs/DECISIONS.md` + dedicated ADR;
   - `docs/CANONICAL_MODEL.md` when the vertical slice officially begins and canonical models are authorized.
9. Update this ledger with evidence.

Forbidden scope:

- no Prisma tables yet;
- no fake backend;
- no Payments/Fundraising implementation;
- no generic Media domain;
- no navigation redesign.

DONE gate:

- authoritative documents no longer contradict implementation permission;
- partial-claim semantics are explicit;
- Ride destination/participation/media policies are explicit;
- docs are internally consistent;
- no source feature implementation claimed.

Evidence:

- Branch/worktree: `ride/gov-001-unfreeze-rides-requests` at foundation `8e28b8c23dc4a48574aaa3af52801a6172ea3a80`.
- Traced ADR-038 and ADR-048 in `docs/DECISIONS.md` plus `docs/adr/ADR-048-home-create-flow-ia.md`.
- Open PR overlap checked before edits: PR #173 touches `requirements.md` only for external Place photo-link behavior, not Ride/Requests/FundMe policy.
- Current source checked before edits: API has no canonical Rides/Requests/Fundraising/Payments modules; frontend has honest `packages/frontend/src/rides` and `packages/frontend/src/requests` shells only.
- Added `docs/adr/ADR-050-ride-requests-unfreeze.md` and updated `docs/DECISIONS.md` to explicitly unfreeze bounded Ride and Requests vertical slices while keeping Fundraising, Payments, ULTRAS and generic Media separately governed.
- Updated `requirements.md` to replace older exclusive Requests claim wording with quantity-based partial claims and to lock Ride destination, participation, cancellation, privacy and media rules.
- Updated `structure.md` and `docs/CANONICAL_MODEL.md` so governance no longer lists Ride/Requests as frozen and does not claim source feature implementation.
- PR #174 merged into `phase-0-foundation` on 2026-08-30.
- Merged foundation commit: `dd96e56dc766fb0e5fbc22c2809c91effc7215d7`.
- Final PR #174 head verified from GitHub: `99cc0f3f909b2a6aa501a26dafccfdcf9d9ae939`.
- GitHub CI for PR #174 exact head: `verify` completed successfully.
- Post-merge read-back verified `origin/phase-0-foundation` contains merge commit `dd96e56dc766fb0e5fbc22c2809c91effc7215d7` and no source/db/contracts/API files were part of GOV-001.
- Remaining risk: PR #173 remains open with a same-file `requirements.md` change limited to external Place photo-link behavior; it does not overlap Ride/Requests/FundMe policy. Browser/Telegram runtime smoke is not applicable to this docs-only governance slice.
- Next task: `RIDE-001 — Ride contracts and domain policy skeleton`; do not start it automatically.

---

## RIDE-001 — Ride contracts and domain policy skeleton

Status: **[~] IN PROGRESS**

Dependencies: `GOV-001`

Goal: define Ride-owned wire contracts and transport-independent domain policy without persistence or UI monoliths.

Expected files:

```text
packages/contracts/src/rides.ts
apps/api/src/modules/rides/domain/*
apps/api/src/modules/rides/application/*.repository.ts / narrow ports as needed
```

Required work:

- define bounded schemas/types for RideOffer, RideRequest, RideParticipation, RideMeetingPoint, waypoints, public projections, owner/member projections, and mutation inputs;
- do not put Ride implementation into `packages/contracts/src/index.ts`; index may re-export only;
- define lifecycle validation and safe public DTO shape;
- define narrow Event/Place reference ports if required;
- define repository port(s) by Ride persistence responsibility, not one global app repository.

DONE gate:

- contracts compile;
- domain/app layers do not import Express/Prisma;
- no unrelated domain contract/state added;
- architecture check remains clean;
- permanent focused policy/contract tests pass where applicable.

Evidence

- Branch: `ride/ride-001-contracts-policy`.
- PR: [#176](https://github.com/funmarket/HoomaUltimate/pull/176).
- Merged commit / current foundation HEAD: in-flight from `eda4ed9ba5f88188e8a7425213bb1b650b188689`.
- Source trace: `AGENTS.md`, `docs/LIVING_BUILD_PLAN.md`, full `rideplan.md`, Ride sections in `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, and `docs/adr/ADR-050-ride-requests-unfreeze.md`.
- Changed files: `packages/contracts/src/rides.ts`, `packages/contracts/package.json`, `packages/contracts/src/index.ts`, `apps/api/src/modules/rides/domain/ride-policy.ts`, `apps/api/src/modules/rides/application/ride-reference.readers.ts`, `apps/api/src/modules/rides/application/ride-offer.repository.ts`, `apps/api/src/modules/rides/application/ride-request.repository.ts`, `tests/ride-contract-policy.test.ts`, and this ledger only.
- Documentation updated: this in-flight RIDE-001 ledger entry with local implementation evidence; PR/CI/merge/read-back evidence still pending.
- Tests: `npm exec -- tsx --test tests\ride-contract-policy.test.ts` passed (6 tests); direct full unit suite via `.\node_modules\.bin\tsx.cmd --test <49 unit files>` passed (181 tests). `npm test` did not execute tests locally because `scripts/run-tests.mjs` hit Windows `spawn EINVAL` while spawning `npx.cmd`; this is recorded as runner/environment evidence, not a Ride source failure.
- Static/build checks: `npm run db:generate` passed after network-enabled Prisma engine download; `npm -w @hooma/contracts run typecheck` passed; `npm -w @hooma/api run typecheck` passed; `npm run architecture:check` passed; `npm exec -- prettier --check <touched files>` passed; `git diff --check` passed; `npm run build:packages` passed; changed-file boundary guard passed with no forbidden RIDE-001 files changed.
- PostgreSQL migration/integration proof: not applicable; RIDE-001 has no Prisma/schema/migration scope.
- Object-storage/Redis/Worker proof if applicable: not applicable; RIDE-001 has no media/storage/worker scope.
- Deployment/live proof if applicable: not applicable before merge; no runtime UI/API change in this slice.
- Remaining risk: in-flight until PR opens, GitHub CI passes on the exact PR head, merge/read-back evidence is recorded, and the final DONE ledger update is merged.
- Implementation score: local gate complete; PR/CI/merge gate pending.
- Next task: `RIDE-002` — not started.

---

## RIDE-002 — Ride core Prisma schema + committed migration

Status: **[ ] TODO**

Dependencies: `RIDE-001`

Goal: create only the canonical Ride core persistence required by the approved vertical slice.

Expected models, subject to GOV-001 final naming:

```text
RideOffer
RideRequest
RideParticipation
RideMeetingPoint
RideOfferWaypoint
```

Do **not** add `RideOfferVehiclePhoto` in this task unless the product owner explicitly merges RIDE-002 and RIDE-006. The preferred plan keeps media independently reviewable.

Required DB invariants/indexes:

- canonical User foreign keys;
- valid Event/Place references where approved;
- unique RideOffer/passenger participation identity;
- unique meeting point per participation if used;
- ordered waypoint indexes;
- status/departure/request query indexes from real read paths;
- constraints needed for valid counts/times where Prisma/SQL supports them cleanly.

Migration rules:

- committed migration SQL;
- no `db push`;
- no donor migration copy;
- no Requests/Fundraising/Payments tables in this migration.

DONE gate:

- `db:generate` + `db:validate` pass;
- migration deploys to disposable PostgreSQL;
- migration status/read-back verified;
- schema and migration SQL agree;
- canonical model docs updated.

Evidence: _fill when complete_

---

## RIDE-003 — Ride Prisma repository + concurrency-safe capacity lifecycle

Status: **[ ] TODO**

Dependencies: `RIDE-002`

Goal: implement Ride persistence behind Ride-owned repository ports with real PostgreSQL transaction/locking correctness.

Required work:

- public list/detail queries with privacy-safe selects;
- owner/member read paths;
- offer/request creation/update/cancel persistence;
- participation request/accept/reject/cancel lifecycle;
- exact meeting-point storage/read boundary;
- row lock/equivalent around acceptance/capacity decisions;
- prevent overbooking;
- waypoint persistence/order;
- no direct writes to Events/Places/Communities tables.

Required real PostgreSQL integration proof:

- final-seat race cannot overbook;
- duplicate participant identity cannot duplicate rows;
- cancellation releases capacity per policy;
- terminal state transitions reject invalid rewrites;
- unauthorized/private projections are impossible at repository/service boundary as designed.

DONE gate:

- real disposable PostgreSQL concurrency tests pass;
- repository remains Ride-owned and narrowly scoped;
- no HTTP/Express logic in persistence;
- no cross-domain infrastructure import.

Evidence: _fill when complete_

---

## RIDE-004 — Ride application service + authorization + Event/Place reference adapters

Status: **[ ] TODO**

Dependencies: `RIDE-003`

Goal: implement complete server-side Ride business policy.

Required work:

- derive actors from authenticated user;
- owner authorization for offer/request mutation;
- passenger/driver authorization;
- meeting-point authorization;
- validate Event/Place destination through narrow reader/adapter boundaries;
- reject invalid/terminal state mutations with stable AppError codes;
- no whole-domain Community/Event/Place service injection unless a narrow existing boundary already correctly represents the need;
- no Payments/Whistle coupling yet.

DONE gate:

- service tests prove allowed/denied paths;
- Event/Place remain canonical owners;
- Rides never writes another domain's tables;
- error/state semantics are stable enough for HTTP/frontend.

Evidence: _fill when complete_

---

## RIDE-005 — Ride public/member HTTP APIs + bootstrap wiring

Status: **[ ] TODO**

Dependencies: `RIDE-004`

Goal: expose the real Ride slice through the canonical public/member API boundaries.

Expected shared files:

```text
apps/api/src/modules/rides/http/*
apps/api/src/http/public-v1/router.ts
apps/api/src/http/v1/router.ts
apps/api/src/bootstrap/container.ts
```

Rules:

- shared authentication middleware remains the member boundary;
- actor identity comes from `getAuth(req).userId` or the canonical equivalent;
- HTTP parses contracts and delegates to application services;
- HTTP never imports Prisma;
- public DTOs never include exact meeting point or private user/location data;
- do not add `/api/v1/community-actions` or other catch-all routes.

DONE gate:

- route-level tests cover public/member/authz/error states;
- API read-back proves persisted Ride state;
- current existing API domains remain unaffected;
- typecheck/lint/architecture/build relevant checks pass.

Evidence: _fill when complete_

---

## RIDE-006 — Ride vehicle-photo persistence + object storage

Status: **[ ] TODO**

Dependencies: `RIDE-005`

Goal: implement the Section 4 media contract as a clean Ride-owned attachment without creating a generic Media monolith.

Expected work:

```text
RideOfferVehiclePhoto Prisma model + bounded migration
Ride media repository methods/port as appropriate
Ride media application service or focused Ride service responsibility
ObjectStorage injection from existing @hooma/storage
Ride-owned upload/delete/public delivery HTTP endpoints
```

Required behavior:

- only RideOffer owner can upload/replace/delete;
- approved MIME types and byte limit enforced server-side;
- bytes stored only in object storage;
- DB stores only Ride photo metadata/reference;
- versioned Ride-owned object keys;
- DB metadata switch only after new object exists;
- old object deleted or durably scheduled for cleanup;
- failed upload does not delete/corrupt RideOffer;
- public delivery does not expose storage credentials;
- no base64/Prisma Bytes/public bucket shortcut.

DONE gate:

- real or appropriately configured object-storage integration proof where available;
- permanent upload/replace/delete/authz tests;
- migration proof;
- database inspection/read-back shows only metadata/reference;
- object inspection proves bytes exist in storage;
- remaining orphan-cleanup risk explicitly zero or recorded for `RIDE-009`.

Evidence: _fill when complete_

---

## RIDE-007 — Ride frontend API client + real Ride UI vertical slice

Status: **[ ] TODO**

Dependencies: `RIDE-005`; `RIDE-006` required before vehicle photo is presented as complete

Goal: replace the honest Ride shell with the actual product flow using Ride-owned frontend state/API.

Required work:

- `packages/frontend/src/rides/api.ts` using shared `HoomaTransport`;
- Ride gateway: `TAKE ME TO THE GAME | RIDE OFFERS`;
- Ride Offer list/detail/create flows;
- Ride Request create flow;
- participation request and owner response states per approved policy;
- camera + upload vehicle photo UI;
- exact meeting-point UI only for authorized users;
- loading/empty/error/pending/success/terminal states;
- mobile-first and Telegram-safe behavior;
- canonical router child routes as required;
- do not make opening Ride load Requests/FundMe/Payments.

DONE gate:

- Web action -> API -> authz -> service -> repository -> DB -> read-back proven for core flows;
- photo upload/read-back proven when RIDE-006 is complete;
- frontend has no direct database imports/API strings in app shell contrary to architecture rules;
- mobile/Telegram route behavior checked;
- no fake Ride data remains.

Evidence: _fill when complete_

---

## REQ-001 — Requests governance-to-contract reconciliation

Status: **[ ] TODO**

Dependencies: `GOV-001`; recommended after `RIDE-007` merge to avoid shared-file races

Goal: confirm the Requests-specific contract implemented in GOV-001 and create domain-owned contracts/policies.

Expected work:

```text
packages/contracts/src/requests.ts
apps/api/src/modules/requests/domain/*
apps/api/src/modules/requests/application/*
```

Rules:

- partial claims only if GOV-001 finalized them;
- Requests does not import Rides/Fundraising/Payments;
- money/transport suggestions are navigation/orchestration, not Request persistence types;
- no generic post/feed model.

DONE gate:

- contracts/policies compile/test;
- no persistence yet unless explicitly merged with REQ-002 by owner decision;
- no cross-domain monolith.

Evidence: _fill when complete_

---

## REQ-002 — Requests Prisma schema + migration

Status: **[ ] TODO**

Dependencies: `REQ-001`

Goal: create only canonical `Request` + `RequestClaim` persistence and required relations/indexes.

Required work:

- Request + Claim models;
- canonical User refs;
- optional Community/Event/Place refs only if approved product behavior requires them;
- lifecycle/status fields;
- quantity/unit/expiry;
- unique/idempotency-friendly constraints;
- query indexes;
- committed bounded migration.

DONE gate:

- disposable PostgreSQL migration proof;
- schema/migration/docs agree;
- no Ride/Fundraising/Payments tables touched.

Evidence: _fill when complete_

---

## REQ-003 — Requests repository + concurrency-safe claim lifecycle

Status: **[ ] TODO**

Dependencies: `REQ-002`

Goal: implement canonical Request/Claim persistence and quantity allocation with real PostgreSQL locking.

Required proof:

- two concurrent claims cannot exceed remaining quantity;
- release restores availability;
- expired/cancelled Requests reject claims;
- duplicate retry does not produce uncontrolled duplicate state;
- remaining quantity read-back derives from canonical state;
- terminal transitions are protected.

DONE gate:

- real PostgreSQL integration tests pass;
- repository owns only Requests tables;
- no cross-domain writes.

Evidence: _fill when complete_

---

## REQ-004 — Requests application/authz + HTTP APIs

Status: **[ ] TODO**

Dependencies: `REQ-003`

Goal: expose Requests through canonical public/member boundaries with server-side authority.

Required work:

- requester/claimer identities from auth;
- owner/claimer lifecycle policy;
- public privacy-safe list/detail;
- create/edit/cancel;
- claim/release/complete;
- stable error codes;
- router/container wiring as bounded Requests module.

DONE gate:

- route/authz tests;
- API persistence/read-back proof;
- no FundMe backend mixed into Requests.

Evidence: _fill when complete_

---

## REQ-005 — Requests frontend real vertical slice

Status: **[ ] TODO**

Dependencies: `REQ-004`

Goal: replace only the Requests tab's honest shell with real Requests behavior while leaving FundMe separately owned.

Required work:

- `packages/frontend/src/requests/api.ts`;
- feed/detail/create;
- claim/release/complete UI per policy;
- quantity/remaining states;
- loading/empty/error/pending/success/terminal states;
- preserve `Requests | FundMe` tabs;
- opening Requests must not load Fundraising/Payments merely because FundMe tab exists.

DONE gate:

- complete UI -> API -> DB -> read-back path proven;
- FundMe shell remains honest if Fundraising is still frozen;
- mobile/Telegram behavior checked.

Evidence: _fill when complete_

---

## RIDE-008 — Ride matching v1

Status: **[ ] TODO**

Dependencies: `RIDE-007`; may also use approved Event/Place references

Goal: return useful Ride matches without creating a matching monolith or speculative geospatial stack.

V1 inputs:

- Event/destination compatibility;
- departure time window;
- pickup/origin/waypoint area compatibility;
- required passenger seats;
- only active/open records.

Required work:

- Ride-owned matching application service/read model;
- no generic global RecommendationService;
- no canonical `Match` table unless explicitly justified;
- no PostGIS/provider integration in this task.

DONE gate:

- deterministic matching tests;
- privacy-safe results;
- no unrelated data loads;
- Ride Request can read compatible offers through Ride-owned boundary.

Evidence: _fill when complete_

---

## RIDE-009 — Ride media cleanup/reconciliation hardening

Status: **[ ] TODO**

Dependencies: `RIDE-006`

Goal: remove any remaining object/metadata orphan risk that prevented RIDE-006 from receiving complete infrastructure confidence.

Possible implementation, chosen only after tracing existing worker/outbox facilities:

- bounded object-delete outbox event/handler;
- stale Ride object reconciliation by Ride-owned prefix/metadata;
- idempotent delete handler;
- no generic giant cleanup script.

DONE gate:

- failed/retried photo replacement/delete cannot accumulate uncontrolled stale objects;
- cleanup is idempotent;
- worker retries do not duplicate business policy;
- storage credentials/keys remain protected;
- permanent tests/integration proof exist.

Evidence: _fill when complete_

---

## RIDE-010 — Ride reliability/confirmation lifecycle

Status: **[ ] TODO**

Dependencies: `RIDE-007`

Goal: add real confirmation/cancellation/completion facts needed for reliability without inventing universal star ratings.

Required work:

- product-owner-confirmed lifecycle fields/transitions only;
- durable cancellation/completion facts;
- derived reliability projection from canonical Ride history;
- no global `User.rating` shortcut;
- concurrency/state transition tests.

DONE gate:

- lifecycle is complete enough that reliability figures are derived from real facts;
- terminal states cannot be rewritten incorrectly;
- UI labels do not imply facts HOOMA cannot prove.

Evidence: _fill when complete_

---

## DISC-001 — Ride/Requests discovery + Match-Day projections

Status: **[ ] TODO**

Dependencies: `RIDE-007`, `REQ-005`; matching/reliability are not mandatory unless product scope requires them

Goal: surface Ride/Request information in relevant Discovery/Match-Day views without transferring canonical ownership.

Required work:

- privacy-safe read projections only;
- no duplicate source tables;
- no generic JSON discovery owner;
- opening unrelated Home areas must not force Ride/Requests state to load;
- Event/Match-Day may show counts/entry links, not copied canonical records.

DONE gate:

- projection correctness verified against owner tables;
- canonical updates are visible through discovery without duplicate writes;
- privacy-safe data only.

Evidence: _fill when complete_

---

## PAY-001 — Payments separate authorization/design

Status: **[ ] TODO**

Dependencies: product-owner authorization after core Ride/Requests are stable

Goal: separately unfreeze/design Payments as a lower-level capability.

Locked initial rails:

```text
CASH
TELEGRAM_STARS
```

Rules:

- Payments owns intents/provider/idempotency/settlement;
- Payments does not own Ride/Requests/Fundraising records;
- provider callbacks are idempotent;
- no credit cards/HYBRID by implication;
- async provider handling uses proper outbox/worker boundaries where required.

DONE gate:

- dedicated governance + canonical model exists before payment schema implementation.

Evidence: _fill when complete_

---

## FUND-001 — Fundraising/FundMe separate vertical slice

Status: **[ ] TODO**

Dependencies: `PAY-001` and explicit product-owner authorization

Goal: replace the FundMe honest shell with real Fundraising while keeping presentation grouped under Requests.

Required ownership:

```text
FundraiserCampaign
FundraiserContribution
```

Rules:

- `/requests/fundme` remains the UI entry;
- backend/client lives under Fundraising ownership;
- progress derives from canonical contribution/settlement state rather than a freely editable raised counter;
- Fundraising uses a narrow Payments port;
- Requests service/repository never owns campaign/contribution/payment state.

DONE gate:

- complete Fundraising vertical slice and payment interaction proven;
- Requests tab remains independent;
- idempotent contribution/payment replay proven where relevant.

Evidence: _fill when complete_

---

## WHISTLE-RIDE-001 — Ride Whistle authorization bridge

Status: **[ ] TODO**

Dependencies: Ride participation lifecycle stable and explicit product-owner authorization

Goal: enable the existing shared Whistle engine for Ride context without creating Ride chat.

Required rule:

```text
Whistle -> narrow Ride access reader -> authorized driver/participant
```

Do not persist Whistle body in Ride/PostgreSQL.

DONE gate:

- unauthorized users cannot list/send/read Ride Whistles;
- shared Whistle quota/retention rules remain untouched;
- no parallel messaging system created.

Evidence: _fill when complete_

---

# 26. Recommended merge/execution order

Unless explicitly changed by the product owner:

```text
PLAN-000  DONE
   |
GOV-001
   |
RIDE-001
   |
RIDE-002
   |
RIDE-003
   |
RIDE-004
   |
RIDE-005
   |
RIDE-006
   |
RIDE-007
   |
REQ-001
   |
REQ-002
   |
REQ-003
   |
REQ-004
   |
REQ-005
   |
RIDE-008 matching
   |
RIDE-009 media hardening if still needed
   |
RIDE-010 reliability
   |
DISC-001 projections
   |
PAY-001
   |
FUND-001
   |
WHISTLE-RIDE-001 when separately authorized
```

The product owner may reorder independent later tasks, but agents must not infer authorization to run overlapping shared-file migrations simultaneously.

---

# 27. Mandatory per-task completion record template

When finishing any task above, replace its `Evidence: _fill when complete_` section with this exact structure:

```text
Evidence
- Branch:
- PR:
- Merged commit / current foundation HEAD:
- Source trace:
- Changed files:
- Documentation updated:
- Tests:
- Static/build checks:
- PostgreSQL migration/integration proof:
- Object-storage/Redis/Worker proof if applicable:
- Deployment/live proof if applicable:
- Remaining risk:
- Implementation score: X/10
- Next task: <ID> — not started
```

If a required proof cannot be run, state `NOT VERIFIED` and keep the task out of `[x] DONE` when that proof is part of the DONE gate.

---

# 28. Stop conditions specific to this plan

Stop and report instead of improvising if:

- another agent opens an overlapping Ride/Requests schema/API PR;
- `phase-0-foundation` moves with overlapping changes after task ownership begins;
- current requirements/ADR conflict with a task's locked behavior;
- correct Event/Place/Community boundary cannot be identified;
- a proposed implementation requires a generic `Action`, `Social`, `CommunityActions`, `MediaAsset`, or cross-domain repository merely for convenience;
- an image solution requires storing binary/base64 photo content in PostgreSQL;
- exact Ride location would become publicly exposed;
- seat/request quantity correctness can only be achieved with frontend counters instead of database-safe invariants;
- a payment/fundraising dependency is required before those domains are authorized;
- the only way to claim completion is to skip real migration/concurrency/storage proof.

---

# 29. Definition of success for the overall plan

This plan is complete only when the authorized product scope has all of the following:

```text
Rides owns clean Ride persistence and lifecycle.
Requests owns clean Request/Claim persistence and lifecycle.
Fundraising, when authorized, owns campaigns/contributions.
Payments, when authorized, owns payment state.
Photos/media bytes live in object storage.
Ride photo metadata lives in its single-purpose designated Ride table until Media is separately authorized.
Events/Places remain canonical references, not duplicated data.
Exact Ride location remains private by server policy.
Seat and quantity concurrency is proven with real PostgreSQL.
Public/member APIs are separated correctly.
Frontend feature state/clients are domain-owned and independently loaded.
Discovery is projection only.
Whistle remains one shared engine.
No monolithic services/scripts/contracts/repositories/stores were introduced.
Every completed task is marked [x] DONE here with evidence.
Governing docs agree with merged source.
```

Until those conditions are evidenced, agents must report the precise incomplete task rather than declaring the whole Ride/Requests/FundMe program complete.
