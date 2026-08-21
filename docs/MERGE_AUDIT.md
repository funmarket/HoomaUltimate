# HOOMA ULTIMATE — Merge Audit

Status: **Authoritative merge baseline**  
Target repository: `funmarket/HoomaUltimate`  
Source A baseline: `funmarket/HOOMA@3b570506df6528a592ec1908ee85167dcd23d9b0`  
Source B baseline: uploaded `HOOMA_CLEAN_FRESH_APP_v3_PUBLIC_BROWSING(1).zip`

## Purpose

HOOMA ULTIMATE is a third implementation. Neither source repository is the final application and neither source may be copied wholesale.

The merge rule is:

- preserve verified mature behavior from Source A;
- adopt verified architectural improvements from Source B;
- remove Source A's scoped-Admin terminology and other identified defects;
- do not inherit Source B's feature regressions, zero-migration state, thin tests, broken CI order, or schema-only completion claims;
- normalize duplicate concepts into one coherent product, one schema, one API architecture, and one migration chain;
- never mark a target feature DONE until the complete production vertical slice is verified.

## Source precedence

1. Principal Engineering Directive.
2. Latest explicit HOOMA product requirements.
3. Product-owner decisions in `docs/DECISIONS.md`.
4. Verified mature behavior from Source A.
5. Verified improved architecture from Source B.
6. Legacy comments and stale plans.

## Required trace path

Every substantial feature must be traced before porting:

`route -> page -> component -> state/query -> API client -> contract -> controller -> authorization -> application service -> domain rule -> repository port -> Prisma repository -> schema -> migration -> worker/Redis/media dependency -> tests -> deployment/runtime`

A page or model does not prove a feature exists.

## Adoption statuses

| Status | Meaning |
|---|---|
| `KEEP_A` | Source A is the primary mature implementation baseline. |
| `KEEP_B` | Source B is the primary architectural/feature baseline and must be hardened. |
| `MERGE` | Required behavior exists across both sources and must become one implementation. |
| `REBUILD` | Neither source is acceptable as-is; rebuild from locked requirements. |
| `REMOVE` | Do not carry this source concept into the final product. |

## Source A inventory

Verified strengths:

- mature layered API modules with `application`, `domain`, `infrastructure`, and `http` separation;
- Teams discovery/detail/update, lineups, lineup slots, challenges, challenge conversations, challenge lifecycle, and games;
- Events/Play creation/detail, RSVP, formations, check-in, and event chat;
- dedicated Pitch product and mature Pitch API/UI/tests;
- Watch/FanHub/Place functionality;
- mature Profile UI;
- Telegram Mini App-specific shell behavior and BackButton/MainButton utilities;
- Requests, Ride, FundMe;
- Cash and Telegram Stars runtime including provider/webhook logic;
- committed Prisma migration chain;
- broader tests and deployment/preflight scripts.

Verified liabilities:

- legacy `CommunityRole.ADMIN` violates the global-only Admin terminology rule;
- identity data and legacy auth/session structures require normalization;
- public/member APIs are not consistently separated under explicit namespaces;
- only one Mini App frontend exists rather than separate Web and Telegram applications;
- independent ULTRAS, Gamers, Whistle, Worker/Outbox, Replay and final media pipeline are missing or incomplete;
- current Admin/community management boundaries require normalization.

## Source B inventory

Verified strengths:

- `apps/api`, `apps/web`, `apps/telegram`, `apps/worker` topology;
- shared packages for auth/config/contracts/database/domain/storage/testing/ui;
- independent `TelegramIdentity`, `WebCredential`, `WebSession` concepts;
- explicit public/member API boundary direction;
- `PLATFORM_ADMIN` and App Admin dashboard direction;
- Team Coach/Assistant responsibilities and delegated capabilities;
- canonical Place direction;
- independent ULTRAS and Gamers foundations;
- substantive Whistle implementation using Redis/Valkey body storage plus PostgreSQL metadata;
- Outbox/Worker and S3-compatible media architecture;
- Replay and discovery/read-model foundations.

Verified liabilities:

- no committed Prisma migration SQL chain;
- fresh-schema strategy is incompatible with preserving the current Railway database/history;
- backend feature modules are too flat compared with Source A;
- password hashing uses scrypt instead of required Argon2id;
- CI ordering is invalid: dependency install creates `node_modules` then architecture check rejects it, and tests expect `dist` before build;
- test coverage is materially weaker;
- several models are foundational/schema-only;
- mature Cash/Telegram Stars/Event/Team/Pitch behavior is weaker or regressed;
- Telegram shell is too generic;
- Whistle notification worker needs real delivery attempts rather than metadata-only completion.

