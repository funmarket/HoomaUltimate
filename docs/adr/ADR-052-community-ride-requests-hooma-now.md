# ADR-052 — Community-scoped RideRequests project into HOOMA NOW

Status: Accepted
Date: 2026-09-01

## Decision

A Community-scoped RideRequest is one Ride-owned canonical request whose current active state is projected into HOOMA NOW for explicitly authorized HOOMA Communities; Community and HOOMA NOW never copy, own, or independently manage that RideRequest.

RideRequest creation supports exactly three user-facing audience choices:

- Everyone;
- One of my HOOMAs;
- All my HOOMAs.

`Everyone` persists a canonical RideRequest with `audienceScope = GLOBAL` and zero Community audience rows. It is discoverable through normal public Ride request discovery and does not appear automatically in a Community HOOMA NOW feed.

`One of my HOOMAs` requires the requester to be an active member of the selected active Community at write time. It persists `audienceScope = COMMUNITY` plus exactly one `RideRequestCommunityAudience` row for the selected Community. It is excluded from public Ride request discovery and appears in that Community's HOOMA NOW only while the canonical RideRequest remains active/open/unexpired and the requester remains an active member of that Community.

`All my HOOMAs` is a command, not durable state. The server resolves the requester's current active Community memberships at create/update time, persists one explicit `RideRequestCommunityAudience` row per resolved Community, and never stores an `ALL_MY_HOOMAS` flag. Later Community joins do not expand existing requests.

Community HOOMA NOW reads are member-only. The viewer must be an active member of the target active Community. The requester must also still be an active member of each Community for that Community projection to appear. Public Community visibility does not make Community-scoped RideRequests public.

The Community page composes the existing HOOMA NOW presentation with Ride-owned Community request data. Whistle remains separate; RideRequests are not stored as Whistles.

## Consequences

- Ride owns RideRequest lifecycle, status, expiration and persistence.
- Community owns membership facts.
- HOOMA NOW is presentation/composition only.
- There is no copied RideRequest payload, second Ride lifecycle, second status field, Community RideRequest table or generic feed table for this feature.
- The same RideRequest ID can appear in multiple targeted HOOMA NOW feeds.
- A single canonical status/expiration change removes that same request from every Community feed.
- Owner access continues through My Rides even when a Community projection no longer appears because the requester or viewer left a Community.
