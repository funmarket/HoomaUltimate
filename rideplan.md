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

Status: **[x] DONE**

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
- Merged commit / current foundation HEAD: PR #176 merged at `f292d29fa1cd3e7cfb554a43b58f4073348df7e4`; read-back confirmed `origin/phase-0-foundation` is `f292d29fa1cd3e7cfb554a43b58f4073348df7e4`, with parents `eda4ed9ba5f88188e8a7425213bb1b650b188689` and PR head `36b709661cc0d29e3e8146e9d58062ec46ff7924`.
- Source trace: `AGENTS.md`, `docs/LIVING_BUILD_PLAN.md`, full `rideplan.md`, Ride sections in `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, and `docs/adr/ADR-050-ride-requests-unfreeze.md`.
- Changed files: `packages/contracts/src/rides.ts`, `packages/contracts/package.json`, `packages/contracts/src/index.ts`, `apps/api/src/modules/rides/domain/ride-policy.ts`, `apps/api/src/modules/rides/application/ride-reference.readers.ts`, `apps/api/src/modules/rides/application/ride-offer.repository.ts`, `apps/api/src/modules/rides/application/ride-request.repository.ts`, `tests/ride-contract-policy.test.ts`, and this ledger only.
- Documentation updated: this RIDE-001 ledger entry was kept live during implementation and closed after GitHub merge/read-back evidence.
- Tests: `npm exec -- tsx --test tests\ride-contract-policy.test.ts` passed (6 tests); direct full unit suite via `.\node_modules\.bin\tsx.cmd --test <49 unit files>` passed (181 tests). `npm test` did not execute tests locally because `scripts/run-tests.mjs` hit Windows `spawn EINVAL` while spawning `npx.cmd`; this is recorded as runner/environment evidence, not a Ride source failure.
- Static/build checks: `npm run db:generate` passed after network-enabled Prisma engine download; `npm -w @hooma/contracts run typecheck` passed; `npm -w @hooma/api run typecheck` passed; `npm run architecture:check` passed; `npm exec -- prettier --check <touched files>` passed; `git diff --check` passed; `npm run build:packages` passed; changed-file boundary guard passed with no forbidden RIDE-001 files changed. GitHub CI run `33325767161`, job `99295490282`, passed on exact PR head `36b709661cc0d29e3e8146e9d58062ec46ff7924`, including `npm ci`, `db:generate`, `db:validate`, `db:migrate:deploy`, `architecture:check`, changed-file formatting, changed-source lint, `typecheck`, `build:packages`, `npm test`, `build`, integration tests, `deploy:preflight`, `security:check`, and `db:migrate:status`.
- PostgreSQL migration/integration proof: not applicable; RIDE-001 has no Prisma/schema/migration scope.
- Object-storage/Redis/Worker proof if applicable: not applicable; RIDE-001 has no media/storage/worker scope.
- Deployment/live proof if applicable: not applicable; RIDE-001 adds contracts, domain policy, and application ports only, with no runtime UI/API route.
- Remaining risk: browser/Telegram runtime smoke is not applicable to this non-runtime slice; RIDE-002 is not started and still owns Prisma schema/migration work.
- Implementation score: complete for RIDE-001; post-merge read-back complete.
- Next task: `RIDE-002` — not started.

---

## RIDE-002 — Ride core Prisma schema + committed migration

Status: **[x] DONE**

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

Evidence

- Branch: `ride/ride-002-prisma-schema`.
- PR: [#178](https://github.com/funmarket/HoomaUltimate/pull/178).
- Merged commit / current foundation HEAD: PR #178 merged at `a0fa23b5b6a15b990953886808ad0a757ebd755c`; read-back confirmed `origin/phase-0-foundation` is `a0fa23b5b6a15b990953886808ad0a757ebd755c`, with parents `8dc514214d1c092b5b8f48fc76e1e974563512fa` and PR head `6cd8acbe83a7763d6e485ec3936748048e7a80eb`.
- Source trace: `AGENTS.md`, `docs/LIVING_BUILD_PLAN.md`, full `rideplan.md`, Ride sections in `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, `docs/adr/ADR-050-ride-requests-unfreeze.md`, existing Prisma schema, and recent migrations.
- Changed files: `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/20260830185000_ride_core_persistence/migration.sql`, `tests/ride-prisma-schema.test.mjs`, `docs/CANONICAL_MODEL.md`, and this ledger only.
- Documentation updated: `docs/CANONICAL_MODEL.md` records the current core Ride persistence and keeps vehicle-photo metadata deferred; this ledger was kept live during implementation and closed after GitHub merge/read-back evidence.
- Tests: `npm exec -- tsx --test tests\ride-prisma-schema.test.mjs` passed (3 tests); direct full unit suite via `.\node_modules\.bin\tsx.cmd --test <50 unit files>` passed (184 tests).
- Static/build checks: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hooma_ultimate_test npm run db:validate` passed; `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hooma_ultimate_test npm run db:generate` passed; `npm run architecture:check` passed; `npm -w @hooma/database run typecheck` passed; `npm -w @hooma/database run build` passed; `npm exec -- prettier --check docs\CANONICAL_MODEL.md rideplan.md` passed; `git diff --check` passed; `npm run build:packages` passed. GitHub CI run `33327194163`, job `99299319142`, passed on exact PR head `6cd8acbe83a7763d6e485ec3936748048e7a80eb`, including `npm ci`, `db:generate`, `db:validate`, `db:migrate:deploy`, `architecture:check`, changed-file formatting, changed-source lint, `typecheck`, `build:packages`, `npm test`, `build`, integration tests, `deploy:preflight`, `security:check`, and `db:migrate:status`.
- PostgreSQL migration/integration proof: GitHub CI disposable PostgreSQL `db:migrate:deploy` and `db:migrate:status` passed on exact PR head `6cd8acbe83a7763d6e485ec3936748048e7a80eb`; local port `5432` was detected but not proven disposable, so no local migration was run against it.
- Object-storage/Redis/Worker proof if applicable: not applicable; RIDE-002 has no media/storage/Redis/worker scope.
- Deployment/live proof if applicable: not applicable; RIDE-002 adds schema/migration only and no runtime UI/API route.
- Remaining risk: RIDE-003 is not started and still owns Prisma repository plus concurrency-safe capacity lifecycle; browser/Telegram runtime smoke is not applicable to this schema-only slice.
- Implementation score: complete for RIDE-002; post-merge read-back complete.
- Next task: `RIDE-003` — not started.

---

## RIDE-003 — Ride Prisma repository + concurrency-safe capacity lifecycle

Status: **[x] DONE**

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

Evidence

- Branch: `ride/ride-003-prisma-repository`
- PR: #180 (`https://github.com/funmarket/HoomaUltimate/pull/180`)
- Merged commit / current foundation HEAD: PR #180 merged as `ef1636e54cde79c414476f0f11fbc632f4dd5645`; `origin/phase-0-foundation` read-back after merge was `ef1636e54cde79c414476f0f11fbc632f4dd5645`.
- Source trace: `AGENTS.md`, `docs/LIVING_BUILD_PLAN.md`, governing docs, full `rideplan.md`, RIDE-001 ports/policy, RIDE-002 Prisma schema, and existing repository/test patterns were read before implementation. Latest `phase-0-foundation` was fetched before implementation and immediately before merge.
- Changed files: `apps/api/src/modules/rides/infrastructure/prisma-ride.repository.ts`, `tests/rides.repository.integration.test.ts`, `rideplan.md`.
- Documentation updated: RIDE-003 implementation evidence was recorded while in progress; this docs-only closeout records merged foundation truth after GitHub read-back.
- Tests: direct local unit suite passed with 184/184 tests using `npx.cmd tsx --test` and the unit-only file list; after the first CI failure, the unit-only suite was rerun and passed 184/184 again. GitHub CI on exact final PR head `579aac0d822010e188e4ebd428b5dc45a34a9833` passed `npm test` and `npm run test:integration`.
- Static/build checks: local `db:generate`, `db:validate`, full workspace `typecheck`, API typecheck after formatting/fix, `architecture:check`, `build:packages`, Prettier check for RIDE-003 files, and `git diff --check` passed. GitHub CI on exact final PR head `579aac0d822010e188e4ebd428b5dc45a34a9833` passed `npm ci`, `db:generate`, `db:validate`, `db:migrate:deploy`, `architecture:check`, changed-file formatting, changed-source lint, `typecheck`, `build:packages`, `npm test`, `build`, integration tests, `deploy:preflight`, `security:check`, and `db:migrate:status`.
- PostgreSQL migration/integration proof: GitHub CI used disposable PostgreSQL and passed `tests/rides.repository.integration.test.ts` on exact final PR head `579aac0d822010e188e4ebd428b5dc45a34a9833`. The test suite proved final-seat acceptance cannot overbook, duplicate passenger requests do not create duplicate rows, cancellation releases capacity, terminal rewrites are rejected, exact meeting points are visible only to the driver/accepted passenger, and public Ride request projections do not expose requester identity. The first CI head `f646b60107bea7667e495ca78e7a3b40ecfc2cbe` failed duplicate-passenger idempotency; the repository was corrected by locking the `RideOffer` row before checking/creating the unique passenger participation, then final CI passed.
- Object-storage/Redis/Worker proof if applicable: not applicable; RIDE-003 does not include media/storage/Redis/worker work.
- Deployment/live proof if applicable: not applicable; RIDE-003 has no HTTP/frontend route.
- Remaining risk: PR #181 is open and touches `apps/api/src/bootstrap/container.ts`, which may overlap later RIDE-005 bootstrap wiring but does not overlap RIDE-003. Browser/Telegram Ride runtime remains unchanged and unverified because UI/API work belongs to later tasks.
- Implementation score: 10/10 for RIDE-003 scope after CI PostgreSQL proof and merge/read-back.
- Next task: `RIDE-004` — not started.

