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

## ADR-015 — TeamPlayer requires a canonical HOOMA User

**Decision:** Every `TeamPlayer` is a roster membership for an existing canonical HOOMA `User`. `userId` is required and is never globally unique. HOOMA does not create placeholder/offline TeamPlayer records for people who do not have a HOOMA account.

Public visitors may browse privacy-safe Team and other public product surfaces without an account. Authentication is required only when they attempt a protected action such as joining, creating, managing, challenging, RSVP, or other member/private behavior. A guest who initiates such an action must authenticate or create a HOOMA account before a TeamPlayer or other membership record can be created.

A Team roster therefore stores Team-specific membership data only; canonical user presentation remains owned by `User` / `UserPresentation` and must not be duplicated into TeamPlayer.

**Reason:** Preserve one canonical identity model, prevent shadow/offline player identities, and keep HOOMA's locked public-first/authentication-at-action-boundary behavior consistent across Teams, Gamers, ULTRAS, and other membership domains.

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

**Superseded in part by ADR-048 and ADR-053:** The bottom navigation decision remains active. The Home gateway is replaced by the six-gateway Home IA recorded in ADR-048. The HOOMA create-flow portion is replaced by the Communities-only HOOMA creation rule recorded in ADR-053.

## ADR-037 — Donor data import is separate from application migrations

**Decision:** HOOMA ULTIMATE starts clean. If historical data is ever imported, it uses an explicit ETL/reconciliation process rather than redefining application migrations.

**Reason:** Product architecture and migration history remain greenfield.

## ADR-038 — Normalization freeze precedes new domains

**Decision:** While `docs/NORMALIZATION_PLAN.md` is active, new Places/Watch/Pitch/ULTRAS/Gamers/Requests/Ride/FundMe/Payments/Media/Replay/HOOMA NOW implementation remains frozen unless explicitly unfrozen by a newer product-owner decision.

**Reason:** Existing foundation inconsistencies must be corrected before dependency-heavy domains build on them.

**Superseded in part by ADR-048:** Requests/Ride route registration and honest frontend shells are narrowly authorized. Requests, Ride, Fundraising, FundMe, Payments and ULTRAS backend/domain/persistence work remains frozen until separately authorized.

**Superseded in part by ADR-050:** Ride and Requests backend/domain/persistence/API/frontend vertical slices are explicitly unfrozen for their own bounded implementation tasks. Fundraising, FundMe durable state, Payments, ULTRAS, generic Media and unrelated domains remain frozen unless separately authorized.

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

## ADR-040 — Whistle uses UTC-day sessions and direct visibility

**Decision:** The product owner changed Whistle retention and visibility after ADR-025/ADR-039. This ADR supersedes only the old rolling 24-hour unread TTL and 60-second Reveal portions of those decisions. The single shared engine, 33-grapheme limit, global 11-per-UTC-day quota, Redis-only body rule and PostgreSQL-metadata-only rule remain unchanged.

Current Whistle session invariants are:

```text
33 grapheme clusters maximum
11 total sends per user per UTC calendar day across every enabled context
UTC day = 00:00 UTC to next 00:00 UTC
unused sends never carry into the next UTC day
every Whistle expires at the next UTC midnight
body in Redis only
PostgreSQL metadata only
authorized feeds show the body directly
no Reveal endpoint
no 60-second viewer window
no reveal/seen keys
expired metadata is cleanup data, not permanent Whistle history
```

At the UTC reset, prior-day bodies are no longer readable and the new day starts with all 11 sends available. Redis expires bodies at the session boundary. PostgreSQL metadata may be physically removed by the next Whistle cleanup execution, but expired rows cannot remain visible or count against the new day's quota.

Current enabled contexts are private `COMMUNITY`, authorized `EVENT`, dedicated server-derived `GAMER_DIRECT`, and dedicated server-derived `USER_DIRECT`. `TEAM`, `RIDE`, `ULTRAS`, and `GAMER_SQUAD` remain disabled until their owning domains provide explicit authorization.

