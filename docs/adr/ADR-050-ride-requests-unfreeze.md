# ADR-050 — Ride and Requests vertical slices are explicitly unfrozen

## Status

Accepted.

## Context

ADR-038 froze new durable Ride, Requests, FundMe, Payments and Media work until a later product-owner decision explicitly unfroze each domain. ADR-048 later allowed only Requests and Ride route registration plus honest frontend shells, while backend/domain/persistence work stayed frozen.

`rideplan.md` now authorizes the complete Ride / Requests / FundMe program, but the first implementation slice must reconcile governance before schema, APIs or UI can safely change. Existing Requests wording said "exclusive claims"; the latest product direction is quantity-based partial claims. Ride also needs destination, participation, cancellation and media policy locked before the core schema begins.

## Decision

Ride and Requests are removed from ADR-038's freeze for their bounded vertical slices. Their contracts, persistence, APIs, application services and frontend may be implemented only through the numbered `rideplan.md` tasks and only inside their owning domain boundaries.

Ride owns:

- ride offers;
- ride requests;
- ride participation;
- Ride meeting-point privacy;
- Ride waypoints;
- Ride vehicle-photo metadata;
- Ride product context;
- advertised Ride compensation terms.

Ride contexts are:

```text
MATCHDAY
GENERAL
```

`MATCHDAY` means football/event transportation. `GENERAL` is presented to users as Anywhere Ride and covers normal transport such as airport, work, school, home, shopping, another city, custom destination or canonical Place destination. These are contexts of the same Ride domain, not separate Matchday/Anywhere tables, APIs, repositories, services or frontend state owners.

Ride compensation terms are advertised terms only:

```text
FREE
CASH
```

Driver offers may advertise `FREE` or `CASH` with a positive integer minor-unit amount, ISO currency and basis such as per-seat or total. Passenger requests may advertise no cash offer (`FREE`) or a `CASH` offer with a positive integer minor-unit amount and ISO currency. Ride must not create or own payment intent, checkout, settlement, wallet, card processing, payment provider callback, paid status or payment received status. Future PAY-001 remains the owner of actual payment execution.

A Ride destination must use exactly one destination strategy:

```text
Event reference
canonical Place reference
Ride-owned custom destination label
```

Event and Place facts remain owned by their domains. Rides may validate and read them only through narrow reference ports; Rides must not duplicate Event or Place canonical truth.

Ride participation starts as a passenger request for seats. The Ride Offer driver/owner accepts or rejects participation requests, accepted seats consume offer capacity, and the driver cannot join their own offer as a passenger. Drivers may cancel their own offers, requesters may cancel their own Ride Requests, passengers may cancel their own non-terminal participation, and terminal completed/cancelled/rejected records must preserve lifecycle history.

Public Ride projections may show privacy-safe area labels, destination summaries and availability. Exact pickup or meeting coordinates/addresses are private server-controlled data visible only to authorized Ride parties.

Ride vehicle-photo bytes belong in object storage. Until a separately authorized generic Media domain exists, Ride vehicle-photo metadata belongs to a single-purpose Ride-owned model such as `RideOfferVehiclePhoto`. PostgreSQL must not store binary photos, base64 payloads, object-storage credentials, object bytes in outbox payloads, or polymorphic generic media ownership for this slice.

Requests owns help/resource requests and quantity-based partial claims. Active/accepted claim quantities must be concurrency-safe and must not exceed the requested quantity. More than one claimer is allowed while unclaimed quantity remains. A quantity-one request behaves as a single-claim request through the same partial-claim rule, not through a second exclusive-only model.

Requests does not own Ride, Fundraising, Payment or generic action state.

FundMe remains grouped under Requests in navigation only. Durable Fundraising and Payments remain separately owned and are not authorized by this decision. This decision does not authorize ULTRAS, generic Media, fake backend data, navigation redesign, or changes to Teams, Communities, Gamers, Home, bottom navigation or the HOOMA create chooser.

## Supersession

This supersedes ADR-038 only for bounded Ride and Requests vertical-slice implementation.

This supersedes ADR-048 only for the shell-only freeze on Ride and Requests. ADR-048 remains authoritative for Home, bottom navigation, the HOOMA create chooser, Gamers independence, ULTRAS unavailability, and FundMe grouping under Requests.

## Consequences

`requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md` and `rideplan.md` must no longer describe Ride and Requests backend/domain/persistence as frozen.

The first schema/API/frontend implementation tasks may now proceed only in plan order and with their own verification evidence.

Fundraising, Payments and generic Media still require separate authorization before durable implementation.
