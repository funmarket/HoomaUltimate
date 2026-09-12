# ADR-057 — Athletes owns its focused group Calendar

Status: Accepted
Date: 2026-09-12

## Context

Athletes groups need a phone-first schedule where the group creator adds dated activities and active members browse the month, tap a date, and expand that day's activity details.

HOOMA already has a canonical `Event` product for PLAY/WATCH behavior. That Event lifecycle carries product semantics such as RSVP/waitlist, formations, check-in, chat and venue-specific policy. Forcing simple Athletes scheduling through that lifecycle would couple unrelated products and expand the Events domain for behavior Athletes does not need.

The product owner explicitly authorized a Calendar related only to Athletes, inspired by familiar phone/Google Calendar interaction rather than a desktop calendar clone.

## Decision

Athletes owns a bounded scheduling concept named `AthletesCalendarEntry`.

It is **not** a global HOOMA `Event`, PLAY event, WATCH event, Pitch booking, Gamer match, Team game, or generic Calendar abstraction.

```text
AthletesCommunity
  └── AthletesCalendarEntry
```

The durable Calendar entry contains only the scheduling truth required by V1:

```text
id
athletesCommunityId
createdByUserId
title
description?
startsAt
endsAt?
timezone
locationName?
status          SCHEDULED | CANCELLED
cancelledAt?
createdAt
updatedAt
```

PostgreSQL owns durable Calendar metadata. The database enforces foreign keys to the owning `AthletesCommunity` and canonical creator `User`.

Calendar reads are bounded date-range reads. The current contract limits one request to 45 days so the phone month view can request its visible six-week grid without lifetime-history scans.

## Authorization

Athletes membership remains the only authorization source.

- Active `FOUNDER` may create, edit and cancel Calendar entries.
- Active `FOUNDER`, `MODERATOR` and `MEMBER` may read the Calendar.
- Outsiders and cross-community memberships are denied private Calendar access.
- Archived Athletes communities are denied active Calendar reads and writes.
- UI visibility is not authorization; the API enforces these rules through the existing `AthletesContentAuthorizer`.

Calendar persistence rechecks the active parent under the Athletes lifecycle lock. Reads use a shared parent lock; mutations use an update lock. An archive racing a Calendar write therefore cannot leave a new active Calendar entry under an archived group.

## V1 product interaction

The Athletes detail page member-content order is fixed as:

```text
Calendar
Photo Board
Whistle Board
Active Athletes
```

Calendar is phone-first:

- compact month grid;
- Monday-through-Sunday columns;
- Today control and previous/next month controls;
- scheduled-day indicators;
- tap a date to show its agenda immediately below the month;
- tap an agenda event to expand details inline;
- Founder gets a compact `+ Event` action;
- event create/edit is inline rather than a modal;
- cancel is an inline two-step confirmation;
- cancelled entries remain visible as cancelled history but no longer produce an active event indicator.

The current Calendar timezone defaults to `Africa/Tunis`. Date grouping and wall-time conversion are timezone-aware so device timezone changes do not silently move an event to a different calendar day.

## Explicit non-goals for V1

This authorization does **not** create:

- `EventRsvp` or an Athletes-specific RSVP table;
- attendance or check-in;
- capacity/waitlists;
- payments;
- recurring-event rules;
- reminders/notifications;
- chat/comments;
- PLAY/WATCH/Pitch/Gamers/Teams coupling;
- OS/Google/Apple Calendar synchronization;
- a generic cross-domain Calendar service.

Those require separate product decisions and must extend the correct owner rather than being prebuilt speculatively.

## Consequences

- Athletes Calendar code stays in small Athletes-owned contract, application, persistence, HTTP and frontend modules.
- The existing global `Event` and `EventRsvp` models/services remain unchanged.
- Calendar frontend code stays out of the already-large `AthletesPages.tsx`; that page only mounts the bounded Calendar component.
- The API is scoped under `/api/v1/athletes/:athletesCommunityId/calendar`.
- Future attendance, recurrence, reminders or external-calendar integration must be reviewed as independent slices instead of growing this V1 model by assumption.
