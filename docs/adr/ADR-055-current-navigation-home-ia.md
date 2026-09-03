# ADR-055 — Current navigation and Home information architecture

Status: Accepted
Date: 2026-09-03

## Context

Earlier HOOMA planning documents locked `Pitch` into the fifth permanent bottom-navigation slot and used the Home gateway label/order `HOOMA | Teams | Spots | Pitch | Ride | Requests`.

The merged `phase-0-foundation` implementation has since changed deliberately:

- commit `f884c22417d9139111bbb1f40bcd8ebab6d8a237` replaced the fifth permanent navigation item `Pitch` with `Athletes`;
- commit `c44422a9391e7582765acb4e9bc0ccb893e6a3a6` changed the Home six-card presentation to place Pitch before Places and changed the visible Home label from `Spots` to `Places`;
- the current navigation contract tests lock those source-backed values.

The documentation layer was not updated consistently when those source changes merged, leaving later agents with contradictory instructions.

## Decision

The current permanent bottom navigation is exactly:

```text
Home | Play | Watch | HOOMA | Athletes
```

The fifth item is:

```text
Athletes -> /athletes
```

Pitch remains a real, independent product and route:

```text
Pitch -> /pitch
```

Removing Pitch from permanent bottom navigation does **not** remove or merge the Pitch domain, canonical Place relationship, Pitch capability/application lifecycle, or Pitch Home gateway.

The current Home six-card gateway is exactly:

```text
HOOMA | Teams | Pitch
Places | Ride | Requests
```

with routes:

```text
HOOMA    -> /hooma
Teams    -> /teams
Pitch    -> /pitch
Places   -> /places
Ride     -> /rides
Requests -> /requests
```

The implementation may retain an internal legacy identifier such as `spots` for the Places gateway while that remains harmless source identity, but the visible current Home label is `Places`. That identifier must not be interpreted as a second physical-place domain or as authority to restore the old visible `Spots` Home label.

Gamers remains an independent route family and is not a Home gateway. ULTRAS remains independent and unavailable until its own domain ships. FundMe remains grouped under Requests according to its current contract.

## Supersession

This ADR supersedes only the navigation/Home-IA portions of earlier decisions that state:

- permanent bottom navigation ends in `Pitch`;
- Home uses visible `Spots` before Pitch;
- the old Home ordering is still current.

In particular, the affected portions of ADR-011, ADR-036 and ADR-048 are superseded. Their unrelated domain-ownership decisions remain valid.

ADR-053 remains authoritative for Communities-only HOOMA creation. ADR-054 remains authoritative for Athletes domain independence except where its original PR-scope statement says bottom navigation remained unchanged; subsequent merged source now places Athletes in permanent navigation.

## Consequences

- Do not restore Pitch to permanent bottom navigation merely to satisfy an older document.
- Do not replace or delete the `/pitch` product because Athletes owns the fifth nav slot.
- Do not restore `Spots` as the visible Home gateway label merely because older screenshots/plans used it.
- Current-facing requirements, architecture, brand specs, asset manifests, execution ledgers, and tests must describe the same navigation/Home contract.
- Historical execution records may retain their original wording only when clearly identified as historical and non-authoritative for current IA.
