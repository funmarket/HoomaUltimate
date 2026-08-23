# HOOMA ULTIMATE — Implementation Status

Status: **Live implementation ledger**

This file reports only work present in `funmarket/HoomaUltimate` and verification actually completed against it.

Allowed states:

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

No percentages. `DONE` requires verified production vertical-slice evidence. A schema, route, page, donor implementation, mock, static source inspection or successful isolated command is not completion by itself.

---

## Current repository phase

**FOUNDATION NORMALIZATION — ACTIVE**

Authoritative execution queue:

```text
docs/NORMALIZATION_PLAN.md
```

Canonical current-domain model:

```text
docs/CANONICAL_MODEL.md
```

New product domains remain frozen until the normalization final gate passes **except Whistle**, which the product owner explicitly unfroze in ADR-039 on 2026-08-23. That exception is scoped to the shared Whistle vertical slice and does not unfreeze any other future domain.

---

## Current overall state

| Area | Overall | Evidence / blocker |
|---|---|---|
| Planning / architecture baseline | `DONE` | Root `structure.md`, root `requirements.md`, active ADRs, canonical model and normalization plan define the target. |
| Greenfield monorepo foundation | `IN_PROGRESS` | Four-app/eight-package topology exists and dependency-boundary checks exist. Full clean verification remains required. |
| Fresh database foundation | `BLOCKED` | The pre-release migration chain still has to be reconciled into the planned clean reviewed initial migration before first release. |
| Identity / authentication | `IN_PROGRESS` | Layered Web + Telegram identity, Argon2id, hashed sessions and `AUTH_CONFLICT` paths exist. Full dependency-backed/real-PostgreSQL verification remains part of the normalization gate. |
| Platform Admin / audit | `IN_PROGRESS` | Separate `PLATFORM_ADMIN`, audit foundation, operator grant command and Web Admin shell exist. Must be fully verified with the normalized migration. |
| Communities | `IN_PROGRESS` | Layered Community service/repository exists with Founder/Coach/Member authority and Coach appointment flow. Full normalization/integration evidence remains. |
| Teams | `BLOCKED` | Significant Team backend/UI behavior exists, but remaining schema/migration/authorization normalization work must finish before more Team scope is added. |
| Events / Play | `IN_PROGRESS` | PLAY discovery/create/RSVP/waitlist/formation/check-in/chat/completion backend and Web surfaces exist. Legacy temporary Event Chat remains separate from Whistle until its own cleanup/removal slice. |
| Whistle | `IN_PROGRESS` | ADR-039 authorizes the shared slice. Metadata-only PostgreSQL persistence, Redis body/reveal state, global quota service, authenticated Community routes, private HOOMA board and real PostgreSQL+Redis integration coverage are present. Community is the only enabled context; full current-head CI/runtime verification is still required before `DONE`. |
| Web application structure | `IN_PROGRESS` | Shared HOOMA router/shell work exists; normalization remains active and full route/build verification is still required. |
| Telegram application structure | `IN_PROGRESS` | Telegram uses the shared HOOMA frontend entry with Telegram runtime/auth behavior; platform-specific normalization/verification remains active. |
| Worker / outbox | `IN_PROGRESS` | Foundation exists; no complete async domain handlers yet. Legacy Event-chat cleanup remains a required current normalization responsibility. |
| CI / release pipeline | `IN_PROGRESS` | CI source is now read-only: no `contents: write`, lockfile self-repair, commit or push. It includes `db:migrate:status` plus disposable PostgreSQL/Redis. A fully green untouched-checkout chain is still required. |
| Railway | `IN_PROGRESS` | PostgreSQL, API, Web, Telegram and private HOOMA Redis services exist. The Whistle-capable API/Web/Telegram deployment at commit `c6294d0c4410b35c49ae39a0a3baead1827f0b19` succeeded; newer recovery commits still require their own verification. |

---

## Frozen future domains

These remain `NOT_STARTED` and must not receive implementation code during normalization unless a newer explicit product-owner decision records another scoped exception:

```text
Canonical Places
Watch / FanHub
Pitch
ULTRAS
Gamers
Requests
Ride
FundMe
Cash Payments
Telegram Stars
Media
Replay
HOOMA NOW / discovery
Preview Mode
```

Whistle is intentionally absent from this list because ADR-039 explicitly unfreezes it. Event, Team, Ride, ULTRAS and Gamer Squad Whistle contexts remain disabled until their own context-specific authorization slices are opened.

Planning/reference documents and approved assets may exist for frozen domains; that does not make them implemented.

---

## Feature ledger

Legend: `NS` = not started, `IP` = in progress, `BL` = blocked, `DN` = done, `N/A` = not applicable.

