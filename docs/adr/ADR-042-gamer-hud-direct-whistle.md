# ADR-042 — Gamer HUD card and direct Whistle

Status: **Accepted**  
Date: **2026-08-25**

## Decision

The Challenger HUD card is the single Gamer player presentation for the current Gamers slice. The separate Gamer public-profile page and its `/gamers/games/:gameSlug/profiles/:profileId` route are retired rather than maintained as a second visual/profile system.

The HUD card keeps the canonical game-specific and HOOMA-owned presentation it already projects:

- game;
- Gamer handle/tag;
- canonical HOOMA display name, username and photo;
- truthful `OPEN TO CHALLENGE` state;
- Challenge action.

No expanded Gamer identity page, duplicate presentation model, fake statistics, rank, XP, level or invented activity is introduced. Real competitive records remain owned by the later completed-result/ranking slices.

## Direct Gamer Whistle

The same HUD card may expose **WHISTLE** as a secondary action beside the primary Challenge action.

Direct Gamer Whistle reuses the one shared Whistle engine. It does not create Gamer message/chat tables, a permanent inbox, or a second Whistle implementation.

The persistence context is:

```text
GAMER_DIRECT
```

Authorization is derived server-side from the authenticated canonical HOOMA User and the selected target GamerProfile:

- the sender must have active Gamer identity;
- the sender must own a GamerProfile for the target GamerProfile's game;
- the target GamerProfile must exist in the same active game;
- the target User must still have active Gamer identity;
- self-Whistle is forbidden;
- the client never supplies or chooses the durable direct-pair context identifier.

The server derives one deterministic unordered GamerProfile pair context within the game. Both participants therefore resolve to the same transient Whistle context without creating a durable conversation entity.

Direct Gamer Whistle inherits the shared Whistle invariants unchanged:

```text
33 grapheme clusters maximum
11 total sends per User per UTC calendar day across all enabled contexts
UTC reset at 00:00
unused sends never carry over
body in Redis only
PostgreSQL metadata only
body expires at the next UTC midnight
no Reveal endpoint or per-viewer reveal state
```

The HUD action may show today's transient pair signals and an inline composer. It must not turn the card into a permanent chat/history surface.

## Consequences

- `GamerProfile` remains the canonical game-specific identity model and is not deleted.
- The canonical HOOMA `/profile/:username` system remains unchanged.
- The obsolete Gamer-specific public profile page, route, export and dead styles are removed.
- Arena participant labels remain non-navigating until a future product requirement introduces a justified destination.
- Challenge and Whistle remain separate actions with separate lifecycle/authorization rules.
