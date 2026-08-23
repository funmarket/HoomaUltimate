# HOOMA ULTIMATE — Architectural Decisions

Status: **Active ADR index**

## ADR-001 — Build a third clean repository

**Decision:** `funmarket/HoomaUltimate` is the only implementation destination. Older applications remain read-only reference material only.

**Reason:** HOOMA ULTIMATE owns its own architecture, schema, migrations, runtime and release evidence.

## ADR-002 — Target rules outrank historical implementation

**Decision:** The latest explicit product-owner instruction, root `structure.md`, root `requirements.md`, this ADR index and `docs/CANONICAL_MODEL.md` define the target. Historical code never overrides a newer target rule merely because it already exists.

**Reason:** Prevent drift back into legacy compromises.

## ADR-003 — Four application runtimes with layered backend domains

**Decision:** Runtime apps are API, Web, Telegram and Worker. Substantial API domains use `domain/application/infrastructure/http` layering.

**Reason:** Deployment/platform separation and domain boundaries are both required.

## ADR-004 — One canonical User, two independent authentication transports

**Decision:** TelegramIdentity and WebCredential/WebSession independently resolve to one User. No heuristic auto-linking.

**Reason:** Prevent identity collision and accidental account takeover.

## ADR-005 — Use Argon2id for Web passwords

**Decision:** Web passwords use Argon2id.

**Reason:** This is the locked security requirement.

## ADR-006 — Fail closed on credential conflict

**Decision:** Valid Telegram -> User A plus valid Web -> User B returns `AUTH_CONFLICT`.

**Reason:** Never silently choose a principal when two authenticated identities disagree.

## ADR-007 — Public browsing is a first-class API boundary

**Decision:** Public reads live under `/api/public/v1/*`; member/private actions under `/api/v1/*`; global Admin actions under `/api/v1/admin/*`.

**Reason:** Discovery is public while protected actions remain auditable authorization boundaries.

## ADR-008 — ADMIN is global only

**Decision:** Only `PLATFORM_ADMIN` uses Admin terminology. Scoped domains use Founder/Coach/Assistant/Leader/Moderator/Member/Player/Owner terminology.

**Reason:** Authority must match product language and scope.

## ADR-009 — HOOMA ULTIMATE owns a fresh migration history

**Decision:** Before first release, the normalized current schema is represented by one reviewed initial migration. Once HOOMA ULTIMATE ships, migrations become forward-only.

**Reason:** Pre-release inconsistencies should be removed rather than preserved as permanent corrective migration history.

## ADR-010 — Canonical Place is the physical-location source of truth

**Decision:** Lounge/Cafe, Pitch, Watch and FanHub contexts reference one physical Place when those domains are implemented.

**Reason:** Prevent duplicate venue records and contradictory ownership/location data.

## ADR-011 — Pitch remains a dedicated product over canonical Place

**Decision:** `/pitch` remains permanent and in bottom navigation. The Places Pitch tab and standalone Pitch product will read the same `Place + Pitch capability/profile` source rather than separate venue databases.

**Reason:** Preserve a dedicated user journey without duplicating physical places.

## ADR-012 — Teams own football-team lifecycle and scoped authority

**Decision:** Teams owns Team identity, roster, direct Coach/Assistant responsibilities, explicit Assistant capability grants, lineups, challenges, accepted-match Games and leader-only match coordination.

**Reason:** These concepts share one Team authority model and must not be split across Community, Events or frontend state.

## ADR-013 — Coach Control Room replaces scoped Admin language

**Decision:** Team management is called Coach Control Room. Assistant authority is explicit capabilities, not broad role inheritance.

**Reason:** Matches product language and least privilege.

## ADR-014 — Community-to-Team V1 rule

**Decision:** Every current Team belongs to one Community. V1 allows a maximum of one ACTIVE Team per Community, while persistence may retain inactive/historical Team rows so future squads do not require redesigning Team identity.

**Reason:** Matches current product scope while remaining future-compatible.

## ADR-015 — TeamPlayer is roster identity first, optional User link second

**Decision:** TeamPlayer requires a Team and display name but does not require a HOOMA User account. `userId` is optional and is never globally unique.

