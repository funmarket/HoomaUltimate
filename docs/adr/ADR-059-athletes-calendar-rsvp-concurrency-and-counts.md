# ADR-059 — Athletes Calendar RSVP concurrency and active-member counts

Status: Accepted
Date: 2026-09-14

## Context

ADR-058 established `AthletesCalendarRsvp`, its `GOING | MAYBE | NOT_GOING` statuses, one-response-per-user constraint, active-member write authority, cancellation behavior, and separation from generic Event RSVP.

The first implementation routed every RSVP write through the same exclusive Athletes community `FOR UPDATE` lifecycle lock used by destructive and Founder-owned mutations. That preserved correctness, but independent member responses for the same Athletes community unnecessarily serialized on one parent row.

ADR-058 also retained RSVP rows when membership ended but did not define whether those durable historical rows continued to contribute to the current Calendar aggregate counts.

## Decision

The Athletes RSVP model and ownership established by ADR-058 remain unchanged.

- RSVP writes use a shared Athletes community lifecycle guard in the same PostgreSQL transaction as authorization and persistence.
- The shared guard is a row-level `FOR SHARE` lock on the owning `AthletesCommunity` row.
- Inside that transaction, the application re-checks active same-community membership, verifies that the Calendar entry belongs to the same Athletes community and is not cancelled, and then upserts the response.
- Independent RSVP transactions may hold the shared lifecycle guard concurrently.
- Existing destructive Athletes lifecycle writes and Founder Calendar create/edit/cancel continue to use the existing exclusive `FOR UPDATE` lifecycle lock. The exclusive lock conflicts with in-flight shared RSVP guards, so archive, membership removal, and Calendar cancellation cannot race through an RSVP authorization decision.
- `AthletesCalendarRsvp` rows remain durable when an Athletes membership ends. Membership removal does not delete or rewrite the historical RSVP row.
- Current Calendar aggregate counts include only RSVP rows whose User still has an active membership in the same Athletes community (`leftAt IS NULL`).
- Cancelled Calendar entries reject subsequent RSVP changes and display the same current-active-membership aggregate semantics. Existing rows are not treated as a cancellation-time attendance snapshot.
- The database uniqueness rule on `(calendarEntryId, userId)` remains the one-response-per-user invariant.
- No new RSVP table, generic Media model, generic membership model, or Event RSVP reuse is introduced.

## Concurrency proof

The implementation must be proven with real PostgreSQL behavior, not mocks alone. Regression coverage must demonstrate:

- two independent RSVP writers can proceed while holding shared lifecycle guards;
- same-user concurrent status changes still leave exactly one durable RSVP row;
- an exclusive member-removal transaction conflicts with an in-flight RSVP guard and the RSVP re-check fails after removal commits;
- an exclusive Calendar-cancellation transaction conflicts with an in-flight RSVP guard and the RSVP re-check rejects the cancelled entry;
- an exclusive community-archive transaction conflicts with an in-flight RSVP guard and no post-archive RSVP is persisted;
- outsiders and cross-community entry IDs remain denied;
- a former member's retained RSVP row no longer contributes to current aggregate counts.

## Consequences

- RSVP throughput no longer serializes every independent member response behind one exclusive parent-row lock.
- Lifecycle correctness remains coupled to the existing Athletes community row rather than introducing a second coordination source.
- Historical intent remains durable without allowing departed members to inflate current participation counts.
- Founder Calendar writes and destructive Athletes lifecycle mutations keep their stronger exclusive serialization.
- Athletes Calendar RSVP remains completely separate from generic Event RSVP, Play, Watch, Pitch, Gamers, Photo Board, and Whistle.

## Relationship to ADR-058

This ADR supersedes only ADR-058's RSVP lifecycle-lock concurrency rule and defines the previously unspecified membership-ended aggregate behavior. All other ADR-058 decisions remain authoritative.