---

## RIDE-004 — Ride application service + authorization + Event/Place reference adapters

Status: **[x] DONE**

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

Evidence

- Branch: `ride/ride-004-service-authz`
- PR: #183 (`https://github.com/funmarket/HoomaUltimate/pull/183`)
- Merged commit / current foundation HEAD: PR #183 merged as `ea6f3521d179cb8d51bf24aebe952f7234b2542a`; `origin/phase-0-foundation` read-back after merge was `ea6f3521d179cb8d51bf24aebe952f7234b2542a`.
- Source trace: `AGENTS.md`, `docs/LIVING_BUILD_PLAN.md`, relevant `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, full `rideplan.md`, existing Ride contracts/policy/repository ports, RIDE-003 Prisma repository, and existing Event/Place service patterns were inspected before implementation.
- Changed files: `apps/api/src/modules/rides/application/ride.service.ts`, `apps/api/src/modules/rides/infrastructure/prisma-ride-reference.readers.ts`, `tests/ride-service.test.ts`, `rideplan.md`.
- Documentation updated: RIDE-004 implementation evidence was recorded while in progress; this docs-only closeout records merged foundation truth after GitHub read-back.
- Tests: focused Ride contract/service tests passed 15/15 with `npx.cmd tsx --test tests/ride-service.test.ts tests/ride-contract-policy.test.ts`; direct unit-only suite passed 193/193 after adding the Ride service tests. GitHub CI on exact PR head `e05ff5c25ddb664c5c3379b4f5ac24e3da0e555d` passed `npm test` and `npm run test:integration`.
- Static/build checks: local API typecheck, full workspace typecheck, `architecture:check`, API build, Prettier check for RIDE-004 source/test/doc files, and boundary scans passed. GitHub CI on exact PR head `e05ff5c25ddb664c5c3379b4f5ac24e3da0e555d` passed `npm ci`, `db:generate`, `db:validate`, `db:migrate:deploy`, `architecture:check`, changed-file formatting, changed-source lint, `typecheck`, `build:packages`, `npm test`, `build`, integration tests, `deploy:preflight`, `security:check`, and `db:migrate:status`.
- PostgreSQL migration/integration proof: not applicable; RIDE-004 adds application service policy and read-only reference adapters, not schema/migration changes. RIDE-005 will own HTTP/API persistence read-back.
- Object-storage/Redis/Worker proof if applicable: not applicable.
- Deployment/live proof if applicable: not applicable; RIDE-004 has no HTTP/frontend route.
- Remaining risk: PR #181 remains open and touches future RIDE-005 bootstrap/container wiring, so RIDE-005 must not start until that overlap is resolved or explicitly sequenced. Browser/Telegram Ride runtime remains unchanged and unverified because HTTP/frontend work belongs to later tasks.
- Implementation score: 10/10 for RIDE-004 scope after service tests, CI, and merge/read-back.
- Next task: `ARCH-RIDE-001` — mandatory architecture checkpoint before RIDE-005; not started.

---

## ARCH-RIDE-001 — Verify Ride application/HTTP error dependency before HTTP implementation

Status: **[x] DONE**

Dependencies: `RIDE-004`

**MANDATORY RESUME GATE:** This checkpoint must be completed before `RIDE-005` or any later Ride task proceeds. If an agent has already started RIDE-005 or later work on an unmerged branch, stop feature expansion, preserve the work without merging it, perform this checkpoint against the latest `phase-0-foundation`, and resume only after this task is `[x] DONE`. Do not bypass this gate because RIDE-004 was previously marked DONE or because existing CI is green.

Goal: determine with repository evidence whether the RIDE-004 application service has an invalid reverse dependency on the HTTP transport layer, correct only the authoritative boundary if necessary, and prevent RIDE-005 from cementing an architectural inversion.

Known concern to verify, not blindly assume:

```text
apps/api/src/modules/rides/application/ride.service.ts
  -> imports AppError
  -> apps/api/src/http/errors/app-error.ts