**Reason:** Whistle is intended to be a visible, ephemeral daily signal board. A single UTC boundary makes quota and retention deterministic, prevents unused quota from accumulating, and removes the obsolete reveal mechanic without weakening the no-durable-body invariant.

## ADR-041 — Gamers human-first match system is explicitly authorized

**Decision:** The product owner explicitly authorized the Gamers vertical slice on 2026-08-23. Gamers is therefore removed from ADR-038's freeze for the bounded Gamers work recorded in `docs/GAMERS_PRODUCT_CONTRACT.md`.

Gamers remains an independent domain. One canonical HOOMA User owns game-specific GamerProfiles. The V1 competitive loop is human-confirmed: challenge -> accept -> HOOMA Match Card -> external gameplay -> result submission -> opponent confirm or contest -> completed human-confirmed result -> per-game ranking. HOOMA does not require external EA/Ludo gameplay APIs or pretend it observed gameplay it did not observe.

Authenticated users may contribute missing games to the persisted Gamers catalog. Platform Admin is later curation/merge/deactivation authority, not the sole creator and not a blocker on legitimate game contribution. `GamerSquad` is the one gaming team/community concept. Squad Whistle uses the shared Whistle engine through `GAMER_SQUAD` only after explicit active Squad-membership authorization exists; there is no global Gamers Whistle feed or parallel Gamer chat system.

The dedicated decision record is `docs/adr/ADR-041-gamers-human-match-system.md`.

**Reason:** HOOMA should coordinate human gaming interaction, preserve what participants agree happened, and build game-specific reputation without duplicating identity/community/messaging systems or relying on opaque external automation.

## ADR-042 — Pitch suggestion and claim lifecycle

**Decision:** Pitch is an implemented dedicated product over canonical `Place`. A Pitch suggestion creates the Place and pending `PITCH` capability with real hourly pricing for App Admin review. Suggestion does not imply ownership. Verified owners use `PlaceCapabilityApplication` for later Pitch profile/pricing updates, while canonical Place contact and `PlaceImage[]` remain the single contact/media authorities.

The dedicated decision record is `docs/adr/ADR-042-pitch-suggestion-claim-lifecycle.md`.

**Reason:** Preserve one physical venue/contact/media truth while allowing Pitch discovery, moderation, ownership claims, and reviewed rental-profile updates without duplicate venue data or fabricated pricing.

## ADR-048 — Home and create-flow IA simplification

**Decision:** Home is six gateways only: HOOMA, Teams, Spots, Pitch, Ride and Requests. The permanent bottom navigation remains Home/Play/Watch/HOOMA/Pitch.

Gamers is removed from Home discovery and the HOOMA create chooser, while the existing independent Gamers domain/module/routes remain intact. FundMe is presented as a Requests page tab, with `/fundme` redirecting to `/requests/fundme` as compatibility navigation only. Ride remains a Home gateway and receives an honest frontend shell at `/rides`.

The original HOOMA/TEAM/ULTRAS create chooser portion is superseded by ADR-053. HOOMA creation is now Communities-only. Team creation remains Teams-owned at `/teams/new`, where eligible HOOMA context is selected. ULTRAS remains unavailable and independent; it must not create a Community row or use a generic `CommunityType`.

This supersedes only the Home/create-flow portions of ADR-036. It narrowly overrides ADR-038 only enough to permit Requests/Rides frontend shells and route registration; backend persistence, Payments and durable Fundraising remain frozen until separately authorized.

**Superseded in part by ADR-050 and ADR-053:** The shell-only restriction for Ride and Requests is lifted for their domain-owned vertical slices. ADR-048 remains authoritative for Home, bottom navigation, Gamers independence, ULTRAS unavailability and FundMe grouping under Requests. ADR-053 replaces ADR-048's HOOMA create chooser with Communities-only HOOMA creation.

