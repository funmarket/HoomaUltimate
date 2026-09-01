# ADR-051: Play Match Visibility Is Match-Owned

Status: Proposed in PR #206; not foundation truth until merged.

## Context

Play Open Matches were being filtered by the visibility of the parent HOOMA Community. That coupled two different privacy concepts: whether a Community's private content is visible and whether a scheduled Play match is recruiting players.

The Play creation flow also had no match-level privacy choice, so existing Play events could be hidden by Community privacy even though their creators never marked the match private.

## Decision

Play match discoverability is owned by `PlayEventDetails`, not `Community` and not the generic `Event` record.

`PlayEventDetails.visibility` has exactly two values:

- `OPEN` — discoverable to authenticated HOOMA accounts through Play Open Matches.
- `PRIVATE` — excluded from Open Matches and accessible only to the event creator, authorized Community Founder/Coach managers, active event participants, and pending/accepted invited players.

`OPEN` is the default. The migration that introduces the field assigns `OPEN` to all existing Play event details because the previous product did not give creators a private-match control.

Community visibility continues to govern Community content. Opening or joining an OPEN Play match linked to a PRIVATE Community does not grant Community membership or access to private Community HQ/content.

## API boundary

- Public Watch discovery remains under `/api/public/v1/events`.
- Play Open Matches are read through authenticated `/api/v1/play/open-matches`.
- Public event detail may continue serving Watch, but Play detail requires an authenticated viewer who satisfies Play match access policy.
- RSVP/join enforces the same Play visibility policy server-side so a guessed event ID cannot bypass PRIVATE visibility.

## Domain boundaries

- Events retains canonical Event lifecycle, RSVP, invitations, and persistence orchestration.
- Play owns the Open Matches product surface and reaches Events through the existing Play-to-Events application gateway.
- `CommunityVisibility` is not reused for match privacy.
- No generic Event visibility field is introduced, so Watch behavior is not changed by Play privacy.
- Gamers remains unrelated and unchanged.

## Consequences

- Existing Play matches become OPEN after migration.
- Creators/managers can explicitly switch a Play match between OPEN and PRIVATE.
- OPEN Play matches remain discoverable even when their parent Community is PRIVATE.
- PRIVATE matches do not appear in Open Matches, and unrelated authenticated accounts cannot open or join them directly.
- Participant/invite access survives a later switch to PRIVATE so legitimate event lifecycle access is not stranded.
