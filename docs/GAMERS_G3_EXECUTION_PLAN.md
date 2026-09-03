# HOOMA — Gamers G3 Execution Plan

Status: **HISTORICAL EXECUTION PLAN — NOT CURRENT IA AUTHORITY**
Original date: 2026-08-23
Original branch: `feat/gamers-human-match-system`

> **Current-state reconciliation (2026-09-03):** G3's Gamers-domain separation and human challenge rules remain useful historical implementation context. Its old navbar statement is superseded by ADR-055. Current permanent navigation is `Home | Play | Watch | HOOMA | Athletes`. Gamers remains an independent direct route family at `/gamers` and must not add a sixth permanent navigation item. Pitch remains an independent `/pitch` product and Home gateway.

This file records the bounded G3 execution intent. Current product behavior is governed by `requirements.md`, `structure.md`, `docs/DECISIONS.md`, `docs/GAMERS_PRODUCT_CONTRACT.md`, and newer owner instructions.

## G3 historical outcome

The intended G3 vertical slice was:

```text
public game hub / challenger card
-> authenticated Challenge action
-> durable pending GamerChallenge
-> recipient incoming challenge view
-> recipient ACCEPT or REJECT
-> challenger sees canonical status
-> accepted GamerChallenge becomes the canonical HOOMA Match Card
-> Arena projects challenge/match state
```

## Boundaries that remain valid

- Gamers is independent from Play, football Team challenges and TeamGame.
- Reuse canonical HOOMA User/UserPresentation only for identity presentation; never create GamerUser.
- Challenger and challenged participants are GamerProfiles in the same GamerGame.
- No self challenge.
- No cross-game challenge.
- Target GamerProfile must satisfy the Gamers challenge policy.
- Duplicate unresolved challenges for the same unordered pair/game must be prevented safely.
- Challenge creation and lifecycle transitions are server-authorized.
- Accepted GamerChallenge is the Match Card identity unless a later explicit persistence decision changes that architecture.
- Gameplay remains outside HOOMA; do not invent external telemetry or fake online state.
- Arena is a projection, not an `Arena` table.
- Gamers must not become a sixth permanent bottom-navigation item.

## Current navigation correction

The original G3 plan said:

```text
Home | Play | Watch | HOOMA | Pitch
```

That was correct for the plan's original date but is **not current**.

Current merged `phase-0-foundation` navigation is:

```text
Home | Play | Watch | HOOMA | Athletes
```

Current source-backed change:

```text
f884c22417d9139111bbb1f40bcd8ebab6d8a237
feat(nav): replace Pitch with Athletes
```

Do not use this historical plan to restore Pitch to permanent navigation. Pitch remains available at `/pitch` and remains a Home gateway.

## Current Gamers authority

For current Gamers behavior and implementation sequence, use:

- `docs/GAMERS_PRODUCT_CONTRACT.md`;
- ADR-041 and later Gamers decisions in `docs/DECISIONS.md`;
- current Gamers source/contracts/schema/tests;
- verified runtime evidence for the exact active branch.

Historical exclusions and step sequencing in the original plan remain available through Git history, but they are not a current product-completeness claim.
