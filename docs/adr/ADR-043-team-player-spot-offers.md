# ADR-043 — Team player spot offers

Status: Accepted by explicit product-owner instruction on 2026-08-24.

## Decision

HOOMA uses a deliberately small Team-owned offer/request pattern for recruiting a player who has published a Play listing with `lookingFor = TEAM`.

The user experience is:

```text
Team authority -> Hire Player -> choose Team -> optional short message -> Send Offer
Player Profile -> Team Offer -> Accept Spot | Decline
Accept -> canonical TeamPlayer membership
Decline -> no roster membership
```

There is no recruitment dashboard, application pipeline, interview state, or Play-owned roster storage.

## Ownership

- Play owns public player availability discovery only.
- Teams owns the durable Team spot offer and its state.
- Identity owns the player's canonical User/UserPresentation.
- TeamPlayer remains the only Team roster membership.

A public Play listing ID is used to identify the published availability handoff. Public APIs do not expose the target user's canonical `userId` merely to support recruiting.

## Authority

Sending an offer requires effective `MANAGE_ROSTER` authority for the Team. This follows the existing Team authorization policy: direct Coach, Community Founder/Coach fallback, or Assistant with an explicit active `MANAGE_ROSTER` grant.

Only the target User may accept or decline their offer.

## Lifecycle

Canonical states are:

```text
PENDING | ACCEPTED | DECLINED
```

One canonical Team/User offer row is reused so repeated sends cannot create duplicate pending offers.

Accepting a pending offer and creating/reactivating `TeamPlayer` occur transactionally. Declining never creates roster membership. Team archive closes any still-pending offers.

## Reason

The product needs a lightweight football action rather than an HR-style recruiting system. Keeping the handoff Team-owned preserves the existing Team authority and roster model while allowing Play to remain a simple discovery surface.
