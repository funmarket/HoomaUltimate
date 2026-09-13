# ADR-057: Athletes private Calendar ownership and lifecycle locking

Status: Accepted
Date: 2026-09-13

## Context

Athletes members need a private schedule for training, meetups, and other Athletes-community plans. HOOMA already has a canonical Event domain owned by Play/Watch lifecycle rules, RSVP, participation, and event-specific authorization. Reusing Event for this private schedule would merge unrelated ownership and lifecycle semantics.

Athletes also already owns one community lifecycle lock through `PrismaAthletesRepository.withCommunityLock()`. Calendar writes must serialize with archive and other lifecycle-sensitive Athletes mutations so an archived community cannot receive a Calendar write after archive commits.

The previous proposed ADR text for this feature claimed Calendar reads used a shared parent lock. That promise did not match the implementation model and is not adopted here.

## Decision

Athletes owns a dedicated durable `AthletesCalendarEntry` model with:

- `id`;
- `athletesCommunityId`;
- `title`;
- nullable `description` and `location`;
- `startsAt` and `endsAt` UTC instants;
- the valid IANA `timezone` selected when the entry is written;
- nullable `cancelledAt`;
- internal `createdByUserId` provenance;
- `createdAt` and `updatedAt`.

The migration enforces canonical foreign keys to `AthletesCommunity` and `User`, plus the invariant that `endsAt > startsAt`. The API projection does not expose `createdByUserId`.

Calendar access is private to the owning Athletes community:

- active `FOUNDER`, `MODERATOR`, and `MEMBER` memberships may list entries;
- only the active same-community `FOUNDER` may create, edit, or cancel entries;
- outsiders and cross-community memberships are denied;
- archived Athletes communities do not grant active Calendar access.

Calendar reads use the ordinary Athletes member-content authorization boundary followed by a bounded repository read. **Calendar reads do not acquire the Athletes lifecycle row lock.** Read ranges must be positive and may not exceed 45 days.

Calendar mutations use the existing Athletes community lifecycle `FOR UPDATE` lock. Founder authority and active-community state are rechecked inside the same transaction before the Calendar row mutation. This makes archive-versus-Calendar-write races deterministic without creating a second lock authority.

Cancellation is one-way. A cancelled entry remains durable and visible as cancelled; it cannot be edited back into an active entry. Repeating cancellation is idempotent.

The frontend defaults new entries to the phone/browser-resolved IANA timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`, with `UTC` only when the runtime cannot provide a valid IANA timezone. This does not require GPS/location permission. Calendar display and day grouping use the viewing device timezone while the entry retains the creator-selected IANA timezone as durable metadata.

Calendar remains Athletes-owned. It does not create or reuse Event, Play, Watch, Pitch, Gamers, RSVP, waitlist, recurrence, payment, reminder, chat, or generic Calendar lifecycle state.

## Consequences

- Athletes has one private scheduling source of truth: `AthletesCalendarEntry`.
- Event ownership and Play/Watch lifecycle remain unchanged.
- Read traffic does not take an unnecessary exclusive community lifecycle lock.
- Calendar writes and Athletes archive share the same authoritative parent lock and transaction boundary.
- The device timezone is a presentation/input default, not a hard-coded geographic product default.
- Permanent tests must cover membership privacy, Founder-only mutation, bounded range validation, cross-community isolation, irreversible cancellation, API projection privacy, and a real PostgreSQL archive-versus-create lock race.
