# ADR-058 — Athletes Calendar RSVP

Status: Accepted
Date: 2026-09-14

## Context

ADR-057 established the private Athletes Calendar as an Athletes-owned domain, separate from the generic Event lifecycle used by Play and Watch. The original Calendar scope intentionally had no attendance state.

The product now requires active Athletes members to respond to Calendar plans in the familiar Facebook-event style: **Going**, **Maybe**, or **Not going**. This requirement is newer than ADR-057's original no-RSVP boundary.

The generic Event RSVP model is not suitable for this feature. Its statuses and lifecycle describe Play/Event participation and waitlisting, while Athletes Calendar responses are lightweight member intent on a private community plan.

## Decision

Athletes Calendar owns its RSVP state directly.

- Persist responses in `AthletesCalendarRsvp`.
- The only statuses are `GOING`, `MAYBE`, and `NOT_GOING`.
- A database unique constraint on `(calendarEntryId, userId)` guarantees one current response per user per Calendar entry.
- Setting another status updates the existing response rather than creating a second response.
- Only an active member of the same Athletes community may set or change an RSVP. The Founder is also an active member and may RSVP.
- RSVP writes run inside the existing Athletes community lifecycle lock, re-check membership in that transaction, scope the Calendar entry to the same community, and then upsert the response.
- Cancelled Calendar entries keep their previously recorded RSVP totals visible but reject subsequent RSVP changes.
- Private Calendar list responses include the current viewer's RSVP and aggregate Going / Maybe / Not going counts.
- No attendee identity list is exposed by this decision.
- Calendar RSVP does not read from, write to, or reuse the generic Event RSVP/waitlist authority.

Calendar reads remain lock-free as established by ADR-057. Founder Calendar create/edit/cancel authority is unchanged.

## Persistence and lifecycle

`AthletesCalendarRsvp` references the Calendar entry and canonical User through governed database foreign keys. Deleting a Calendar entry or User cascades its RSVP rows. Calendar cancellation is not deletion and preserves the RSVP history.

## Consequences

- Athletes gets the requested attendance signal without coupling private community plans to Play/Event participation semantics.
- The unique database key plus upsert makes repeated or concurrent response changes idempotent at the row-identity level.
- Existing Photo Board, Whistle, Play, Watch, Pitch, Gamers, and generic Event behavior remain outside this change.

## Relationship to ADR-057

ADR-057 remains authoritative for Athletes Calendar ownership, privacy, timezone handling, Founder event management, cancellation, and lifecycle locking. This ADR supersedes only ADR-057's original statement that Calendar has no RSVP state.
