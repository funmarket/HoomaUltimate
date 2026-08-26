# ADR-047: EA SPORTS FC Mobile challenge bridge and result verification

Status: Accepted

## Context

HOOMA already owns Gamer identities, game-specific GamerProfiles, GamerChallenges and accepted Match Cards. EA SPORTS FC Mobile has no HOOMA-controlled matchmaking or result API, so an accepted HOOMA challenge must hand information to the installed game and later reconcile evidence returned by the two players.

The feature must not create a second Gamer account system, a second Arena, or overload `GamerChallengeStatus`. Challenge negotiation remains `PENDING | ACCEPTED | DECLINED | CANCELLED`.

## Decision

1. An accepted `GamerChallenge` remains the canonical Match Card identity.
2. EA SPORTS FC Mobile alone receives a `GamerMatchSession`, keyed one-to-one by the accepted challenge id.
3. Match execution uses its own lifecycle: `WAITING_FOR_CODE -> IN_PROGRESS -> PENDING_VERIFICATION -> VERIFIED | DISPUTED`, with `VOIDED` reserved for App Admin resolution.
4. The challenger is the room host and is the only participant allowed to publish the six-digit Quick Match code.
5. The API derives participant identity from the authenticated HOOMA session. Player ids, sides and authoritative winner ids are never accepted from client input.
6. Each participant submits a score from their own perspective plus a screenshot. The API converts that score into canonical challenger/challenged coordinates before persistence.
7. Screenshot bytes live in S3-compatible object storage. PostgreSQL stores only proof object metadata and durable match/result state. Proof uploads are limited to 5 MB and JPEG/PNG/WebP.
8. The worker reconciles `PENDING_VERIFICATION` sessions. Matching canonical scorecards become `VERIFIED`; conflicting scorecards become `DISPUTED`; one scorecard becomes verified after the 30-minute opponent timeout.
9. `PLATFORM_ADMIN` is the only authority allowed to view dispute evidence and resolve or void a disputed match. Resolution is transactional and creates an `AuditLog` entry.
10. The existing local EA FC Arena Match Card embeds the bridge. No separate EA Arena route or duplicate Match Card presentation is created.
11. Android launch targets the installed EA FC Mobile package `com.ea.gp.fifamobile`. The iOS handoff follows the product-provided custom URL scheme. Neither platform uses a timed App Store/Play Store fallback.

## Non-decisions

- HOOMA does not claim to create the EA lobby, inject players into EA FC Mobile, or retrieve game statistics from EA.
- No Elo, tournament payout, bracket, or account-wide dispute suspension is implemented by this ADR because those durable domains do not exist in the current canonical model. They must be introduced by their owning product/domain work before match verification can mutate them.
- Match screenshots are evidence, not automatically machine-verified truth.

## Consequences

The Challenge domain remains stable while match execution and verification can evolve independently. Both score submissions are preserved for audit/review. The worker can reconcile without blocking API requests, and App Admin resolution remains inside the existing platform authority model.