## Adoption matrix

| Domain / feature | A | B | Decision | Final target |
|---|---|---|---|---|
| Repository topology | API + Mini App | API/Web/Telegram/Worker | `MERGE` | B topology + A internal layering. |
| API internals | Strong layered modules | Flat modules | `KEEP_A` | `domain/application/infrastructure/http` per substantial domain. |
| Web frontend | No independent full Web app | Dedicated Web app | `KEEP_B` | Separate Web shell. |
| Telegram frontend | Mature TMA shell/flows | Separate but thin Telegram app | `MERGE` | Separate Telegram app preserving A's platform behavior. |
| Canonical User | Mature but legacy fields coexist | Cleaner identity split | `MERGE` | One User with independent auth identities and normalized presentation. |
| Web auth | Partial groundwork | Working architecture, scrypt | `REBUILD` | B architecture + Argon2id + hardened sessions/CSRF/rate limits/tests. |
| Telegram auth | Mature integration | TelegramIdentity split | `MERGE` | Verified initData -> TelegramIdentity -> User. |
| `AUTH_CONFLICT` | Not central | Direction exists | `KEEP_B` | Fail closed when Web and Telegram credentials resolve to different users. |
| Public browsing | Selected anonymous reads | Explicit public/member namespace | `MERGE` | `/api/public/v1/*` for reads, `/api/v1/*` for member actions. |
| Platform Admin | Foundation exists; surface mixed | Clear global Admin direction | `MERGE` | `PLATFORM_ADMIN`, `/admin`, `/api/v1/admin/*`, AuditLog on sensitive writes. |
| HOOMA Communities | Mature behavior, bad scoped ADMIN term | Cleaner terminology direction | `REBUILD` | Preserve useful behavior; roles `FOUNDER/COACH/MEMBER`. |
| Bottom navigation | Includes Pitch | Places regression risk | `KEEP_A` | Exactly Home/Play/Watch/HOOMA/Pitch. |
| Home feature gateway | Existing quick-action artwork | Eight-card direction | `MERGE` | Exact locked 2x4 gateway using approved artwork. |
| Teams discovery/detail/update | Mature | Shallower | `KEEP_A` | Preserve mature flows. |
| Team roster | Mature add/member flows | Remove/deactivate concepts | `MERGE` | Preserve + authorized remove/deactivate. |
| Team authority | Incomplete/confused | Responsibilities + capability grants | `KEEP_B` | Coach ultimate authority, Assistant explicit grants. |
| Coach Control Room | Incomplete | Clearer direction | `MERGE` | Full Control Room, never called Admin. |
| Team lineups | Mature/wired | Model not sufficient proof | `KEEP_A` | Preserve lineups/slots and tests. |
| Team challenges | Mature lifecycle | Better authority/self-challenge direction | `MERGE` | Preserve full lifecycle + server-side self-challenge guard. |
| Challenge messages | Mature | Foundation only | `KEEP_A` | Preserve scoped conversation. |
| Team games | Mature | Simpler | `KEEP_A` | Preserve accepted-game lifecycle. |
| Events / Play | Mature | Smaller | `KEEP_A` | Preserve create/detail/RSVP/capacity/waitlist/formations/check-in/chat/completion. |
| Watch | Mature product/UI | Better canonical Place direction | `MERGE` | Keep `/watch`; link activity to canonical Place using real FKs. |
| Places | Existing useful work | Stronger canonical model | `MERGE` | One physical Place shared by capability contexts. |
| Lounge/Cafe | Not final | Direction only | `REBUILD` | Default `/places` directory, real data, owner management. |
| Place suggestion | Existing work | Moderated model | `MERGE` | Any authenticated user may suggest; moderation flow. |
| Place ownership | Claim groundwork | Explicit claim/ownership model | `MERGE` | Separate suggestion from ownership claim. |
| Pitch | Mature dedicated product | Canonical Place capability but product regression | `MERGE` | Keep `/pitch`; Places Pitch tab shares backend/data. |
| FanHub | Mature patterns | Place-centric direction | `MERGE` | Discovery only, not role/permission, no duplicate physical places. |
| Profile | Strong presentation | Better identity/responsibility foundations | `MERGE` | Preserve A UI + identities/responsibilities/My sections. |
| ULTRAS | Not independent/mature | Independent foundation | `KEEP_B` | Complete independent domain tied to canonical football entities. |
| Gamers | Missing mature domain | Independent foundation | `KEEP_B` | Complete catalog/profiles/squads/challenges/results. |
| Whistle | Missing mature engine | Substantive transient engine | `KEEP_B` | One hardened global engine with exact quota/TTL/privacy rules. |
| Requests | Mature concurrency-sensitive behavior | Simpler | `KEEP_A` | Preserve claim invariants. |
| Ride | Mature | Privacy improvements | `MERGE` | Preserve mature flows; exact location private; tracking OFF by default. |
| FundMe | Mature | Basic | `KEEP_A` | Preserve mature fundraiser/contribution flow. |
| Cash payments | Mature | Basic | `KEEP_A` | Preserve settlement lifecycle. |
| Telegram Stars | Mature runtime | Schema/foundation only | `KEEP_A` | Preserve invoices, pre-checkout, successful payment, refunds, idempotency, entitlements. |
| Media | Less complete pipeline | Strong object-storage architecture | `KEEP_B` | PostgreSQL metadata + object storage bytes + Worker processing. |
| Outbox Worker | Not central | Strong direction | `KEEP_B` | Transactional outbox, safe claiming, retries, dead-letter visibility. |
| Replay | Mature Event completion available | Replay foundation | `MERGE` | Event completion -> outbox -> Worker -> Replay. |
| HOOMA NOW | Source data exists | Read-model direction | `MERGE` | Deterministic aggregate read model only. |
| Redis | Limited | Transient architecture | `KEEP_B` | Transient state only; durable truth stays PostgreSQL. |
| Design system | Mature HOOMA visual DNA | New gateway art/direction | `MERGE` | Shared tokens/components + platform-specific shells. |
| Migrations | 11 committed migrations | Zero migration chain | `KEEP_A` | Preserve A history unchanged and extend forward only. |
| Tests | Broader suite | Tiny suite | `KEEP_A` | Port useful A tests and expand into integration/security matrix. |
| CI/release | Stronger discipline | Broken sequence | `REBUILD` | Valid four-app pipeline with migration/security/integration gates. |
| Preview Mode | No formal final system | Foundation only | `REBUILD` | MSW-only `npm run dev:preview`; production refuses it. |