**Reason:** Real football rosters must support players who have not registered in HOOMA.

## ADR-016 — Team lineups reference TeamPlayer and normalized pitch coordinates

**Decision:** TeamLineup owns formation/match format/current/published state. TeamLineupSlot references TeamPlayer and stores normalized `x/y` coordinates, starter state and ordering.

**Reason:** Roster and tactical lineup are separate concepts, and the data must support real responsive pitch rendering.

## ADR-017 — Assistant authorization is capability-specific

**Decision:** Direct Team Coach and the explicit Community Founder/Coach fallback have Coach-equivalent Team authority. Assistant actions require the exact active capability for the operation.

Required Assistant capabilities:

```text
EDIT_TEAM
MANAGE_ROSTER
MANAGE_LINEUP
CREATE_CHALLENGE
RESPOND_TO_CHALLENGE
MANAGE_TEAM_EVENTS
```

**Reason:** An Assistant role must never become an implicit broad manager role.

## ADR-018 — Team challenge lifecycle has database-level invariants

**Decision:** A Team cannot challenge itself; only one pending challenge may exist for an unordered Team pair; transitions are atomic; accepting a challenge creates at most one TeamGame.

**Reason:** Retry/concurrency correctness belongs at service and database boundaries, not only in UI state.

## ADR-019 — Team leader coordination starts only after acceptance

**Decision:** Challenge coordination messages are available only after the Challenge is ACCEPTED and only to Coach-equivalent participants or an Assistant with `RESPOND_TO_CHALLENGE` for a participating Team.

**Reason:** The conversation exists for accepted-match coordination, not as general Team chat.

## ADR-020 — Events is canonical lifecycle; Play is the current implemented event product

**Decision:** Events owns Event lifecycle, RSVP/waitlist, formations, check-in and temporary Event chat. During foundation normalization the creation path supports PLAY only.

**Reason:** WATCH must not exist as a half-domain before canonical Places and Watch-specific rules are implemented.

## ADR-021 — Temporary Event chat requires cleanup ownership

**Decision:** Event chat has an explicit time window and expired messages are excluded from reads. Worker owns eventual durable cleanup of expired rows. Events cannot be called fully complete until that cleanup path is implemented and verified.

**Reason:** “Temporary” must describe storage lifecycle as well as query filtering.

## ADR-022 — Cash and Telegram Stars are the initial payment rails

**Decision:** When Payments is implemented, initial methods are CASH and TELEGRAM_STARS only. No credit-card rail is introduced by implication.

**Reason:** This is the product contract.

## ADR-023 — ULTRAS is independent

**Decision:** ULTRAS has its own persistent domain and roles; it is not Team tables or generic Community renamed.

**Reason:** Product semantics and privacy differ.

## ADR-024 — Gamers is independent

**Decision:** Gamer profiles/squads/challenges/results use independent models, not Team tables.

**Reason:** Avoid incorrect football-Team coupling.

## ADR-025 — One global Whistle engine

**Decision:** One transient engine serves approved contexts. Body lives only in Redis, metadata only in PostgreSQL, with the exact 33-grapheme / 11-per-day / 24-hour unread / 60-second reveal rules.

**Reason:** Prevent duplicate messaging systems and permanent-body leaks.

## ADR-026 — PostgreSQL durable, Redis transient, object storage bytes

**Decision:** Persistent business truth stays in PostgreSQL. Redis is disposable transient infrastructure. Media bytes live in S3-compatible storage.

**Reason:** Clear failure and retention semantics.

## ADR-027 — Use transactional outbox for asynchronous work

**Decision:** Durable mutation and OutboxEvent commit together when an asynchronous side effect is required; Worker claims safely and retries without duplicating business policy.

**Reason:** Avoid lost async work and inconsistent side effects.

## ADR-028 — Separate frontend shells, share presentation selectively

**Decision:** Web and Telegram share contracts/design tokens/platform-neutral components where appropriate but maintain independent router/provider/shell ownership.

**Reason:** Telegram has lifecycle/navigation responsibilities that Web does not.

## ADR-029 — Use real routers and route-level lazy loading

**Decision:** Web and Telegram use explicit router configuration and lazy feature/page loading. Manual `window.location.pathname` routing is not a permanent architecture.

