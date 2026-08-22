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
