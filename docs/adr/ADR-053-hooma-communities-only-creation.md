# ADR-053 — HOOMA creates only HOOMA Communities

## Status

Accepted.

## Context

The HOOMA page previously presented HOOMA, Team and ULTRAS as peer creation choices under a “Community type” selector. That copy and UI made Team and future ULTRAS look like Community types even though Teams is already a separate domain with its own route, contract, service and persistence, and ULTRAS is a future independent domain.

The current product-owner rule is narrower: HOOMA is the product/community umbrella, but each durable concept keeps one owning domain. `/hooma` must create HOOMA Communities only. A product that requires a HOOMA context asks for that context inside its own creation flow.

## Decision

`/hooma` creates only canonical HOOMA neighborhood/local Communities through `/hooma/new`.

Team creation remains owned by Teams at `/teams/new`. The Teams creation page selects an eligible HOOMA community context before submitting the Teams-owned create request. When a Team creator lacks an eligible HOOMA, the only bounded continuation is `/hooma/new?after=team-create`; successful HOOMA creation returns to `/teams/new?communityId=<created-id>`.

Future ULTRAS creation remains unavailable until its independent domain ships. ULTRAS must not be created by Communities, must not create a Community row, and must not require a generic `CommunityType`.

Home may still link to independent product gateways such as Teams. Those links are navigation, not HOOMA-owned creation flows.

## Supersession

This supersedes only the HOOMA create chooser portion of ADR-048. ADR-048 remains active for Home gateway count, bottom navigation, Gamers independence, FundMe grouping and the unrelated shell-scope constraints not superseded by later ADRs.

## Consequences

The HOOMA page must not contain:

- `HOOMA | TEAM | ULTRAS` as a create selector;
- Team or ULTRAS values inside Communities-owned creation state;
- “Community type” wording for cross-domain creation;
- a generic create-anything abstraction.

The Teams page must keep Team creation in the Teams domain and make the HOOMA community context explicit.

No schema, migration, contract, backend repository or service change is required for this UI/IA slice because the existing Team create contract already requires `communityId`.

Known Team `communityId` nullability/query compatibility concerns remain a separate persistence audit and must not be silently patched in this slice.