## Source A migration baseline

The following deployed-history baseline must be preserved unchanged before new HOOMA ULTIMATE migrations:

1. `20260816141614_init`
2. `20260816190000_add_teams`
3. `20260818153000_add_watch_fanhub_association`
4. `20260818170000_add_places_and_owner_claims`
5. `20260819090000_add_profile_audience`
6. `20260819152000_add_pitch_listings`
7. `20260819184500_add_platform_admin_authority`
8. `20260820123500_make_telegram_user_id_optional`
9. `20260820140500_add_email_password_auth`
10. `20260820213000_add_profile_identities`
11. `20260821094000_add_profile_presentation`

No deployed migration may be edited. Production must never use `prisma db push` as its migration strategy.

## Target domain ownership

| Domain | Owns |
|---|---|
| Identity/Auth | canonical User access identities, credentials, sessions, presentation linkage |
| Platform Admin | global moderation, approvals, system actions, audit initiation |
| Communities | HOOMA community membership and scoped roles |
| Teams | Team, roster, responsibilities, grants, lineups, challenges, messages, games |
| Events | Event lifecycle, RSVP, formations, check-in, event chat |
| Places | canonical physical Place, suggestions, claims, ownership, photos |
| Pitch | Pitch application/profile/capability and directory projection |
| Watch | viewing activity/events and Watch capability use |
| ULTRAS | groups, memberships, invites, join requests, GameDay, attendance |
| Gamers | catalog, Gamer profiles/handles, squads, challenges, results |
| Whistle | context authorization, transient Redis body, metadata only in PostgreSQL |
| Requests | requests and concurrency-safe claims |
| Ride | offers, requests, matches, authorized location/rating state |
| FundMe | fundraiser/contribution domain |
| Payments | intents, provider/webhook runtime, cash settlements, Stars, entitlements |
| Media | MediaAsset lifecycle/object-storage references |
| Worker/Outbox | asynchronous processing/delivery, retry and operational handling |
| Replay | replay records/photos/projections |
| Discovery | deterministic read-model aggregation only |

