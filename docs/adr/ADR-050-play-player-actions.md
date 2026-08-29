# ADR-050 — Play player actions preserve Teams and Events ownership

Status: **Accepted**

Date: 2026-08-29

## Context

The Play Players feed exposes two discovery intents: a canonical User may be looking for a `TEAM` or a `GAME`.

The previous Team-offer sender accepted a Play listing ID inside the Teams domain and the Teams Prisma repository resolved that ID by reading `PlayPlayerListing` directly. The Game `INVITE` action was only a disabled presentation placeholder and had no invitation lifecycle.

That arrangement violated HOOMA's one-owner-per-concept rule and left the Play actions incomplete.

## Decision

Play remains the discovery and orchestration surface for listing-based player actions.

- Play owns `PlayPlayerListing` and is the only domain that resolves a listing ID to its canonical target User.
- A `TEAM` action resolves the current Play listing and calls a narrow Teams application operation with the canonical target User ID.
- Teams owns `TeamPlayerOffer`, Team roster authorization, recipient accept/decline, and `TeamPlayer` creation on acceptance.
- A `GAME` action resolves the current Play listing and calls a narrow Events application operation with the canonical target User ID and selected Event ID.
- Events owns `EventPlayerInvite`, Event management authorization, recipient accept/decline, Event cancellation/completion effects, and RSVP/waitlist participation.
- Sending an Event invitation never creates an `EventRsvp`.
- Accepting an Event invitation uses the same row-locked capacity/waitlist operation as an ordinary Event join; no second attendance mechanism exists.
- Pending sender state is read back from Teams/Events and mapped to current listings by Play. Frontend-local sent flags are not durable truth.
- The browser never receives a target User ID merely to cross the domain boundary.

## HTTP ownership

Listing-based sender operations are protected Play routes:

```text
POST /api/v1/play/player-listings/:listingId/team-offer
POST /api/v1/play/player-listings/:listingId/event-invite
GET  /api/v1/play/player-actions
GET  /api/v1/play/managed-events
```

Recipient lifecycle remains on the owning domains:

```text
GET  /api/v1/teams/offers/incoming
POST /api/v1/teams/offers/:offerId/accept
POST /api/v1/teams/offers/:offerId/decline

GET  /api/v1/events/invitations/incoming
POST /api/v1/events/invitations/:inviteId/accept
POST /api/v1/events/invitations/:inviteId/decline
```

The previous listing-based Team sender route is removed rather than retained as a compatibility pathway.

## Persistence

No new Play persistence is introduced.

`TeamPlayerOffer` remains the canonical Team recruitment offer.

Events adds one canonical `EventPlayerInvite`, unique by Event and target User, with an explicit lifecycle:

```text
PENDING -> ACCEPTED | DECLINED | CANCELLED
```

Event cancellation or completion closes pending invitations as `CANCELLED`.

## Consequences

- Teams infrastructure no longer reads Play-owned Prisma tables.
- Play does not become a generic recruitment/invitation database.
- Events does not use `EventRsvp` as an invitation and therefore cannot enroll a User without consent.
- Team and Event authorization remain server-owned and are not duplicated in the Play frontend.
- Sender pending state survives refresh because it is derived from canonical domain records.
