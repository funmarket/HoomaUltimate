# HOOMA — Gamers G3 Execution Plan

Status: ACTIVE IMPLEMENTATION CHECKLIST
Date: 2026-08-23
Branch: feat/gamers-human-match-system
Scope owner instruction: challenge cards/actions, recipient accept/reject, clickable full Gamer profiles, canonical Match Card/Arena projection, and a stronger football-gaming visual identity for Gamers using a dark premium surface with restrained dim lime-green accents.

This file is a narrow execution plan for G3. It does not replace `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, `docs/GAMERS_PRODUCT_CONTRACT.md`, or ADR-041. Newer explicit product-owner instructions remain authoritative.

## 1. G3 outcome

Implement one complete Gamers-domain challenge vertical slice:

```text
public game hub / challenger card
-> public full Gamer profile
-> authenticated Challenge action
-> durable pending GamerChallenge
-> recipient incoming challenge view
-> recipient ACCEPT or REJECT
-> challenger sees canonical status
-> accepted GamerChallenge becomes the canonical HOOMA Match Card
-> Arena projects challenge/match state
```

At the same time, upgrade the existing Gamers presentation so the landing page, game hub, challenger cards and Gamer profile feel intentionally built for mobile football/gaming users rather than generic application cards.

## 2. Locked boundaries

- Gamers remains independent from Play, football Team challenges and TeamGame.
- Reuse canonical HOOMA User/UserPresentation only for public identity presentation; never create GamerUser.
- Challenger and challenged participants are GamerProfiles in the same GamerGame.
- No self challenge.
- No cross-game challenge.
- Target GamerProfile must be open to challenge when the challenge is created.
- Duplicate unresolved challenges for the same unordered pair/game must be prevented safely, including opposite-direction duplicates.
- Challenge creation is authenticated and server-authorized.
- Only challenged GamerProfile owner may accept or reject a pending challenge.
- Challenger may cancel only while PENDING.
- Status transitions must be concurrency-safe and idempotent where a repeated network request would otherwise create duplicate Match Cards/state.
- Accepted GamerChallenge itself is the canonical Match Card identity. Do not add GamerMatch in G3.
- Gameplay remains outside HOOMA. Do not add EA/Ludo telemetry or fake online state.
- No result submission/ranking schema or behavior in G3; those remain G4/G5.
- No GamerSquad/Whistle work in G3.

## 3. Challenge lifecycle for this slice

G3 persists only states required by the implemented challenge/Match Card lifecycle:

```text
PENDING -> ACCEPTED
PENDING -> DECLINED
PENDING -> CANCELLED
```

`ACCEPTED` is the Match Card state handed to G4 later. Do not implement RESULT_PENDING, COMPLETED, DISPUTED or EXPIRED behavior yet.

## 4. Canonical persistence target

`GamerChallenge` should own the current G3 interaction/match identity and contain only fields required for durable truth and efficient authorization/querying, including conceptually:

```text
GamerChallenge
  id
  gameId
  challengerProfileId
  challengedProfileId
  pairKey
  status
  createdAt
  respondedAt?
  cancelledAt?
  updatedAt
```

`pairKey` is a canonical unordered GamerProfile pair key used with game/status policy to prevent reverse-direction duplicate unresolved challenges safely. Exact database constraints/indexes must match repository/service behavior and real PostgreSQL tests.

Do not duplicate canonical User ids into GamerChallenge when GamerProfile ownership already provides the authorization path.

## 5. Public Gamer profile

A Challenger card must be clickable and open a public game-scoped Gamer profile route.

Public profile projection may include:

- GamerProfile id;
- game handle;
- canonical public User presentation already approved for public identity surfaces, including public bio when the current Identity public presentation contract exposes it;
- truthful open-to-challenge state when needed to render the action;
- privacy-safe game context.

It must not expose private account/contact/auth fields, canonical internal userId, timestamps merely because they exist, or fabricated presence telemetry.

The Challenge action appears on eligible other-user profiles/cards. A visitor may browse the profile publicly; the protected Challenge action gates at canonical HOOMA authentication.

## 6. Challenge API/application ownership

Extend the existing Gamers module and existing shared contracts/API client; do not create a parallel challenge module or API client.

Expected capability surface:

Public:
- game-scoped public Gamer profile detail.

Member:
- create challenge to a GamerProfile;
- list my incoming/outgoing challenges for the selected game / Arena projection;
- accept a pending incoming challenge;
- decline a pending incoming challenge;
- cancel my own pending outgoing challenge.

All authorization belongs server-side in GamerService/domain policy and repository transaction boundaries, not only in UI button visibility.

## 7. Arena / Match Card projection

The existing `ARENA` hub area becomes functional in G3 and reads canonical GamerChallenge state. It should present:

- incoming pending challenges with ACCEPT / REJECT actions;
- outgoing pending challenges with status and eligible CANCEL action;
- accepted challenges as Match Cards ready for external gameplay;
- participant public identity/handle needed to understand each card.

Do not create an `Arena` database table. Arena is a projection.

## 8. Visual direction

Upgrade Gamers with an original HOOMA gaming design inspired by the general energy of premium modern football-game interfaces without copying EA trademarks, logos, proprietary artwork, or exact layouts.

Direction:
- near-black / charcoal layered backgrounds;
- cleaner high-contrast typography;
- restrained dim lime-green accent for primary challenge/action/status emphasis;
- subtle gradients, edge highlights and panel depth rather than generic white cards;
- stronger game hero and game-hub hierarchy;
- challenger cards that feel like player/gamer cards while remaining readable on phones;
- compact game handle + canonical identity hierarchy;
- clear Challenge CTA;
- polished accepted Match Card presentation;
- responsive mobile-first behavior shared by Web and Telegram;
- preserve HOOMA shell and locked bottom navigation exactly `Home | Play | Watch | HOOMA | Pitch`.

No fake game screenshots, copyrighted EA assets, or visual treatment that suggests official EA affiliation.

## 9. Verification required before G3 completion

- re-check branch/foundation HEAD before writes and before merge;
- Prisma generate + validate;
- migration deploy against disposable real PostgreSQL;
- focused real PostgreSQL integration coverage for:
  - create challenge;
  - self challenge denied;
  - cross-game challenge denied;
  - closed target denied;
  - same-direction duplicate pending challenge denied;
  - reverse-direction duplicate pending challenge denied;
  - unauthorized accept/decline/cancel denied;
  - accept creates exactly one accepted canonical challenge/Match Card under concurrent/repeated acceptance;
  - decline terminal behavior;
  - cancel terminal behavior;
  - public Gamer profile privacy projection;
  - Arena participant/status projection;
- touched-source lint/format;
- typecheck;
- affected package/web build;
- no increase over current inherited repository formatter debt baseline;
- exact changed-file/source re-read before PR/merge.

## 10. Explicit exclusions

Not G3:
- result submission / evidence / confirmation / contest;
- ranking / Elo / rating history;
- GamerSquad creation or membership;
- Gamer Squad Whistle;
- Platform Admin catalog curation;
- external gameplay APIs;
- presence/online telemetry;
- sixth bottom-nav item.
