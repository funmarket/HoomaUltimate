# HOOMA — GAMERS PRODUCT CONTRACT

Status: **OWNER-APPROVED ACTIVE PRODUCT DIRECTION**  
Scope: Gamers vertical slice  
Product name: **HOOMA**

This document records the product owner's explicit Gamers direction chosen on 2026-08-23. Where older Gamers planning text conflicts with this contract, the newer owner decision wins under `AGENTS.md`.

Gamers is intentionally human-first: HOOMA introduces people, lets them challenge one another, records what the participants agree happened, builds game-specific reputation/ranking from completed human-confirmed matches, and gives real Gamer Squads a private Whistle Board. External game APIs are not required for the core product.

---

## 1. Entry and navigation

- The existing Home `Gamers` gateway remains the entry and links to `/gamers`.
- Permanent bottom navigation remains exactly `Home | Play | Watch | HOOMA | Pitch`.
- Gamers must not add a sixth permanent bottom-navigation item.
- `/gamers` is the Gamers landing route.
- Game-specific child routes are added only as the implemented slice requires them.

---

## 2. Domain boundary

Gamers is independent from football Teams and from HOOMA Communities.

- One canonical HOOMA `User` remains the identity source.
- Gamer data belongs to the Gamers domain.
- Football `Team` tables/models/roles must not be reused for Gamer Squads.
- There is no separate `GamerUser` identity.
- Global App Admin remains `PLATFORM_ADMIN`; no Gamer-scoped role may be named Admin.

---

## 3. Game catalog

HOOMA launches with first-class support focused on mobile/tablet gaming, beginning with:

- EA SPORTS FC Mobile;
- Ludo/Ludo King where the product presentation uses the appropriate game name.

Additional games may be present as the catalog grows.

The catalog and other privacy-safe Gamers discovery stay browsable without a HOOMA account. A visitor is not required to create a profile merely to open `/gamers` or inspect a public game surface.

Authenticated users may add a missing game from Gamers. Community-created game entries are not a separate frontend-only list: they are real Gamers-domain records.

Platform Admin remains the later curation authority and may:

- promote/mark catalog entries as official/supported;
- merge duplicates deliberately;
- correct presentation metadata;
- deactivate spam/invalid entries.

User contribution and later Admin curation are compatible; Gamers must not require Platform Admin intervention before every legitimate missing game can be used.

Duplicate detection should normalize obvious naming variants before creating another game record. Ambiguous matches must not be silently merged.

---

## 4. Gamer profile / game identity

A user creates at most one active GamerProfile for a given game.

A GamerProfile can be created only for an existing canonical HOOMA `User`/profile. If a public visitor attempts a Gamer action that requires GamerProfile or Gamer Squad membership, HOOMA prompts for the canonical HOOMA account at that action boundary first. There is never a second Gamer account/signup.

Conceptually:

```text
User
  -> GamerProfile (FC Mobile, username = TunisiaFC)
  -> GamerProfile (Ludo, username = FunKing)
```

Each GamerProfile contains game-specific presentation/participation data, including:

- game;
- username/handle used in that game;
- optional short bio/presentation where supported;
- open-to-challenge state;
- created/updated timestamps.

HOOMA profile presentation remains owned by Identity. Do not duplicate HOOMA display name/photo/bio into GamerProfile merely for rendering convenience.

Rankings and records are per game, never globally shared across unrelated games.

---

## 5. Game hub UX

Inside a selected game, the primary product areas are:

```text
CHALLENGERS | SQUADS | ARENA | RANKINGS
```

There is no global Gamers Whistle feed/tab.

Challenger cards use truthful state such as `OPEN TO CHALLENGE`. Do not display fake `ONLINE` presence unless HOOMA later owns a real presence source.

---

## 6. Human challenge lifecycle

V1 challenges are 1v1 GamerProfile-to-GamerProfile interactions within the same game.

Rules:

- a GamerProfile cannot challenge itself;
- challenger and challenged GamerProfiles must belong to the same game;
- challenged profile must be eligible/open to challenge according to policy;
- challenge creation is authenticated and server-authorized;
- only the challenged participant may accept/decline;
- challenger may cancel only while policy permits;
- duplicate unresolved challenges for the same relevant pair/game must be prevented safely;
- accepted challenges become the canonical HOOMA Match Card for that interaction;
- gameplay occurs outside HOOMA in the users' chosen game app/device.

