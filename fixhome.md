# HOOMA — Home/Create-Flow IA Simplification Archive

Status: **HISTORICAL TASK LEDGER — CURRENT IA SUPERSEDED**
Original execution date: 2026-08-29
Original task branch: `product/home-ia-simplify`

This file records the Home/create-flow simplification task as it existed on 2026-08-29. It is **not a current product contract** and must not override `requirements.md`, `structure.md`, `docs/DECISIONS.md`, or current merged source.

## Current-state reconciliation — 2026-09-03

The original task correctly removed Gamers/ULTRAS/FundMe from Home discovery and separated HOOMA Community creation from Teams/future ULTRAS creation. Later product changes intentionally changed the navbar and Home visible order/label.

Current permanent bottom navigation is exactly:

```text
Home | Play | Watch | HOOMA | Athletes
```

Current Home gateway is exactly:

```text
HOOMA | Teams | Pitch
Places | Ride | Requests
```

Routes:

```text
HOOMA    -> /hooma
Teams    -> /teams
Pitch    -> /pitch
Places   -> /places
Ride     -> /rides
Requests -> /requests
Athletes -> /athletes    # permanent bottom navigation
```

Pitch remains an independent product and `/pitch` route. It was removed only from the fifth permanent bottom-navigation slot. `Places` is now the visible Home gateway label; Watch may continue to use `Spots` as Watch-owned presentation language. The source may retain an internal `spots` gateway identifier without creating a second Place domain.

Current source-backed changes:

```text
f884c22417d9139111bbb1f40bcd8ebab6d8a237
feat(nav): replace Pitch with Athletes

c44422a9391e7582765acb4e9bc0ccb893e6a3a6
fix(home): reorder Pitch and Places gateways
```

ADR-055 is the current navigation/Home IA authority.

## Creation hierarchy that remains current

ADR-053 superseded the old generic HOOMA create chooser. Current creation ownership is:

```text
Create a HOOMA Community -> /hooma/new
Create a Team            -> /teams/new
```

Teams selects its required HOOMA Community context inside the Teams-owned flow. If a user must create a HOOMA first, the bounded continuation is:

```text
/hooma/new?after=team-create
-> /teams/new?communityId=<created-id>
```

ULTRAS remains independent and must not be implemented as a generic `CommunityType` or through the HOOMA Community creator.

## Historical 2026-08-29 contract

At the time of the original task, the intended Home/nav contract was:

```text
Home gateways: HOOMA | Teams | Spots | Pitch | Ride | Requests
Bottom nav:    Home | Play | Watch | HOOMA | Pitch
```

Those lines are retained here only as historical evidence. They are **superseded** and must not be used to revert current source.

The original task also introduced honest frontend-only Ride and Requests shells. That shell-only restriction is no longer current: ADR-050 later explicitly authorized bounded durable Ride and Requests vertical slices.

## Historical implementation evidence

The original task was implemented through PR #160 after the earlier Home work around PR #159. Its detailed command-by-command execution ledger, exact worktree paths, verification output, and old branch snapshots remain available in Git history before this archive reconciliation.

Important historical boundaries that still matter:

- no generic cross-domain creator;
- Gamers remains an independent product and route family;
- ULTRAS remains an independent domain;
- FundMe is grouped under Requests in current presentation unless a newer explicit decision changes it;
- Home navigation changes do not authorize duplicate domain models, tables, services, repositories, contracts, or state.

## Current authority

For current implementation work use, in order:

1. latest explicit product-owner instruction;
2. `requirements.md`;
3. `structure.md`;
4. `docs/DECISIONS.md` and ADR-055/ADR-053;
5. current `phase-0-foundation` source/tests;
6. verified current runtime/database state.

Do not use this archive as evidence that the current navbar still ends in Pitch or that the current Home visible label is Spots.