**Reason:** The route count will expand substantially and needs testable ownership and loading boundaries.

## ADR-030 — Contracts are split by domain

**Decision:** `packages/contracts` uses domain files with `index.ts` as a re-export surface rather than one growing cross-domain implementation file.

**Reason:** Preserve ownership and prevent a new monolith.

## ADR-031 — Shared approved brand assets have one governed source

**Decision:** Approved HOOMA wordmarks, heritage crests, Match Day assets, collector-ticket masters and neutral fallbacks live under the shared UI/design asset ownership and are reused by Web/Telegram without binary duplication.

**Reason:** Brand assets are product infrastructure, not page-local decoration.

## ADR-032 — CI is read-only

**Decision:** CI never regenerates/commits/pushes dependency lockfiles or source changes. The repository must already contain a correct committed `package-lock.json`; CI runs `npm ci` and fails if it is inconsistent.

**Reason:** Verification must detect source drift, not repair it invisibly.

## ADR-033 — Integration tests use real disposable infrastructure

**Decision:** Critical persistence/concurrency/TTL/worker behavior is proven with real disposable PostgreSQL and Redis where relevant.

**Reason:** Database locking, migrations, outbox claiming and Whistle TTL/quota semantics cannot be proven by mocks alone.

## ADR-034 — Preview Mode is frontend-isolated and development-only

**Decision:** Preview uses MSW or equivalent. Production backend auth contains no fake-user bypass and production build rejects Preview Mode.

**Reason:** Enable UI review without creating security backdoors.

## ADR-035 — Feature completion is vertical-slice evidence

**Decision:** Schema/page/endpoint existence is insufficient. DONE requires the complete applicable UI -> API -> authorization -> service -> repository -> persistence -> read-back path plus verification gates.

**Reason:** Prevent partial/schema-only completion claims.

## ADR-036 — Locked navigation contracts

**Decision:** Bottom nav = Home/Play/Watch/HOOMA/Pitch. Home gateway = HOOMA/Teams/ULTRAS/Gamers + Places/Requests/Ride/FundMe. Places tabs = Lounges/Cafes/Pitch/FanHub with Lounges/Cafes default.

**Reason:** These are explicit product acceptance rules.

## ADR-037 — Donor data import is separate from application migrations

**Decision:** HOOMA ULTIMATE starts clean. If historical data is ever imported, it uses an explicit ETL/reconciliation process rather than redefining application migrations.

**Reason:** Product architecture and migration history remain greenfield.

## ADR-038 — Normalization freeze precedes new domains

**Decision:** While `docs/NORMALIZATION_PLAN.md` is active, new Places/Watch/Pitch/ULTRAS/Gamers/Requests/Ride/FundMe/Payments/Media/Replay/HOOMA NOW implementation remains frozen unless explicitly unfrozen by a newer product-owner decision.

**Reason:** Existing foundation inconsistencies must be corrected before dependency-heavy domains build on them.

## ADR-039 — Whistle vertical slice is explicitly unfrozen

**Decision:** The product owner explicitly authorized Whistle setup on 2026-08-23. Whistle is therefore removed from ADR-038's freeze and becomes a current vertical slice. The shared Whistle engine is implemented once and reused by approved contexts. The first enabled context is private HOOMA Community Whistle Board access for active Community members. Event, Team, Ride, ULTRAS and Gamer Squad Whistle contexts remain disabled until their own context-specific authorization slices are implemented.

Whistle invariants remain locked:

```text
33 grapheme clusters maximum
11 total sends per user per UTC calendar day across every context
body in Redis only
PostgreSQL metadata only
24-hour unread body TTL
60-second per-viewer reveal window after first reveal
first reveal never extends on later reads
```

Temporary Event Chat remains a separate legacy Events mechanism for now and must not be renamed or reused as Whistle storage. The later Play communication direction is Event Whistle Board through the shared Whistle engine; Event Chat removal requires its own traced cleanup/migration slice.

**Reason:** The product owner chose Whistle as a differentiating core mechanic and explicitly requested that it be set up now. Recording the override prevents normalization automation or later contributors from reverting valid Whistle work as frozen scope.
