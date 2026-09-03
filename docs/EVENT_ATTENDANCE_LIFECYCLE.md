# Event RSVP, Check-in, and Attendance Lifecycle

This document is the canonical lifecycle statement for Event participation evidence and final attendance.

## Sources of truth

- `EventRsvp` owns reservation/participation state and the finalized participation outcome.
- `EventCheckIn` owns the check-in fact. Its `createdAt` is the authoritative first check-in timestamp.
- `Event.status` owns the lifecycle of the Event itself.

Check-in is not an RSVP status. There is no `CHECKED_IN` RSVP enum and no duplicate RSVP check-in timestamp.

## Play lifecycle

```text
BEFORE / ACTIVE PLAY EVENT
Event.status = PUBLISHED
EventRsvp.status = CONFIRMED
EventCheckIn = none

VALID PLAY CHECK-IN
Event.status = PUBLISHED
EventRsvp.status = CONFIRMED
EventCheckIn = exists

PLAY FINALIZATION — PRESENT
Event.status = COMPLETED
EventRsvp.status = ATTENDED
EventCheckIn = exists

PLAY FINALIZATION — ABSENT
Event.status = COMPLETED
EventRsvp.status = NO_SHOW
EventCheckIn = none
```

The Play check-in operation records `EventCheckIn` only. It never changes `CONFIRMED` to `ATTENDED`. Event completion owns the final attendance reconciliation and performs it in the same transaction that marks the Event completed.

A checked-in Play participant cannot cancel the RSVP after check-in. That policy is enforced explicitly from the existence of `EventCheckIn`; `ATTENDED` is not used as a hidden cancellation lock.

Repeated Play check-in is idempotent. The first check-in timestamp and location evidence are preserved; repeat calls do not create a second row or overwrite the original evidence.

## Watch boundary

Watch uses shared Event RSVP infrastructure, but current product requirements and ADR history do not authorize Play participant check-in for Watch. The generic Event HTTP route therefore does not imply generic product policy: `EventService` rejects Watch check-in before persistence.

Watch completion does not run Play attendance reconciliation. If Watch later gains an attendance/check-in product rule, it must be introduced explicitly rather than inherited from Play.

## Timing rule

No authoritative check-in opening or closing offset is currently defined in requirements, ADRs, Event policy, or tests. This repair therefore does not invent a time constant. Check-in requires a `PUBLISHED` Play Event and a `CONFIRMED` RSVP; cancelled/completed Events reject new check-ins.

A future check-in window must be added as an explicit product rule with deterministic clock-based tests.

## Existing-data migration

The migration removes the duplicate `EventRsvp.checkedInAt` column after preserving any missing check-in evidence in `EventCheckIn`.

It repairs only a state proven to have been created by the defective writer: an RSVP already marked `ATTENDED` while its Event is still `PUBLISHED` and an `EventCheckIn` exists. Those rows return to `CONFIRMED` while retaining the check-in fact. Historical `ATTENDED` rows on completed Events are not rewritten.

Run `packages/database/prisma/maintenance/event-attendance-classification.sql` against the target database before deployment and review its counts.