Canonical lifecycle starts with:

```text
PENDING -> ACCEPTED -> RESULT_PENDING -> COMPLETED
                         |                
                         -> DISPUTED
```

Additional terminal states may include `DECLINED`, `CANCELLED`, and `EXPIRED` where the implemented lifecycle requires them.

Do not invent external gameplay telemetry or claim HOOMA watched the game.

---

## 7. Result submission, confirmation and contest

After external gameplay, either participant may submit a result.

For score-based games such as FC Mobile, the result may include:

- participant scores;
- winner or draw;
- optional screenshot/evidence reference.

The opponent must then be able to:

- confirm the submitted result; or
- contest it and provide their own result/evidence.

The system may also support independent result submission by both participants. If two independently submitted outcomes agree, the match may complete. If they conflict, it becomes disputed.

Important rules:

- the first participant to submit never unilaterally wins the match;
- a screenshot is evidence, not an automatic judge;
- screenshot/OCR assistance may later pre-fill fields but must not silently determine truth;
- a contested match causes no ranking change until a valid resolution exists;
- terminal completed results are immutable through ordinary editing;
- rematch creates a new challenge/match identity rather than resetting the old one.

Only `COMPLETED` human-confirmed matches are eligible to affect ranking.

---

## 8. Ranking

Ranking is a Gamers-domain consumer of completed match truth, not the source of match truth.

The match/result service answers: **what outcome did the two participants confirm?**

The ranking service answers: **what does that completed outcome do to each game-specific rating/record?**

Requirements:

- rating is per GamerProfile/game;
- completed wins/losses/draws are derived from canonical completed matches;
- disputed/unconfirmed matches do not change ranking;
- applying a completed match to rating must be idempotent;
- both participants' rating updates and rating-history records should commit atomically;
- rating history keeps before/after/delta/outcome evidence tied to the canonical match/challenge;
- no black-box AI ranking is required.

An understandable Elo-style model is the preferred first implementation; exact initial rating and calculation constants must be chosen explicitly in the ranking slice rather than guessed earlier.

---

## 9. Gamer Squad = gaming team/community

HOOMA uses one Gamers concept, `GamerSquad`, for the gaming team/community instead of creating duplicate `GamerTeam` and `GamerCommunity` membership systems.

A Squad belongs to one game and receives its own public community-style page.

Creation supports:

- squad name;
- optional description;
- optional `logoUrl` supplied by the creator;
- optional `bannerUrl` supplied by the creator;
- join policy.

Missing optional logo/banner must render a controlled fallback rather than a broken image area.

Valid early-phase external image URLs may be used until shared managed Media owns upload bytes. Gamers must not create a parallel image-storage system.

---

## 10. Squad page and membership

A Gamer Squad page has a public privacy-safe presentation and a member-private HQ.

Public presentation may include:

- banner;
- logo;
- name;
- game;
- description;
- privacy-safe membership/count information;
- join/request state.

Membership references GamerProfile because a Squad belongs to one game.

V1 roles:

```text
LEADER | MEMBER
```

V1 join policies:

```text
OPEN | REQUEST | INVITE_ONLY
```

Rules:

- creator becomes active `LEADER` transactionally with Squad creation;
- membership GamerProfile game must equal Squad game;
- public visitors never gain private HQ access merely by discovering the Squad;
- a visitor without a HOOMA account may browse the public Squad page but must create/sign in to the canonical HOOMA account before joining/requesting membership;
- Leader controls the implemented membership-management actions;
- no generic Gamer `ADMIN` role.

---

## 11. Squad-only Whistle

Gamers does not create another messaging/chat system.

Gamer Squad uses the one shared Whistle engine with context:

```text
GAMER_SQUAD
```

Whistle appears only inside the authorized Gamer Squad member page/HQ, not as a global Gamers Whistle feed.

Authorization:

- list/read Squad Whistles -> active Squad membership required;
- send Squad Whistle -> active Squad membership required;
- random public Squad visitor -> denied.

Gamers does not duplicate or pin its own Whistle retention behavior. It inherits the current authoritative shared Whistle contract from `requirements.md`, `docs/CANONICAL_MODEL.md` and the latest Whistle ADR. At the current decision state that means:

```text
33 grapheme clusters maximum
11 total sends per User per UTC calendar day across ALL enabled contexts
UTC day = 00:00 UTC to next 00:00 UTC
unused sends never carry over
every Whistle expires at the next UTC midnight
body in Redis only
PostgreSQL metadata only
authorized feeds show the body directly
no Reveal endpoint
no per-viewer reveal/seen state
```

Community Whistles and future Gamer Squad Whistles therefore consume the same global 11/day quota.

The existing shared Whistle UI/client should be generalized when necessary rather than copied into a parallel Gamers Whistle implementation.

---

## 12. Persistence target

The bounded Gamers implementation may introduce durable models as their vertical slices begin. The target concepts are:

```text
GamerGame
GamerProfile
GamerChallenge
GamerResultSubmission
GamerRanking
GamerRatingHistory
GamerSquad
GamerSquadMembership
```

Do not create an `Arena` table; Arena is a projection of challenge/match lifecycle.

Do not create Gamer chat/message tables for this product direction.

Do not create a separate `GamerMatch` merely because the UI says Match Card unless implementation proves Challenge and Match require separate durable identities. In the current direction, the accepted GamerChallenge can remain the canonical match identity.

---

## 13. Public/member boundary

Privacy-safe Gamers discovery remains public where appropriate. Opening `/gamers` or a public game/Squad surface must not itself create a HOOMA profile.

Protected actions require the existing canonical HOOMA account at the action boundary, including:

- add a game;
- create/update GamerProfile;
- challenge;
- accept/decline/cancel;
- submit/confirm/contest result;
- create/join/manage Squad;
- access Squad private HQ;
- list/read/send Squad Whistles.

If the visitor has no HOOMA account/profile, the protected action leads to canonical HOOMA account creation/sign-in first and returns to the requested Gamers surface. Once the canonical account exists, Gamers reuses it. No Gamer-specific signup/account is allowed.

Server-side authorization is mandatory; hiding a button is not authorization.

Whistle routes remain owned by the Whistle domain rather than moving under Gamers.

---

## 14. Mobile/Web/Telegram interaction direction

Gamers is phone/tablet-first because the launch use case is mobile gaming such as FC Mobile and Ludo.

Users are expected to leave HOOMA, play in the external game app, and return to HOOMA to report/confirm the result. HOOMA must not require the browser/Mini App to stay continuously open while gameplay occurs.

The shared HOOMA frontend remains the implementation surface for Web and Telegram delivery. Telegram-specific safe area/back/lifecycle behavior remains supported through the existing runtime architecture.

---

## 15. Implementation sequence

Implement as bounded vertical slices:

0. **G0 — consolidate first**: reconcile the current foundation, retire duplicate ADR numbering, absorb only the useful old Gamers layering into one canonical module tree, remove the hardcoded bootstrap-catalog direction, and align governing documents before persisted Gamers behavior begins.
1. **G1 — Gamers entry + catalog**: real `/gamers` route, persisted GamerGame catalog, FC Mobile/Ludo launch entries, authenticated missing-game contribution and duplicate handling.
2. **G2 — Gamer identity + Challengers**: GamerProfile, game username, open-to-challenge, discovery/profile UI. GamerProfile creation reuses an existing canonical HOOMA User/profile and must never introduce a second Gamer signup.
3. **G3 — Challenge + Match Card**: send/accept/decline/cancel, concurrency-safe lifecycle, Arena projection.
4. **G4 — Results**: submit, optional evidence reference, confirm, contest, independent agreement, completed/disputed, rematch.
5. **G5 — Ranking**: per-game rating/record, idempotent atomic rating updates/history, Rankings UI.
6. **G6 — Gamer Squads**: creation, optional logo/banner URL, public Squad community page, membership, Leader/member HQ.
7. **G7 — Squad Whistle + hardening**: enable `GAMER_SQUAD` through explicit membership authorization using the existing Whistle engine and prove the then-current shared Whistle privacy/quota/retention/no-durable-body invariants.

Each slice must follow `AGENTS.md` / `docs/LIVING_BUILD_PLAN.md` and must not be called complete beyond actual verification evidence.