| Feature | Overall | DB | Backend | Authz | Public API | Member API | Web | Telegram | Worker | Tests | Migration | Deployment | Verification |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Workspace/monorepo foundation | `IN_PROGRESS` | N/A | IP | IP | N/A | N/A | IP | IP | IP | IP | N/A | IP | IP |
| Canonical User/identity model | `IN_PROGRESS` | IP | IP | IP | N/A | IP | IP | IP | N/A | IP | BL | IP | IP |
| Web authentication | `IN_PROGRESS` | IP | IP | IP | IP | IP | IP | N/A | N/A | IP | BL | IP | IP |
| Telegram authentication | `IN_PROGRESS` | IP | IP | IP | N/A | IP | N/A | IP | N/A | IP | BL | IP | IP |
| Public/member API boundary | `IN_PROGRESS` | N/A | IP | IP | IP | IP | IP | IP | N/A | IP | N/A | IP | IP |
| Platform Admin + AuditLog | `IN_PROGRESS` | IP | IP | IP | N/A | IP | IP | N/A | N/A | IP | BL | IP | IP |
| Profile presentation/identities | `IN_PROGRESS` | IP | IP | IP | IP | IP | IP | IP | N/A | IP | BL | IP | IP |
| Profile memberships/responsibilities | `IN_PROGRESS` | IP | IP | IP | IP | IP | IP | IP | N/A | IP | BL | IP | IP |
| HOOMA Communities | `IN_PROGRESS` | IP | IP | IP | IP | IP | IP | IP | N/A | IP | BL | IP | IP |
| Teams discovery/detail/update | `BLOCKED` | BL | IP | IP | IP | IP | IP | IP | N/A | IP | BL | IP | BL |
| Team roster | `BLOCKED` | BL | IP | IP | IP | IP | IP | IP | N/A | IP | BL | IP | BL |
| Coach/Assistant responsibilities | `BLOCKED` | BL | IP | BL | N/A | IP | IP | IP | N/A | IP | BL | IP | BL |
| Coach Control Room | `IN_PROGRESS` | N/A | IP | BL | N/A | IP | IP | IP | N/A | IP | N/A | IP | BL |
| Team lineups | `BLOCKED` | BL | IP | IP | IP | IP | IP | IP | N/A | IP | BL | IP | BL |
| Team challenges/messages/games | `BLOCKED` | BL | IP | BL | IP | IP | IP | IP | N/A | IP | BL | IP | BL |
| Events/Play | `IN_PROGRESS` | IP | IP | IP | IP | IP | IP | IP | IP | IP | BL | IP | IP |
| Whistle — shared engine + Community board | `IN_PROGRESS` | IP | IP | IP | N/A | IP | IP | IP | N/A | IP | IP | IP | IP |
| Canonical Places | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | N/A | NS | NS | NS | NS |
| Watch / FanHub | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS |
| Pitch | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | N/A | NS | NS | NS | NS |
| ULTRAS | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS |
| Gamers | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS |
| Requests | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | N/A | NS | NS | NS | NS |
| Ride | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS |
| FundMe | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | N/A | NS | NS | NS | NS |
| Cash payments | `NOT_STARTED` | NS | NS | NS | N/A | NS | NS | NS | NS | NS | NS | NS | NS |
| Telegram Stars | `NOT_STARTED` | NS | NS | NS | N/A | NS | NS | NS | NS | NS | NS | NS | NS |
| Media | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS |
| Outbox Worker | `IN_PROGRESS` | IP | NS | N/A | N/A | N/A | N/A | N/A | IP | NS | BL | IP | IP |
| Replay | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS |
| HOOMA NOW/discovery | `NOT_STARTED` | N/A | NS | NS | NS | N/A | NS | NS | N/A | NS | N/A | NS | NS |
| Preview Mode | `NOT_STARTED` | N/A | N/A | N/A | N/A | N/A | NS | NS | N/A | NS | N/A | NS | NS |
| CI/release pipeline | `IN_PROGRESS` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | IP | BL | IP | IP |
| Clean initial-migration verification | `BLOCKED` | BL | N/A | N/A | N/A | N/A | N/A | N/A | N/A | BL | BL | N/A | BL |
| Legacy donor-data import | `NOT_STARTED` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

---

## Whistle current evidence

Current implemented slice:

- one shared Whistle service/repository/store architecture;
- PostgreSQL `WhistleMetadata` contains metadata/quota fields only and no body;
- Redis stores bodies for 24 hours and per-viewer reveal/seen keys;
- authoritative length validation uses Unicode grapheme clusters, maximum 33;
- PostgreSQL transaction + advisory lock enforces 11 sends per user per UTC day across contexts;
- repeat reveal returns the remaining Redis PTTL and does not restart the first 60-second window;
- authenticated `/api/v1/whistles/*` routes are mounted once;
- Community context authorization requires active membership;
- other Whistle contexts return explicit not-enabled errors;
- private HOOMA Community Whistle Board is connected to the shared frontend API client;
- real integration coverage includes outsider denial, Redis TTL, metadata-only persistence, outbox body absence, quota race, reveal expiry/non-extension, and complex Unicode grapheme limits;
- Railway private `HOOMA Redis` exists and the API has `REDIS_URL` configured.

Still required before `DONE`:

- fully green CI/integration evidence for the current recovery head;
- focused live read/write/reveal smoke verification after that deployment;
- final migration normalization must preserve the reviewed Whistle metadata model without creating body persistence;
- later Event/Team/ULTRAS/Gamer contexts remain separate future authorization slices and are not implied complete by the shared engine.

---

## Known normalization blockers

### Database/schema

- remaining Team/schema normalization must be finished;
- Team/Community V1 active cardinality and challenge invariants require final clean-migration review;
- the pre-release migration chain must still be replaced by one reviewed initial migration after current source reconciliation;
- the clean initial migration must include Whistle metadata only and must not persist Whistle bodies.

### Authorization

- remaining Team Assistant challenge/message paths require capability-specific verification;
- leader coordination must remain accepted-challenge-only;
- only Community Whistle authorization is currently enabled; other Whistle contexts stay closed.

### Events

- unsupported WATCH creation remains blocked until Watch exists;
- legacy temporary Event-chat cleanup still lacks completed Worker ownership;
- Event Chat is not Whistle and must not be renamed/reused as Whistle storage.

### Tooling/release

- CI is now read-only and the committed lockfile is verification input rather than something CI repairs;
- full untouched-checkout CI, integration, security and migration-status evidence remains required;
- the final normalized single initial migration remains a release gate.

---

## Verification rule

Never promote a row to `DONE` until all applicable layers are present and the relevant real commands/tests have passed.

The normalization completion gate is defined in `docs/NORMALIZATION_PLAN.md`.