The dedicated decision record is `docs/adr/ADR-048-home-create-flow-ia.md`.

**Reason:** The simplification changes discovery and routing without collapsing durable domain ownership or inventing fake future features.

## ADR-053 — HOOMA creates only HOOMA Communities

**Decision:** `/hooma` is the Communities-owned HOOMA surface and creates only canonical HOOMA neighborhood/local Communities through `/hooma/new`. It must not present Team or ULTRAS as “Community type” choices, and it must not act as a generic create-anything gateway.

Team creation remains owned by Teams at `/teams/new`. A Team creation flow selects one eligible HOOMA community context inside Teams before calling the Teams create API. When a Team creator lacks an eligible HOOMA, the only bounded continuation is `/hooma/new?after=team-create`; a successful HOOMA creation returns to `/teams/new?communityId=<created-id>`. Future ULTRAS creation remains unavailable until its independent domain ships and must not be implemented through Communities or a generic `CommunityType`.

Home may continue to link to independent product gateways such as Teams, but those links are navigation, not HOOMA-owned creation.

The dedicated decision record is `docs/adr/ADR-053-hooma-communities-only-creation.md`.

**Reason:** HOOMA is the product/community umbrella, but durable concepts still need one owning domain. Keeping HOOMA Community creation, Team creation and future supporter-community creation in their own domains prevents duplicate flows, generic creation abstractions and hidden orphan states.

## ADR-049 — Canonical User direct Whistle

**Decision:** Direct profile Whistle uses the existing shared Whistle engine with context `USER_DIRECT`. The caller is the authenticated canonical HOOMA User, the target is supplied by public username and resolved server-side through an Identity-owned reader, self-Whistle is forbidden, and the context identity is the deterministic unordered pair of the two canonical User IDs.

User Direct is exposed only through dedicated authenticated `/api/v1/whistles/users/:username` routes. The generic raw Whistle context route never accepts `USER_DIRECT`, and clients never construct or submit sender IDs, target IDs, direct context IDs, pair keys, or context types. Public profile DTOs continue to omit canonical User IDs.

No new DirectMessage, Conversation, inbox, direct-pair, Whistle-preference, or Whistle-body table is created by this slice. Existing `WhistleMetadata`, the existing Redis body store, the shared 33-grapheme validation, global 11-per-UTC-day quota, and next-UTC-midnight expiry remain authoritative. Existing Community, Event, and Gamer Direct behavior is not refactored by this decision.

**Reason:** This is the smallest complete User-to-User Whistle slice: it preserves one canonical User and one Whistle engine, avoids a new messaging/privacy subsystem, prevents client-forged direct contexts, and keeps current working Whistle contexts isolated from unrelated refactoring.

## ADR-050 — Ride and Requests vertical slices are explicitly unfrozen

**Decision:** The product owner explicitly authorized durable Ride and Requests implementation through `rideplan.md`. Ride and Requests are therefore removed from ADR-038's freeze for their bounded, domain-owned vertical slices: contracts, persistence, APIs, application services and frontend may be implemented only in the numbered plan order and only inside their owning boundaries.

Ride owns ride offers, ride requests, participation, meeting-point privacy, waypoints and Ride vehicle-photo metadata. Ride also owns product context and advertised compensation terms for those records. `MATCHDAY` and `GENERAL` are contexts of the same Ride domain, not separate tables, APIs, repositories or services. User-facing `GENERAL` wording is Anywhere Ride. Ride may advertise `FREE` or `CASH` compensation terms, but Ride does not process money; payment intents, checkout, settlement, wallet/card/provider state and paid/payment-received statuses remain future Payments/PAY-001 ownership. A Ride destination must use exactly one strategy: owning Event reference, canonical Place reference or Ride-owned custom destination label. Event and Place facts remain owned by those domains and are read through narrow reference ports. Ride participation requests require driver/owner acceptance before accepted capacity is consumed; drivers cannot join their own offers as passengers; cancellation rules must preserve terminal lifecycle history. Public Ride projections must never expose exact private pickup or meeting coordinates.

