# ADR-048 — Home and create-flow IA simplification

## Status

Accepted historically; **current Home/navigation portions superseded by ADR-055**. The Communities-only creation refinement is governed by ADR-053.

## Current-state reconciliation — 2026-09-03

This ADR records the 2026-08-29 simplification decision and should not be read as the current navbar/Home ordering contract.

Current permanent bottom navigation is:

```text
Home | Play | Watch | HOOMA | Athletes
```

Current Home gateway is:

```text
HOOMA | Teams | Pitch
Places | Ride | Requests
```

Pitch remains an independent `/pitch` product and Home gateway even though Athletes now owns the fifth permanent navigation slot. The visible Home label is `Places`; Watch may continue using `Spots` as Watch-owned product language. See ADR-055 for the current IA.

## Context

Home and the HOOMA create chooser had drifted across product documents, current source, and future-domain planning. The old Home gateway set exposed Gamers, ULTRAS and FundMe as primary Home cards even though the current product-owner direction was to simplify Home discovery and avoid implying unfinished domains were shipped.

Requests, Ride, FundMe and ULTRAS also have durable-domain implications. A navigation simplification must not create tables, APIs, contracts, payment behavior, ride matching, request claims, or generic Community typing.

## Historical decision

At the time of this ADR, Home was reduced to six gateways:

```text
HOOMA | Teams | Spots | Pitch | Ride | Requests
```

and the then-current permanent bottom navigation was:

```text
Home | Play | Watch | HOOMA | Pitch
```

Those two IA lines are retained only as historical evidence and are superseded by ADR-055.

The original three-option HOOMA create chooser portion is superseded by ADR-053. HOOMA creation now creates only canonical HOOMA Communities through the Communities-owned `/hooma/new` path. Team creation continues through the Teams-owned `/teams/new` path and selects eligible HOOMA context there, including the bounded `/hooma/new?after=team-create` continuation back to `/teams/new?communityId=<created-id>`. ULTRAS remains unavailable until its independent domain is implemented and must not create a Community row or require `CommunityType`.

Gamers remains an implemented independent domain and route family, but it is removed from Home discovery and from the HOOMA create chooser.

FundMe is grouped under Requests as a page tab:

```text
/requests
/requests/fundme
/fundme -> /requests/fundme
```

This grouping is presentation/navigation only. Fundraising and Payments remain separate future durable owners.

Ride is a Home gateway and subsequently gained its own durable vertical slice under ADR-050; the old shell-only restriction in this ADR is historical.

Requests subsequently gained explicit authorization for its own durable Requests-owned slices under ADR-050; the old shell-only restriction in this ADR is historical.

## Supersession

- ADR-053 supersedes the old HOOMA create-chooser portion.
- ADR-050 supersedes the shell-only freeze for Ride/Requests domain work.
- ADR-055 supersedes the old Home visible label/order and permanent bottom-navigation portions.

Unrelated domain-separation reasoning in this ADR remains useful historical context.

## Consequences

Current-facing product, structure, brand, asset, progress and test contracts must use ADR-055 for navigation/Home IA and ADR-053 for HOOMA creation hierarchy.

Historical tests or task records that quote the old `Pitch` bottom-nav or visible Home `Spots` contract must be identified as historical rather than used to revert current source.