```

The governing architecture states:

```text
http -> application -> domain
infrastructure -> application/domain ports
```

Therefore `application -> http` may be a reverse dependency. The agent must prove whether this is a real violation in the current repository before changing code.

### Mandatory inspection before any edit

1. Fetch latest `phase-0-foundation` and record exact HEAD.
2. Inspect all open PRs and active/recent overlapping branches touching Ride, API errors, HTTP architecture, bootstrap/container, or RIDE-005.
3. Read `AGENTS.md`, `docs/LIVING_BUILD_PLAN.md`, full `rideplan.md`, `structure.md`, `requirements.md`, `docs/DECISIONS.md`, and `docs/CANONICAL_MODEL.md`.
4. Inspect `apps/api/src/http/errors/app-error.ts` and every current consumer/import of `AppError`.
5. Search all `apps/api/src/modules/**/application/**` and `domain/**` code for imports from `apps/api/src/http/**` or equivalent HTTP transport paths.
6. Inspect `scripts/architecture-check.mjs` and determine whether it currently guards `application -> HTTP` and `domain -> HTTP` dependency direction.
7. Inspect existing transport-neutral/domain/application error patterns before proposing a new abstraction.

### Questions that must be answered with source evidence

- What is `AppError` actually intended to represent: HTTP-specific transport state, a transport-neutral application error historically located under `http/`, or an explicitly governed shared primitive?
- Is the current Ride import a `VIOLATION` or `NOT A VIOLATION` under `structure.md` and existing ADRs?
- Is the pattern isolated to Ride, existing legacy debt, or a deliberate widespread architecture convention?
- If wrong, what existing canonical transport-neutral error pattern should Ride use?
- If no correct existing primitive exists, what is the smallest bounded correction that restores dependency direction without creating a universal error framework?
- Does the architecture checker have a real guard gap?

Do not use vague conclusions such as `probably fine`, `likely intentional`, or `seems okay`.

### If NOT A VIOLATION

- Record the exact governing/source evidence proving why.
- Do not refactor merely for naming or aesthetics.
- If the path is misleading but intentionally allowed, record that debt/risk without broad cleanup.
- Verify current tests/checks remain green.
- Mark this checkpoint DONE with evidence, then RIDE-005 may proceed.

### If VIOLATION

Correct the smallest authoritative boundary **before** RIDE-005.

The resulting dependency must remain conceptually:

```text
Ride HTTP adapter
  -> Ride application service
      -> Ride domain
```

not:

```text
Ride application service
  -> HTTP transport/errors
```

Prefer an existing transport-neutral error primitive if one already exists. If Ride/application-owned errors are the correct repository pattern, the HTTP layer should map them to HTTP/AppError/status responses. Do not create a second parallel error authority while leaving the old one canonical.

### Forbidden scope

Do not turn this checkpoint into a repository-wide error migration. Do not:

- refactor unrelated domains merely for consistency;
- move every API error class;
- create a giant `errors.ts` or universal error framework;
- create compatibility wrappers/shims;
- change public API response semantics unnecessarily;
- touch Requests/FundMe/Payments/Whistle/Watch/Pitch/Gamers/Play/Places except the absolute minimum needed if a genuinely shared primitive is moved;
- start RIDE-005 HTTP routes before this checkpoint is complete.

If the correct fix would require a broad cross-repository migration that cannot be bounded safely, mark this task `[!] BLOCKED` and report the exact files/architecture conflict instead of improvising.

### Architecture guard requirement

If the dependency is forbidden by `structure.md` and `scripts/architecture-check.mjs` does not detect it, treat that as a guard gap. Add or adjust only a focused rule if it can be expressed cleanly without making the checker monolithic. Do not create another architecture-check script and do not add a brittle Ride-filename-only rule when a directory dependency rule is appropriate.

### Required verification if source changes

Run the strongest applicable checks, including at minimum:

```text
npm run architecture:check
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Also run focused Ride application/service tests and any API error tests affected by the correction.

Verify explicitly that:

- Ride application/domain no longer depends on HTTP transport if the dependency was ruled invalid;
- existing HTTP error behavior remains correct;
- Ride authorization and lifecycle behavior remains unchanged;
- Ride policy/error mapping remains correct;
- unrelated domains are not broken.

### Plan-history rule

Do not automatically revert `RIDE-004` from DONE to TODO. If its behavior remains valid and this is a bounded architecture follow-up, keep RIDE-004 historical completion intact and record this checkpoint separately. Only challenge the RIDE-004 DONE status if its original completion gate was materially false, and document why before altering history.

### DONE gate

This task may be marked `[x] DONE` only when the evidence block states all of the following:

```text
Current foundation HEAD:
Open overlapping PRs:
Concern:
Confirmed violation: YES / NO
Why:
Files inspected:
All application/domain -> HTTP imports found:
Existing canonical error pattern:
Change required: YES / NO
Changed files if any:
Architecture guard gap found/fixed:
Tests/checks run:
Results:
Remaining risks:
Safe to begin RIDE-005: YES / NO
```

`Safe to begin RIDE-005: YES` is mandatory before `RIDE-005` begins. If it is `NO`, this checkpoint remains BLOCKED/not DONE and RIDE-005 must not proceed.

Evidence

- Branch: `ride/arch-ride-001-error-boundary`; follow-up guard-hardening branch `ride/arch-ride-001-guard-hardening`; docs-only closeout branch `ride/arch-ride-001-closeout`.
- PR: #187 (`https://github.com/funmarket/HoomaUltimate/pull/187`) merged the Ride error-boundary correction; #188 (`https://github.com/funmarket/HoomaUltimate/pull/188`) merged the architecture guard hardening.
- Merged commit / current foundation HEAD: PR #187 merged as `12ae57cee249f68a53dd3baf9834221ab9ab28d0`; PR #188 merged as `28000d34ce384172faa1e6e18339f37634fbbb5b`; `origin/phase-0-foundation` read-back after PR #188 merge was `28000d34ce384172faa1e6e18339f37634fbbb5b`.
- Current foundation HEAD: `28000d34ce384172faa1e6e18339f37634fbbb5b`
- Open overlapping PRs: none against `phase-0-foundation` at checkpoint start; none after PR #188 merge/read-back.
- Concern: `apps/api/src/modules/rides/application/ride.service.ts` imported `AppError` from `apps/api/src/http/errors/app-error.ts`, creating a potential Ride application -> HTTP transport dependency before Ride HTTP routes were added.
- Confirmed violation: YES, for Ride. `structure.md` requires `http -> application -> domain`, and `ARCH-RIDE-001` explicitly forbids cementing `Ride application service -> HTTP transport/errors`.
- Why: `AppError` carries HTTP status and lives under `apps/api/src/http/errors`; Ride application policy should expose Ride-owned errors and let HTTP map them to transport responses.
- Files inspected: `AGENTS.md`, `docs/LIVING_BUILD_PLAN.md`, full `rideplan.md`, `structure.md`, `requirements.md`, `docs/DECISIONS.md`, `docs/CANONICAL_MODEL.md`, `apps/api/src/http/errors/app-error.ts`, `apps/api/src/http/errors/error-handler.ts`, `apps/api/src/modules/events/domain/event-error.ts`, `apps/api/src/modules/rides/application/ride.service.ts`, `tests/ride-service.test.ts`, and `scripts/architecture-check.mjs`.
- All application/domain -> HTTP imports found: existing legacy application imports remain in Communities, Gamers, Identity, Pitch, Places, Platform Admin, Play, Teams, and Whistle; Ride was removed from this set in the checkpoint change. Domain-layer HTTP imports were not found.
- Existing canonical error pattern: Events uses a domain-owned `EventError` with HTTP status mapping in `apps/api/src/http/errors/error-handler.ts`.
- Change required: YES.
- Changed files if any: `apps/api/src/modules/rides/domain/ride-error.ts`, `apps/api/src/modules/rides/application/ride.service.ts`, `apps/api/src/http/errors/error-handler.ts`, `scripts/architecture-check.mjs`, `tests/ride-service.test.ts`, `tests/ride-error-boundary.test.ts`, `tests/architecture-http-boundary.test.mjs`, and `rideplan.md`.
- Architecture guard gap found/fixed: gap found; `scripts/architecture-check.mjs` only blocked application -> Express and did not block application/domain -> API HTTP transport. PR #187 added a focused guard. The follow-up hardening freezes only exact existing legacy `../../../http/errors/app-error.js` imports rather than exempting whole files, and detects relative imports that climb any number of parent directories into `http/`.
- Tests/checks run: focused Ride/error-boundary tests with `npx.cmd tsx --test tests/ride-service.test.ts tests/ride-error-boundary.test.ts`; focused guard/Ride tests with `npx.cmd tsx --test tests/architecture-http-boundary.test.mjs tests/ride-service.test.ts tests/ride-error-boundary.test.ts`; full direct unit suite with the same file selection as `scripts/run-tests.mjs`; `npm run architecture:check` through the installed Node npm path; `npm -w @hooma/api run typecheck`; full `npm run typecheck`; full `npm run build`; touched-file Prettier check; touched-file ESLint check; Ride source HTTP/AppError scan; application legacy `AppError` scan.
- Results: focused Ride/error-boundary tests passed 10/10; focused guard/Ride tests passed 13/13; full direct unit suite passed 199/199 after adding guard regressions; `architecture:check` passed and now rejects new application/domain -> API HTTP imports outside exact legacy import specifiers; API typecheck passed; full workspace typecheck passed; full build passed; touched-file Prettier and ESLint passed; Ride source scan found no `AppError` or API HTTP transport import under `apps/api/src/modules/rides`. GitHub CI for exact PR #187 head `251d6d866993df3fdaac9b4f24c9854df26cf084` passed `npm ci`, `db:generate`, `db:validate`, `db:migrate:deploy`, `architecture:check`, changed-file formatting, changed-source lint, `typecheck`, `build:packages`, `npm test`, `build`, integration tests, `deploy:preflight`, `security:check`, and `db:migrate:status`. GitHub CI for exact PR #188 head `9b71c230f15d1672d01cc12e1e08eb11cbed68f6` passed the same required gates in run `33338671492`, job `99330117712`. Local `npm test` still fails before running tests with Windows `spawn EINVAL`, so the equivalent direct `npx.cmd tsx --test` unit selection was used. Local repo-wide `npm run format:check` fails on 402 pre-existing files and local repo-wide `npm run lint` fails on unrelated `apps/api/src/modules/platform-admin/application/platform-admin.authorizer.ts`; CI uses changed-file formatting and changed-source lint for PRs.
- Remaining risks: existing non-Ride legacy application services still import `AppError`; this checkpoint intentionally does not migrate unrelated domains, but the architecture guard now freezes only the exact known legacy import specifiers and rejects new HTTP imports in those files or any Ride application/domain HTTP import. Browser/Telegram runtime smoke is not applicable to this backend architecture checkpoint and remains not run here.
- Safe to begin RIDE-005: YES.

---

## RIDE-005 — Ride public/member HTTP APIs + bootstrap wiring

Status: **[x] DONE**

Dependencies: `ARCH-RIDE-001`

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

Evidence

- Branch: `ride/ride-005-http-api-fresh`; docs-only closeout branch `ride/ride-005-closeout`.
- PR: #191 (`https://github.com/funmarket/HoomaUltimate/pull/191`) merged the Ride public/member HTTP API slice.
- Merged commit / current foundation HEAD: PR #191 head `f711c7fd74d32b19b5abb242ad0dc75e6623e61a` merged as `7496265201efbd5600a940a08d422171ebee181e`; `origin/phase-0-foundation` read-back after merge was `7496265201efbd5600a940a08d422171ebee181e`.
- Source trace: `AGENTS.md`, `docs/LIVING_BUILD_PLAN.md`, full `rideplan.md`, Ride sections in `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, existing Ride contracts, Ride service, Ride repository ports, Prisma Ride repositories, shared public/member routers, shared auth middleware, container wiring, and existing HTTP integration test patterns.
- Changed files: `apps/api/src/modules/rides/http/ride.routes.ts`, `apps/api/src/http/public-v1/router.ts`, `apps/api/src/http/v1/router.ts`, `apps/api/src/bootstrap/container.ts`, `tests/rides.http.integration.test.ts`, and `rideplan.md`.
- Documentation updated: this ledger was kept in progress during the source PR and is closed only after GitHub CI, merge, and foundation read-back.
- Tests: focused Ride/domain/error/guard unit tests passed 19/19 with `npx.cmd tsx --test tests/ride-service.test.ts tests/ride-error-boundary.test.ts tests/ride-contract-policy.test.ts tests/architecture-http-boundary.test.mjs`; direct full unit suite passed 199/199 with the unit-only file selection. GitHub CI for exact PR #191 head `f711c7fd74d32b19b5abb242ad0dc75e6623e61a` passed `npm test` and `npm run test:integration`.
- Static/build checks: `npm run architecture:check` passed; `npm -w @hooma/api run typecheck` passed; full `npm run typecheck` passed; full `npm run build` passed; touched-file Prettier check passed; touched-file ESLint passed. GitHub CI run `33339959861`, job `99333685294`, passed `npm ci`, `db:generate`, `db:validate`, `db:migrate:deploy`, `architecture:check`, changed-file formatting, changed-source lint, `typecheck`, `build:packages`, `npm test`, `build`, integration tests, `deploy:preflight`, `security:check`, and `db:migrate:status`. Local `npm test` still fails before running tests with Windows `spawn EINVAL`, so the direct unit suite is recorded separately.
- PostgreSQL migration/integration proof: no new migration in RIDE-005. GitHub CI disposable PostgreSQL `npm run test:integration` passed `tests/rides.http.integration.test.ts`, proving public/member Ride routes create persisted Ride offers/requests, enforce auth/authz, return privacy-safe public DTOs, preserve meeting-point privacy, and read back database state through the HTTP API.
- Object-storage/Redis/Worker proof if applicable: not applicable to RIDE-005; Ride vehicle photos remain RIDE-006.
- Deployment/live proof if applicable: not applicable unless explicitly deployed.
- Remaining risk: Browser/Telegram runtime smoke is not part of this backend HTTP/API slice and remains for the frontend/runtime task; Ride vehicle-photo API/media remains RIDE-006.
- Implementation score: 10/10 for RIDE-005 scope after route-level HTTP tests, disposable PostgreSQL read-back, CI, merge, and foundation read-back.
- Next task: `RIDE-006` — not started.

---

## RIDE-006 — Ride vehicle-photo persistence + object storage

Status: **[x] DONE**

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

Evidence

- Branch: `ride/ride-006-vehicle-photo` from `origin/phase-0-foundation` at `3fb04650e78f6f81e44268da728d78ece05c30ad`.
- Post-merge follow-up branch: `ride/ride-006-closeout` from `origin/phase-0-foundation` after PR #193 merged as `268eb5630796f5d5827a300feade4bee6c306364`.
- Docs-only closeout branch: `ride/ride-006-final-closeout` from `origin/phase-0-foundation` after PR #194 merged as `24daab21a96281388b4b729aa701dce77a88d92d`.
- Start gate: `ARCH-RIDE-001` and `RIDE-005` are `[x] DONE`; `Safe to begin RIDE-005: YES`; no open PRs against `phase-0-foundation` at RIDE-006 start.
- Source trace: `AGENTS.md`, `docs/LIVING_BUILD_PLAN.md`, full `rideplan.md`, Ride media sections in `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, `docs/DATABASE.md`, existing `@hooma/storage` abstraction, existing Gamer proof-upload route/storage pattern, Ride contracts, Ride service, Ride Prisma repositories, public/member Ride HTTP routers, API container wiring, Worker Outbox runner, and existing Ride HTTP/schema/integration tests.
- In-flight changed files: `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/20260831010000_ride_offer_vehicle_photo/migration.sql`, `apps/api/src/modules/rides/application/ride-vehicle-photo.repository.ts`, `apps/api/src/modules/rides/infrastructure/prisma-ride-vehicle-photo.repository.ts`, `apps/api/src/modules/rides/application/ride.service.ts`, `apps/api/src/modules/rides/domain/ride-error.ts`, `apps/api/src/modules/rides/infrastructure/prisma-ride.repository.ts`, `apps/api/src/modules/rides/http/ride.routes.ts`, `apps/api/src/bootstrap/container.ts`, `apps/api/src/http/errors/error-handler.ts`, `apps/worker/src/rides/ride-vehicle-photo-cleanup.ts`, `apps/worker/src/main.ts`, `tests/ride-prisma-schema.test.mjs`, `tests/ride-vehicle-photo.integration.test.ts`, `docs/CANONICAL_MODEL.md`, `docs/DATABASE.md`, and `rideplan.md`.
- Current implementation direction: single-purpose `RideOfferVehiclePhoto` metadata, Ride-owned object keys under `ride-offer-vehicles/<rideOfferId>/<photoId>`, raw bytes through `ObjectStorage`, public photo delivery through the Ride API, and stale-object cleanup through the existing Outbox runner when synchronous deletion fails.
- Local verification so far: `npm run db:generate` passed through `C:\Program Files\nodejs\npm.cmd`; `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hooma_ultimate_test npm run db:validate` passed; changed-file Prettier check passed for touched TS/MD files; changed-source ESLint passed; focused Ride/schema/architecture tests passed 23/23 with `node --import tsx --test`; full direct unit suite passed 201/201 with `node --import tsx --test`; `npm run architecture:check` passed; full `npm run typecheck` passed; full `npm run build` passed.
- Post-merge critique accepted before closeout: PR #193 fixed the main RIDE-006 shape but left three real closeout blockers: `replaceForOwner`/`deleteForOwner` did not serialize photo metadata mutations with a `RideOffer` row lock; shared body-parser error handling matched any unknown 400/413-like object instead of actual parser error types; Worker startup loaded full API config and could require API-only production env such as Telegram/Redis before storage cleanup could run.
- Post-merge follow-up changes: `PrismaRideVehiclePhotoRepository` now locks the owning `RideOffer` row with `FOR UPDATE` before replace/delete metadata decisions; the HTTP error boundary only maps `entity.parse.failed` and `entity.too.large` parser errors to request-body responses; Worker storage setup now uses a narrow `loadObjectStorageConfig` that validates only complete object-storage credentials; `@hooma/worker` declares its direct `@hooma/config` and `@hooma/storage` dependencies; service/error/config regression tests cover metadata-failure orphan cleanup, parser-shape narrowing, and production storage config without API-only env.
- Post-merge follow-up local verification: focused tests passed 22/22 with `C:\Program Files\nodejs\npx.cmd tsx --test tests/ride-service.test.ts tests/ride-error-boundary.test.ts tests/object-storage-config.test.ts tests/architecture-http-boundary.test.mjs tests/ride-prisma-schema.test.mjs`; touched-file Prettier check passed for `package-lock.json`, `apps/worker/package.json`, `packages/config/src/index.ts`, `apps/worker/src/main.ts`, `apps/api/src/modules/rides/infrastructure/prisma-ride-vehicle-photo.repository.ts`, `apps/api/src/http/errors/error-handler.ts`, `tests/ride-error-boundary.test.ts`, `tests/ride-service.test.ts`, and `tests/object-storage-config.test.ts`; `npm run architecture:check` passed; `npm -w @hooma/config run typecheck`, `npm -w @hooma/api run typecheck`, and `npm -w @hooma/worker run typecheck` passed; full `npm run typecheck` passed; full `npm run build` passed; changed-file ESLint passed; direct full unit suite passed in Windows-safe batches, 206/206; `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hooma_ultimate_test npm run db:validate` passed; `npm run deploy:preflight` passed; `npm run security:check` passed with 0 vulnerabilities; `git diff --check` passed.
- Local PostgreSQL note: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hooma_ultimate_test npm run db:migrate:deploy` and local `tests/ride-vehicle-photo.integration.test.ts` remained blocked by local Prisma/PostgreSQL authentication before exercising source behavior, so disposable PostgreSQL proof came from GitHub CI.
- GitHub CI / merge evidence: PR #193 head `7cb3cd31664b90e7477eac91fe7e87c267524c1a` merged as `268eb5630796f5d5827a300feade4bee6c306364`; CI run `33342021621`, job `99339262219`, passed `npm ci`, `db:generate`, `db:validate`, `db:migrate:deploy`, `architecture:check`, changed-file formatting, changed-source lint, `typecheck`, `build:packages`, `npm test`, `build`, integration tests, `deploy:preflight`, `security:check`, and `db:migrate:status`. PR #194 head `ecfc62306ac84ebb621961d4b554534d8db7bc61` merged with expected-head protection as `24daab21a96281388b4b729aa701dce77a88d92d`; CI run `33343010796`, job `99341917030`, passed the same required gates. `origin/phase-0-foundation` read-back after PR #194 was `24daab21a96281388b4b729aa701dce77a88d92d`; open PRs against `phase-0-foundation` at closeout: none.
- RIDE-006 closeout result: upload/replace/delete/authz routes are permanent and tested; DB read-back shows only Ride-owned metadata/reference with no blob/base64 field; object-storage proof exists through the injected `ObjectStorage` contract and integration memory storage; public responses do not expose object keys; old objects are synchronously removed or scheduled through Outbox when removal fails; concurrent replace/delete metadata mutation now serializes on the owning `RideOffer` row. Remaining provider/reconciliation hardening risk is recorded under `RIDE-009`; Railway Worker runtime env and browser/Telegram runtime smoke remain unverified until explicitly checked in the live environment.

---

## RIDE-007 — Ride frontend API client + real Ride UI vertical slice

Status: **[~] IN PROGRESS**

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

Evidence:

- 2026-08-31 branch start: `ride/ride-007-frontend` from `origin/phase-0-foundation`.
- Source trace in progress: existing shell was `packages/frontend/src/rides/RidesPage.tsx`; shared export surface is `packages/frontend/src/index.ts`; web routes are `apps/web/src/app/router/HoomaRouter.tsx`; backend Ride routes already expose public offer/request reads and member offer/request/participation/photo/meeting-point actions under `/api/public/v1/rides/*` and `/api/v1/rides/*`.
- In-flight implementation files: `packages/frontend/src/rides/api.ts`, `packages/frontend/src/rides/RidesPage.tsx`, `packages/frontend/src/rides/rides.css`, `packages/frontend/src/index.ts`, `apps/web/src/app/router/HoomaRouter.tsx`, `tests/requests-rides-shell.test.mjs`, `tests/frontend-router.test.mjs`.
- Test guard note: `tests/requests-rides-shell.test.mjs` remains in place; its Requests/FundMe shell coverage is preserved while Ride assertions are being refactored to prove the old fake Ride shell is gone.
- 2026-08-31 local proof: focused frontend/router/home tests passed with `npx.cmd tsx --test tests/requests-rides-shell.test.mjs tests/frontend-router.test.mjs tests/navigation-contract.test.mjs tests/home-gateway-image-loading.test.mjs` (10/10).
- 2026-08-31 local proof: `npm run architecture:check` passed.
- 2026-08-31 local proof: changed Ride/router TypeScript lint passed with `npx.cmd eslint apps/web/src/app/router/HoomaRouter.tsx packages/frontend/src/rides/api.ts packages/frontend/src/rides/RidesPage.tsx --max-warnings=0`.
- 2026-08-31 local proof: all unit tests passed when invoked directly with the repo's unit file set through `C:\Program Files\nodejs\npx.cmd` (206/206). `npm test` itself still fails before tests on this Windows host because `scripts/run-tests.mjs` spawns bare `npx.cmd` and receives `spawn EINVAL`.
- 2026-08-31 local proof: touched-file Prettier check passed; repository-wide `npm run format:check` is still blocked by pre-existing unrelated formatting drift outside this slice.
- 2026-08-31 local proof: `npm run typecheck`, `npm run build`, `npm run db:generate`, `DATABASE_URL=postgresql://hooma:hooma@localhost:5432/hooma npm run db:validate`, `npm run deploy:preflight`, and `npm run security:check` passed.
- 2026-08-31 commit proof: source/docs/tests committed locally as `f5c1983cef6ec02a2cec394cc693cccdc3da689e` (`Implement Ride frontend vertical slice`).
- 2026-08-31 post-commit local proof: direct changed-file Prettier and ESLint checks passed for the 10 committed files against base `1b50288733153807af8652ab813881d5328cf14c`. The repository helper scripts `scripts/check-changed-format.mjs` and `scripts/check-changed-lint.mjs` still fail locally at their bare `npm` spawn step before tool output on this Windows host.
- Not complete yet: GitHub CI for the exact PR head, post-merge foundation read-back, and browser/Telegram route smoke evidence are still pending.

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

Evidence

- Carried from RIDE-006 closeout: PR #194 fixed the uncontrolled concurrent replace/delete stale-object risk by serializing metadata mutation with a `RideOffer` `FOR UPDATE` lock before RIDE-006 was marked done.
- Remaining hardening target: provider-level object deletion plus database/outbox scheduling failure, stale prefix reconciliation, retry observability, and live Worker/storage runtime proof still belong here before claiming complete media infrastructure confidence.

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
ARCH-RIDE-001 mandatory application/HTTP dependency checkpoint
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

The product owner may reorder independent later tasks, but agents must not infer authorization to run overlapping shared-file migrations simultaneously. `ARCH-RIDE-001` is not an optional later task and may not be reordered after RIDE-005; it is a mandatory pre-HTTP gate.

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

- `ARCH-RIDE-001` is not DONE and an agent is about to start or resume RIDE-005 or any later Ride task;
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