Ride vehicle-photo bytes belong in object storage. Until a separate generic Media domain is authorized, Ride vehicle-photo metadata belongs to a single-purpose Ride-owned model; PostgreSQL must not store binary photos, base64 payloads, storage credentials, outbox photo bytes or polymorphic generic media ownership for this work.

Requests owns help/resource requests and quantity-based partial claims. Active/accepted claim quantities must be concurrency-safe and must not exceed the requested quantity. More than one claimer is allowed while quantity remains; quantity-one requests naturally behave as single-claim requests through the same partial-claim rule. The older exclusive-claim wording is replaced by this governed quantity rule.

FundMe remains a Requests-page tab only. Durable Fundraising and Payments remain separately owned and are not authorized by this Ride/Requests unfreeze. This decision does not change Home, bottom navigation, the HOOMA create chooser, Gamers, Teams, Communities, ULTRAS or generic Media.

The dedicated decision record is `docs/adr/ADR-050-ride-requests-unfreeze.md`.

**Reason:** The product is ready to replace honest Ride/Requests shells with real bounded functionality, but adjacent UI placement must not collapse Ride, Requests, Fundraising, Payments and Media into one generic implementation.

## ADR-051 — Play match visibility is match-owned

**Decision:** Play match discoverability is owned by `PlayEventDetails.visibility`, not by Community visibility and not by a generic Event visibility field. `OPEN` matches are discoverable through authenticated `/api/v1/play/open-matches` and viewable through authenticated `/api/v1/play/matches/:eventId`; `PRIVATE` matches are hidden from unrelated accounts and direct IDs cannot bypass the same Play access policy used for join, RSVP, cancellation, manager and invite lifecycle access.

Public Event detail remains public for Watch/non-Play content only. The public Event detail endpoint must not expose Play match detail. Seeing or joining an OPEN Play match in a PRIVATE Community does not grant Community membership, member lists, admin controls, Whistle boards or other private Community resources.

The dedicated decision record is `docs/adr/ADR-051-play-match-visibility.md`.

**Reason:** Play match recruitment privacy and Community content privacy are distinct product concepts. Keeping match visibility on PlayEventDetails preserves Watch behavior, avoids Community-driven Play discovery bugs, and prevents a second Event-wide visibility model.

## ADR-052 — Community-scoped RideRequests project into HOOMA NOW

**Decision:** A Community-scoped RideRequest is one Ride-owned canonical request whose current active state is projected into HOOMA NOW for explicitly authorized HOOMA Communities; Community and HOOMA NOW never copy, own, or independently manage that RideRequest.

RideRequest audiences are `GLOBAL` or `COMMUNITY`. User-facing `Everyone` creates a global RideRequest with zero Community targets. User-facing `One of my HOOMAs` creates a Community-scoped RideRequest for exactly one active requester membership. User-facing `All my HOOMAs` is a write-time command that resolves the requester's current active Community memberships into exact persisted Community audience rows; there is no persistent `ALL_MY_HOOMAS` flag and future joins do not expand old requests.

Community-scoped RideRequests are excluded from public Ride request discovery and public exact-ID Ride request detail. They appear only in the selected Community page's HOOMA NOW surface for active members, while the canonical RideRequest is `OPEN`, unexpired, targets that Community, the requester still belongs to that Community, and the Community remains active. Whistle remains separate and does not store RideRequests.

The dedicated decision record is `docs/adr/ADR-052-community-ride-requests-hooma-now.md`.

**Reason:** HOOMA NOW needs live Community Ride coordination without creating a second Ride owner, lifecycle or feed table. Persisting exact targets keeps `All my HOOMAs` deterministic at write time while preserving one canonical RideRequest ID across every selected HOOMA.
