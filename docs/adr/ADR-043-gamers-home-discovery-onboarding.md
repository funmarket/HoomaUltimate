# ADR-043 — Gamers home discovery and canonical onboarding

Status: **Accepted**  
Date: **2026-08-26**

## Decision

`/gamers` is the global Gamers discovery surface with three top-level sections:

```text
GAMERS | CHALLENGERS | GAME CATALOG
```

`GAMERS` is the default view and displays the canonical Gamer HUD card across active games. `CHALLENGERS` is the subset whose game profiles explicitly have `openToChallenge = true`. `GAME CATALOG` owns the existing active-game browsing and add-game flow.

The homepage consumes one Gamers-domain cross-game discovery query. It must not fetch the game catalog and fan out one Challenger request per game.

The same `GamerHudCard` component is reused by global discovery and individual game hubs. A second Gamer-card implementation is not permitted. Challenge remains the primary HUD action; direct Whistle remains the secondary transient action on the same shared card.

## Canonical Gamer enrollment

Joining Gamers is an Identity-domain mutation on the existing canonical HOOMA User. It adds the `GAMER` profile identity without rewriting presentation, Player details, other identities, or creating a second User.

The authoritative member action is:

```text
POST /api/v1/me/profile/identities/gamer
```

The operation is idempotent and additive. Gamers UI, signup onboarding, and future Gamer enrollment entry points must reuse it rather than reconstructing and PATCHing the entire canonical profile.

`GamerProfile` remains game-specific and is created only when a Gamer supplies a handle for a particular game.

## Challenge setup boundary

`SET UP TO CHALLENGE` uses one shared setup modal. The modal resolves the minimum missing prerequisite in order:

1. no canonical HOOMA account/session -> authenticate or create the account while preserving challenge intent;
2. canonical account without `GAMER` identity -> enable Gamer participation on that User;
3. Gamer without a profile for the target game -> collect the game handle and explicit challenge-availability choice;
4. Gamer with the required game profile -> send the challenge.

Authentication return paths carry the intended target in the internal URL so the same modal can resume after authentication. No shadow account, duplicate Gamer identity record, local-storage ownership workaround, or page-specific onboarding implementation is introduced.

## Public Gamer discovery

The public cross-game projection exposes only:

- GamerProfile id;
- game handle;
- explicit `openToChallenge` state;
- active game id/slug/name;
- canonical HOOMA username/display name/photo.

It does not expose `userId`, timestamps, bio, or private account data. Inactive games and Users without the active `GAMER` identity are excluded.

The retired Gamer-specific public profile endpoint remains removed. Canonical HOOMA public profiles stay owned by Identity.
