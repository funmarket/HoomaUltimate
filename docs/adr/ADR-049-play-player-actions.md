# ADR-049 — Play player actions preserve Team and Event ownership

## Status

Accepted.

## Context

The Play Players feed exposes people who deliberately publish that they are looking for a `GAME` or a `TEAM`. The existing Team recruitment action crossed the ownership boundary by allowing Teams infrastructure to resolve a Play listing directly from Play-owned persistence. The GAME action had no implemented invitation lifecycle.

Direct actions from Play must not turn Play into a second owner of Team recruitment, Event participation, or generic invitations. They must also preserve canonical authorization, persistence, and concurrency behavior in the owning domains.

## Decision

Play owns discovery, current listing-target resolution, and orchestration only. This decision does not change the existing Play information architecture or the `Players | Open matches` sibling navigation.

For a `TEAM` listing, Play resolves the canonical target User and invokes a narrow Teams operation. Teams alone authorizes `MANAGE_ROSTER`, persists the canonical `TeamPlayerOffer`, exposes incoming/outgoing offer state, and creates or reactivates `TeamPlayer` on acceptance. Teams infrastructure must not query Play-owned persistence.

For a `GAME` listing, Play resolves the canonical target User and invokes a narrow Events operation for a selected `PUBLISHED` `PLAY` Event that the actor may manage under the existing Event authority policy. Events owns the durable `EventPlayerInvite` lifecycle.

Sending an Event invitation never creates an RSVP. Only the target User may accept or decline. Acceptance and RSVP allocation happen in one Events transaction using the same row-locked capacity/waitlist policy as ordinary Event Join. Cancelling or completing an Event closes its pending invitations.

Pending Team offers and Event invitations remain authoritative in Teams and Events. Play may map those records back to current Play listing IDs for authenticated UI readback, but it persists no duplicate sender state and public Play listing projections do not expose canonical target User IDs for this workflow.

## Consequences

There is one sender path for each action from Play and no parallel Team sender route that accepts a Play listing ID.

`TeamPlayerOffer` remains the only Team recruitment offer record. `EventPlayerInvite` is the only durable direct player invitation record for scheduled Play Events. No generic invitation domain is introduced.

Play frontend state must reflect owning-domain readback rather than browser-local “sent” flags. Recipient response remains in the owning Team/Event APIs.

Tests must cover cross-domain boundaries, authorization, canonical row reuse, Event RSVP capacity/waitlist concurrency, cancellation/completion closure, stale listing rejection, and the absence of Teams infrastructure references to Play persistence.
