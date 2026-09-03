# HOOMA — Historical Merge Audit

Status: **ARCHIVED DONOR/MERGE BASELINE — NOT CURRENT PRODUCT AUTHORITY**
Original purpose: compare donor implementations before the clean HOOMA foundation was established.

This document is retained only as historical evidence of how the clean `funmarket/HoomaUltimate` repository was initially planned from older donor sources. It must not be used as the current implementation, migration, navigation, runtime, or release contract.

## Current authority — 2026-09-03

Current implementation work is performed only on:

```text
funmarket/HoomaUltimate
branch: phase-0-foundation
```

`main` is the later release target and is not the current implementation authority. The application moves to `main` only after `phase-0-foundation` is clean and production-ready.

Current product/architecture authority is:

1. latest explicit product-owner instruction;
2. `requirements.md`;
3. `structure.md`;
4. `docs/DECISIONS.md` and current ADRs;
5. `docs/CANONICAL_MODEL.md` for canonical data ownership, where it agrees with newer accepted decisions;
6. current `phase-0-foundation` source/schema/migrations/tests/runtime evidence.

Older donor implementations are read-only references only.

## Current navigation/Home correction

The original merge audit locked an older permanent navbar and an older Home gateway. Those claims are superseded.

Current permanent bottom navigation is exactly:

```text
Home | Play | Watch | HOOMA | Athletes
```

Current Home gateway is exactly:

```text
HOOMA | Teams | Pitch
Places | Ride | Requests
```

Pitch remains a real standalone product at `/pitch` and a Home gateway; it is no longer the fifth permanent bottom-navigation item. Athletes owns that current fifth navigation slot at `/athletes`.

Source-backed changes:

```text
f884c22417d9139111bbb1f40bcd8ebab6d8a237
feat(nav): replace Pitch with Athletes

c44422a9391e7582765acb4e9bc0ccb893e6a3a6
fix(home): reorder Pitch and Places gateways
```

ADR-055 is the current navigation/Home IA decision.

## Historical donor findings that remain useful

The original audit established several principles that still remain valid:

- one canonical User with independent Web and Telegram authentication transports;
- one canonical Place for a physical venue;
- Pitch and Watch remain separate product functions over canonical Place relationships;
- Play and Gamers remain separate product domains;
- Teams owns football-team lifecycle and authority;
- ULTRAS and Gamers are independent domains rather than Team/Community type flags;
- Whistle is one shared transient engine rather than duplicate chats;
- PostgreSQL owns durable business truth, Redis owns explicitly transient state, and object storage owns media bytes;
- asynchronous work belongs to the existing Outbox/Worker boundary;
- CI verifies source and does not repair/commit source automatically;
- a page/model/schema alone never proves a complete vertical slice.

## Historical statements that must not be reused as current truth

The old merge baseline contained claims that have since been superseded, including:

- permanent navigation ending in `Pitch`;
- the old eight-card or earlier Home gateway layouts;
- donor migration history as the target HOOMA migration contract;
- donor route sets as the final route baseline;
- donor feature maturity as proof of current `phase-0-foundation` completeness;
- generic future `MediaAsset` architecture as a prerequisite for current domain-owned Ride/Gamer object-storage usage;
- assumptions that Worker/package existence proves a Worker process is deployed.

The detailed original adoption matrix, donor route inventory, donor migration list, and implementation-order notes remain available in Git history before this archive reconciliation. They are historical planning evidence, not current instructions.

## Current rule

Do not port, restore, or change current HOOMA behavior merely because this historical merge audit once preferred a donor implementation. Reinspect current `phase-0-foundation`, its accepted ADRs, current database/migrations, and verified runtime before any change.
