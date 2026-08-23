# ADR-041 — Gamers human-first match system is explicitly authorized

Status: **ACCEPTED**  
Date: 2026-08-23

## Decision

The product owner explicitly authorized the Gamers vertical slice on 2026-08-23. Gamers is therefore current product work notwithstanding older freeze language that predates this owner decision.

Gamers remains an independent domain and must not reuse football Team models. One canonical HOOMA User owns game-specific GamerProfiles.

The core V1 competitive loop is deliberately human-confirmed rather than dependent on external game APIs:

```text
choose game
-> add game username
-> challenge another GamerProfile
-> opponent accepts
-> HOOMA Match Card
-> users play outside HOOMA
-> result submitted
-> opponent confirms or contests
-> completed human-confirmed match
-> game-specific ranking update
```

The first-class mobile/tablet launch focus is EA SPORTS FC Mobile and Ludo/Ludo King, while authenticated users may contribute missing games and Platform Admin retains later catalog curation/merge/deactivation authority.

A screenshot may be attached as evidence but never lets one participant unilaterally establish the winner. Conflicting outcomes become disputed and do not affect ranking until valid resolution.

Gamer ranking is per game and consumes only canonical completed human-confirmed match outcomes. Ranking calculation is separate from result truth and must be idempotent/transaction-safe.

`GamerSquad` is the single gaming team/community concept. Each Squad belongs to one game, receives its own public community-style page, supports optional creator-supplied logo/banner image URLs, and has a member-private HQ.

There is no global Gamers Whistle feed. Gamer Squad members use the one shared Whistle engine through the existing `GAMER_SQUAD` context after explicit Squad-membership authorization is implemented. Gamers inherits the current shared Whistle invariants defined by the authoritative Whistle decisions; it does not pin or duplicate superseded retention/reveal mechanics.

## Consequences

- `/gamers` becomes a real implemented route behind the already-existing Home gateway.
- Do not build a parallel Gamer chat/message system.
- Do not build a separate Gamer Team and Gamer Community membership model; use GamerSquad.
- Do not require EA/Ludo/external game APIs for V1 authenticity.
- Do not claim external provider verification unless a future provider integration genuinely proves it.
- Do not display fake online/presence state.
- Do not add Gamers to permanent bottom navigation.
- Public browsing remains public where privacy-safe; protected actions require authenticated server-side authorization.

Detailed active product behavior and implementation slices are recorded in `docs/GAMERS_PRODUCT_CONTRACT.md`.

## Reason

HOOMA's product direction intentionally emphasizes human interaction, agreement, reputation and community accountability. Technology should coordinate and record the interaction without replacing the humans with opaque automation or unreliable external dependencies.
