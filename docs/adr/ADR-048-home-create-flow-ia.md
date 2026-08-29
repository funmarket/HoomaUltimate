# ADR-048 — Home and create-flow IA simplification

## Status

Accepted.

## Context

Home and the HOOMA create chooser had drifted across product documents, current source, and future-domain planning. The old Home gateway set exposed Gamers, ULTRAS and FundMe as primary Home cards even though the current product-owner direction is to simplify Home discovery and avoid implying unfinished domains are shipped.

Requests, Ride, FundMe and ULTRAS also have durable-domain implications. A navigation simplification must not create tables, APIs, contracts, payment behavior, ride matching, request claims, or generic Community typing.

## Decision

Home has six gateways only:

```text
HOOMA | Teams | Spots | Pitch | Ride | Requests
```

The permanent bottom navigation remains:

```text
Home | Play | Watch | HOOMA | Pitch
```

The HOOMA create chooser has three options only:

```text
HOOMA | TEAM | ULTRAS
```

HOOMA creation continues through the Communities-owned path. Team creation continues through the Teams-owned path. ULTRAS remains unavailable until its independent domain is implemented and must not create a Community row or require `CommunityType`.

Gamers remains an implemented independent domain and route family, but it is removed from Home discovery and from the HOOMA create chooser.

FundMe is grouped under Requests as a page tab:

```text
/requests
/requests/fundme
/fundme -> /requests/fundme
```

This grouping is presentation/navigation only. Fundraising and Payments remain separate future durable owners.

Ride is a Home gateway and may route to an honest frontend shell at `/rides`. The shell must not list fake drivers, create fake bookings, request live location, or imply a working Ride backend.

Requests may route to an honest frontend shell at `/requests`. The shell must not create fake listings, claim flows, services, repositories, contracts, tables or backend calls.

## Supersession

This supersedes only the Home gateway and HOOMA create-flow portions of ADR-036. ADR-036's permanent bottom navigation decision remains active.

This narrowly overrides ADR-038 only enough to permit Requests/Rides frontend shells and route registration. Requests, Ride, Fundraising, FundMe, Payments and ULTRAS backend/domain/persistence work remains frozen until separately authorized.

## Consequences

The Home gateway source must expose exactly the six current gateways and retain one shared UI contract.

Governing product, structure, brand, asset and progress documents must stop describing the old eight/nine-card Home as current truth.

Tests should prove the six-gateway Home contract, unchanged bottom navigation, three-option create chooser, Requests/FundMe tab shell, Ride shell, `/fundme` redirect, and retained direct Gamers routes.

Database, migrations, backend APIs, shared contracts, Gamers domain, Teams backend, Communities backend and bottom navigation are out of scope for this decision.
