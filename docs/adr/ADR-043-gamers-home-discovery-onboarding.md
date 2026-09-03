# ADR-043 — Gamers discovery, Arena and canonical onboarding

Status: **Accepted; Home-placement portion superseded by ADR-055**  
Date: **2026-08-26**

> **Current-state note (2026-09-03):** `/gamers` remains the global Gamers discovery surface and the Gamers-domain discovery/Arena/onboarding decisions below remain valid. The original statement that Home consumes Gamers discovery as an active Home gateway is no longer current. Gamers is an independent direct route family at `/gamers`; current Home is `HOOMA | Teams | Pitch | Places | Ride | Requests`.

## Decision

`/gamers` is the global Gamers discovery surface with four top-level sections:

```text
GAMERS | CHALLENGERS | ARENA | GAME CATALOG
```

`GAMERS` is the default view and displays the canonical Gamer HUD card across active games. `CHALLENGERS` is the subset whose game profiles explicitly have `openToChallenge = true`. `ARENA` is the public privacy-safe projection of accepted Gamer challenges across active games. `GAME CATALOG` owns the existing active-game browsing and add-game flow.

Gamers discovery uses one Gamers-domain cross-game discovery query and one Gamers-domain global Arena query. It must not fetch the game catalog and fan out Challenger or Arena requests per game. These queries are consumed by Gamers-owned surfaces; current Home does not expose a Gamers gateway.

The same `GamerHudCard` component is reused by global discovery and individual game hubs. A second Gamer-card implementation is not permitted. Challenge remains the primary HUD action; direct Whistle remains the secondary transient action on the same shared card.

The same `GamerMatchCard` presentation is reused by the local game Arena and the global Arena. The local game Arena uses the detailed form for that signed-in Gamer's challenge lifecycle; the global Arena uses a smaller compact form and exposes accepted Match Cards only. Both forms project each participant's canonical HOOMA profile photo, display name and game handle. Missing photos use a controlled presentation fallback; GamerProfile does not gain a duplicate avatar field.

## Global Arena boundary

An accepted `GamerChallenge` remains the canonical Match Card identity. No `Arena` table and no duplicate `GamerMatch` table are introduced for this projection.

The public global Arena returns only accepted challenges whose `GamerGame` is active. Each item contains:

- challenge id and accepted status;
- active game id/slug/name;
- challenger GamerProfile id and game handle;
- challenged GamerProfile id and game handle;
- each participant's canonical HOOMA username/display name/photo.

It does not expose User ids, private account data, pending/declined/cancelled challenges, or member-only challenge actions. The selected-game Arena remains the authenticated place for incoming/outgoing pending actions and full per-game challenge activity.

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

## Current IA consequence

- Gamers remains available at `/gamers` but is not an active Home gateway.
- Current permanent bottom navigation is `Home | Play | Watch | HOOMA | Athletes`.
- Pitch remains a standalone `/pitch` product and Home gateway.
- ADR-055 governs Home and permanent navigation; this ADR continues to govern Gamers discovery/Arena/onboarding behavior.
