# ADR-042 — Enable Event Whistle through canonical Event access

Status: Accepted

Date: 2026-08-23

## Decision

The shared Whistle engine enables `EVENT` as the second active Whistle context after `COMMUNITY`.

Event Whistle does not create a new membership, chat, message table, quota, retention rule, or authorization model. It reuses the canonical Event member-content access policy already owned by Events.

An authenticated canonical HOOMA User may read or send Event Whistles when `EventRepository.canViewMemberContent(eventId, userId)` recognizes that User through one of the existing Event paths:

- the Event creator;
- an active `FOUNDER` or `COACH` membership in the Event's owning HOOMA Community;
- an Event RSVP in `CONFIRMED`, `WAITLISTED`, or `ATTENDED` state.

A cancelled RSVP alone does not authorize Event Whistle access. Public visitors and unrelated authenticated Users cannot read or send Event Whistles.

## Shared Whistle invariants

Event Whistle uses the same global Whistle engine and therefore keeps the existing invariants unchanged:

- maximum 33 Unicode grapheme clusters per Whistle;
- maximum 11 sends per User per UTC calendar day across all enabled contexts combined;
- body stored in Redis only;
- PostgreSQL stores metadata only;
- body expires at the next UTC midnight;
- authorized feeds display active bodies directly;
- no Reveal endpoint or per-viewer reveal state;
- expired metadata is cleanup data, not permanent message history.

The existing `WhistleMetadata.contextType = EVENT` capability is reused. No new Event-specific Whistle table or migration is introduced.

## Event Chat boundary

Legacy Temporary Event Chat remains a separate Events mechanism while its removal/migration is handled in its own traced slice. Event Chat is not renamed to Whistle, its storage is not reused for Whistle, and Event Whistle does not deepen Event Chat architecture.

## Frontend behavior

The existing Event detail page projects the shared Whistle Board for authorized Event users. Passive public browsing remains public: an anonymous or unauthorized visitor does not receive private Whistle content and opening the public Event page does not create a HOOMA account merely to determine Whistle access.

## Reason

Play's locked communication direction is Event Whistle through the single shared Whistle domain. Reusing Events' existing member-content predicate preserves one authorization source of truth, while reusing Whistle storage/quota/TTL behavior prevents a second messaging system or shadow Event membership model.
