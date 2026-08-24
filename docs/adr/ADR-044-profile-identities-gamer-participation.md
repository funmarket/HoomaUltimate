# ADR-044 — Profile identities and Gamer participation

Status: **Accepted by product owner on 2026-08-24**

## Context

HOOMA has one canonical `User`, while product domains such as Teams and Gamers own their own participation records. The current profile does not record whether a user identifies as a Player, Fan, or Gamer, and the current Gamers challenge flow requires a game-specific `GamerProfile` before a user can challenge someone.

That creates unnecessary friction for solo gamers and incorrectly makes a game-specific handle setup feel like a second account/profile onboarding flow.

## Decision

HOOMA will support these self-selected profile identities:

```text
PLAYER
FAN
GAMER
```

A user may select any combination of the three.

These identities are presentation/participation declarations, not global or scoped management roles.

### Derived identities

`Ghost Rider` is derived when the user has no selected profile identities. It is never persisted as a role or database identity.

`UltraFan` is not manually selectable. It will be derived from active canonical ULTRAS membership when the ULTRAS domain provides that source of truth.

### Player

Selecting `PLAYER` may expose canonical Player details owned by Identity/Profile, including skill level and up to five preferred football positions. Selecting Player does not create a `TeamPlayer`, Team membership, Play listing, or management authority.

### Fan

Selecting `FAN` records supporter identity only. It does not create ULTRAS membership, Community membership, or any authorization capability.

### Gamer exception

`GAMER` is the deliberate participation exception.

Selecting Gamer makes the canonical User eligible to participate in the Gamers challenge product independently of football Teams, Communities, Player status, or ULTRAS.

Game-specific identity remains owned by the existing Gamers domain:

```text
User
  -> GamerProfile (game A, handle A)
  -> GamerProfile (game B, handle B)
```

A `GamerProfile` continues to own the handle and `openToChallenge` state for one specific game. HOOMA display name, username, photo, bio, and selected profile identities remain owned by Identity/Profile and must not be duplicated into GamerProfile.

### Challenge behavior

The server-side challenge policy becomes:

```text
authenticated canonical User
AND selected profile identity includes GAMER
AND a GamerProfile exists for the requested game
```

If the user is not yet a Gamer, the UI may offer a compact Gamer opt-in at the challenge boundary. If the user is already a Gamer but lacks a handle for the current game, the UI asks only for that game's handle. After saving the required handle, the original challenge action should continue without requiring the user to navigate away and rediscover the opponent.

`openToChallenge` controls whether other users may discover/challenge this GamerProfile. It does not control whether the owner may challenge somebody else.

Unselecting `GAMER` removes current Gamers challenge eligibility and public challenger discovery but does not delete historical game profiles, challenges, or results.

## Consequences

- There remains exactly one canonical HOOMA User.
- Gamers stays independent from football Teams.
- No second Gamer account or duplicated profile system is introduced.
- Existing GamerProfile uniqueness per `(userId, gameId)` remains valid.
- Challenge authorization must be enforced server-side, not only through button visibility.
- Public profile presentation must stop assuming every profile is a football Player.
- Favorite Club is not introduced by this decision because the current repository has no canonical Football Club catalog.
- UltraFan is not fabricated before canonical ULTRAS membership exists.