## Final route baseline

### Frontend

- `/`
- `/login`
- `/register`
- `/play`
- `/events/:eventId`
- `/events/:eventId/formation`
- `/events/:eventId/chat`
- `/events/:eventId/check-in`
- `/watch`
- `/hooma`
- `/communities/:communityIdOrSlug`
- `/teams`
- `/teams/:teamId`
- `/teams/:teamId/control-room`
- `/teams/:teamId/challenge`
- `/teams/challenges/:challengeId`
- `/teams/games/:gameId`
- `/pitch`
- `/places`
- `/places/:placeId`
- `/ultras`
- `/ultras/:ultrasIdOrSlug`
- `/ultras/:ultrasIdOrSlug/hq`
- `/gamers`
- `/gamers/squads/:squadIdOrSlug`
- `/requests`
- `/rides`
- `/rides/:rideId`
- `/fundme`
- `/fundme/:fundId`
- `/profile`
- `/profiles/:username`
- `/replay/:replayId`
- `/admin`

### Public API

`/api/public/v1/*` exposes privacy-safe reads for Home/discovery, Communities, Teams, Events/Play, Watch, Pitch, Places, ULTRAS public pages, Gamers public pages/catalog, privacy-safe Requests, Ride summaries, FundMe, public Profiles, and public Replay.

### Member API

`/api/v1/*` owns authenticated actions. `/api/v1/admin/*` is reserved for `PLATFORM_ADMIN` operations.

## Locked navigation

Permanent bottom navigation is exactly:

`HOME | PLAY | WATCH | HOOMA | PITCH`

Home feature gateway is exactly:

`HOOMA | TEAMS | ULTRAS | GAMERS`  
`PLACES | REQUESTS | RIDE | FUNDME`

Places navigation is exactly:

`LOUNGES/CAFES | PITCH | FANHUB`

`LOUNGES/CAFES` is active by default on `/places`.

## Wholesale-copy regression analysis

### Copying Source A wholesale would preserve maturity but fail to solve

- scoped `ADMIN` terminology;
- separate Web and Telegram surfaces;
- normalized identity/auth architecture;
- explicit public/member API namespaces;
- independent ULTRAS and Gamers;
- final Whistle engine;
- Worker/Outbox and object-storage media architecture;
- final canonical Place capability model;
- development-only Preview Mode.

### Copying Source B wholesale would regress

- Source A migration history and Railway compatibility;
- mature Team lineups/challenges/messages/games;
- mature Event formations/check-in/chat flows;
- mature Cash/Telegram Stars payments;
- dedicated Pitch product/bottom-nav contract;
- Telegram-specific shell behavior;
- test depth and release discipline;
- Argon2id requirement;
- honest feature completeness;
- real Whistle notification delivery.

## Forward migration strategy

1. Import Source A migrations unchanged.
2. Extend them only with forward migrations.
3. Add normalized auth/identity structures and backfill existing rows before dropping any legacy fields.
4. Normalize scoped authority and backfill Team/community responsibilities.
5. Normalize canonical Place relationships and capability profiles with auditable backfills.
6. Add ULTRAS and Gamers independently.
7. Add hardened Whistle metadata, Outbox, MediaAsset, Replay and operational tables.
8. Keep compatibility reads/writes only while necessary during migration.
9. Remove deprecated structures only after read-back, tests, representative upgrade verification and cutover evidence.

A database built from zero and an upgraded representative Source A database must converge to the same final schema.

## Implementation order

1. workspace/tooling/CI skeleton;
2. Source A migration baseline + schema verification;
3. config/contracts/database/error/logging foundation;
4. canonical User + Web/Telegram auth + public/member routers;
5. Platform Admin + AuditLog;
6. Profile identities/responsibilities;
7. Communities role normalization;
8. mature Teams port + Coach/Assistant model;
9. mature Events/Play port;
10. canonical Places + Lounge/Cafe + Pitch/Watch/FanHub integration;
11. Requests/Ride/FundMe + mature payments;
12. ULTRAS;
13. Gamers;
14. Whistle + Worker notification delivery;
15. Media/Outbox/Replay;
16. HOOMA NOW/discovery;
17. Preview Mode and cross-app polish;
18. full migration rehearsal/integration/deploy verification.

This audit is a baseline, not a claim that target implementation exists. Amend it whenever deeper source tracing changes a decision.
