# Teams Adoption From the Earlier HOOMA Source

The earlier HOOMA Teams work was used as reference rather than copied blindly.

## Adopted and improved

- Teams hero hierarchy and football-heritage presentation.
- Discover / Challenges / Games hub structure.
- Public Team discovery cards with badge, location, roster count and challenge action.
- Incoming/outgoing challenge management concept.
- Accepted Team games view.
- Team profile and roster presentation.
- Coach-managed roster and Assistant responsibility workflows.
- Self-challenge rejection and server-side capability enforcement.

## Fresh-build improvements

- Community `ADMIN` authority was removed from Team management.
- Coach and Assistant are explicit Team-scoped responsibilities.
- Assistant powers are capability grants from Coach.
- Search, city and Houma filters are real API query filters instead of visual-only controls.
- Challenges and games are read from real fresh API endpoints.
- Coach Control Room can edit Team details, add/remove players, appoint/revoke Assistants and send challenges.
- The Team experience is shared by Web and Telegram through `@hooma/ui` rather than duplicated frontend implementations.

## Rejected legacy coupling

- No Community `ADMIN` title.
- No `/admin` Team management route.
- No fake Team data.
- No client-only permission source of truth.


## Current foundation reconciliation — 2026-09-29

Current `phase-0-foundation` includes the published-lineup/stadium presentation and the surgical lineup repair merged through PR #392, plus the Team challenge opponent handoff fix merged through PR #394.

Do not confuse the Event Formation Builder with Team-vs-Team challenge authority. Event Formation owns one Event RSVP pool split into visual A/B sides; Teams owns TeamPlayer, TeamLineup, TeamChallenge and TeamGame.

### Locked later Teams correction

After architecture hardening, the Team completion program must preserve these target rules:

- a Team stays discoverable/recruitable even when not match-ready;
- challenge create/accept requires 5+ active Team players and a valid published lineup matching the challenge format;
- acceptance re-checks readiness;
- accepted TeamGame tactical presentation uses two independent Team roster/published-lineup authorities keyed by homeTeamId/awayTeamId;
- each Team edits only its own lineup; opponent published state is read-only; drafts remain private;
- Event Formation remains available for pickup/community Play and is not Team challenge persistence.

These are future target rules, not a claim that current foundation already enforces them.
