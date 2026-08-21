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

New product domains are frozen until the normalization final gate passes.

---

## Current overall state

| Area | Overall | Evidence / blocker |
|---|---|---|
| Planning / architecture baseline | `DONE` | Root `structure.md`, root `requirements.md`, active ADRs, canonical model and normalization plan define the target. |
| Greenfield monorepo foundation | `IN_PROGRESS` | Four-app/eight-package topology exists and dependency-boundary checks exist. Lockfile/CI/frontend structure still require normalization and full clean verification. |
| Fresh database foundation | `BLOCKED` | Prisma schema and pre-release migration history currently disagree in Team fields/constraints. Must be reconciled and replaced by one clean reviewed initial migration before release. |
| Identity / authentication | `IN_PROGRESS` | Layered Web + Telegram identity, Argon2id, hashed sessions and `AUTH_CONFLICT` paths exist. Full dependency-backed/real-PostgreSQL verification and production abuse/origin hardening remain. |
| Platform Admin / audit | `IN_PROGRESS` | Separate `PLATFORM_ADMIN`, audit foundation, operator grant command and Web Admin shell exist. Must be verified after schema/migration normalization. |
| Communities | `IN_PROGRESS` | Layered Community service/repository exists with Founder/Coach/Member concept and Coach appointment flow. Persistence/constraints must be reconciled to canonical model and integration-tested. |
| Teams | `BLOCKED` | Significant Team backend/UI behavior exists, but schema/migration/repository vocabulary and authorization boundaries are inconsistent. Normalization Stages B–C are required before further Team feature work. |
| Events / Play | `IN_PROGRESS` | PLAY discovery/create/RSVP/waitlist/formation/check-in/chat/completion backend and Web surfaces exist. Must block WATCH creation, reconcile schema/migration and complete temporary-chat cleanup ownership. |
| Web application structure | `BLOCKED` | Current manual `window.location.pathname` routing and flat feature layout violate target structure. Must normalize to app/router/providers/shell + feature/page/shared layout with lazy routes. |
| Telegram application structure | `IN_PROGRESS` | Telegram auth/bootstrap shell exists, but target router/provider/safe-area/BackButton/platform shell structure is not complete. |
| Worker / outbox | `IN_PROGRESS` | Foundation exists; no complete async domain handlers yet. Event-chat cleanup is a required current normalization responsibility. |
| CI / release pipeline | `BLOCKED` | Current foundation CI can regenerate/commit/push package-lock. This violates read-only verification. Real lockfile + read-only CI required. |
| Railway | `IN_PROGRESS` | Fresh PostgreSQL and app service exist with database + Telegram variable names. Application deployment remains gated by normalization and clean migration verification. |

---

## Frozen future domains

These remain `NOT_STARTED` and must not receive implementation code during normalization:

```text
Canonical Places
Watch / FanHub
Pitch
ULTRAS
Gamers
Whistle
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

Planning/reference documents and approved assets may exist for them; that does not make them implemented.

---

## Feature ledger

Legend: `NS` = not started, `IP` = in progress, `BL` = blocked, `DN` = done, `N/A` = not applicable.

| Feature | Overall | DB | Backend | Authz | Public API | Member API | Web | Telegram | Worker | Tests | Migration | Deployment | Verification |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Workspace/monorepo foundation | `IN_PROGRESS` | N/A | IP | IP | N/A | N/A | BL | IP | IP | IP | N/A | BL | IP |
| Canonical User/identity model | `IN_PROGRESS` | IP | IP | IP | N/A | IP | IP | IP | N/A | IP | BL | BL | IP |
| Web authentication | `IN_PROGRESS` | IP | IP | IP | IP | IP | IP | N/A | N/A | IP | BL | BL | IP |
| Telegram authentication | `IN_PROGRESS` | IP | IP | IP | N/A | IP | N/A | IP | N/A | IP | BL | BL | IP |
| Public/member API boundary | `IN_PROGRESS` | N/A | IP | IP | IP | IP | IP | IP | N/A | IP | N/A | BL | IP |
| Platform Admin + AuditLog | `IN_PROGRESS` | IP | IP | IP | N/A | IP | IP | N/A | N/A | IP | BL | BL | IP |
| Profile presentation/identities | `IN_PROGRESS` | IP | IP | IP | IP | IP | IP | IP | N/A | IP | BL | BL | IP |
| Profile memberships/responsibilities | `IN_PROGRESS` | IP | IP | IP | IP | IP | IP | IP | N/A | IP | BL | BL | IP |
| HOOMA Communities | `IN_PROGRESS` | BL | IP | IP | IP | IP | IP | NS | N/A | IP | BL | BL | BL |
| Teams discovery/detail/update | `BLOCKED` | BL | IP | IP | IP | IP | IP | NS | N/A | IP | BL | BL | BL |
| Team roster | `BLOCKED` | BL | IP | IP | IP | IP | IP | NS | N/A | IP | BL | BL | BL |
| Coach/Assistant responsibilities | `BLOCKED` | BL | IP | BL | N/A | IP | IP | NS | N/A | IP | BL | BL | BL |
| Coach Control Room | `IN_PROGRESS` | N/A | IP | BL | N/A | IP | IP | NS | N/A | IP | N/A | BL | BL |
| Team lineups | `BLOCKED` | BL | IP | IP | IP | IP | IP | NS | N/A | IP | BL | BL | BL |
| Team challenges/messages/games | `BLOCKED` | BL | IP | BL | IP | IP | IP | NS | N/A | IP | BL | BL | BL |
| Events/Play | `IN_PROGRESS` | BL | IP | IP | IP | IP | IP | NS | IP | IP | BL | BL | BL |
| Canonical Places | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | N/A | NS | NS | NS | NS |
| Watch / FanHub | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS |
| Pitch | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | N/A | NS | NS | NS | NS |
| ULTRAS | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS |
| Gamers | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS |
| Whistle | `NOT_STARTED` | NS | NS | NS | N/A | NS | NS | NS | NS | NS | NS | NS | NS |
| Requests | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | N/A | NS | NS | NS | NS |
| Ride | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS |
| FundMe | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | N/A | NS | NS | NS | NS |
| Cash payments | `NOT_STARTED` | NS | NS | NS | N/A | NS | NS | NS | NS | NS | NS | NS | NS |
| Telegram Stars | `NOT_STARTED` | NS | NS | NS | N/A | NS | NS | NS | NS | NS | NS | NS | NS |
| Media | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS |
| Outbox Worker | `IN_PROGRESS` | IP | NS | N/A | N/A | N/A | N/A | N/A | IP | NS | BL | BL | IP |
| Replay | `NOT_STARTED` | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS | NS |
| HOOMA NOW/discovery | `NOT_STARTED` | N/A | NS | NS | NS | N/A | NS | NS | N/A | NS | N/A | NS | NS |
| Preview Mode | `NOT_STARTED` | N/A | N/A | N/A | N/A | N/A | NS | NS | N/A | NS | N/A | NS | NS |
| CI/release pipeline | `BLOCKED` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | IP | BL | BL | BL |
| Clean initial-migration verification | `BLOCKED` | BL | N/A | N/A | N/A | N/A | N/A | N/A | N/A | BL | BL | N/A | BL |
| Legacy donor-data import | `NOT_STARTED` | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

---

## Known normalization blockers

### Database/schema

- TeamPlayer multiplicity/linkage must be corrected.
- Team responsibility timestamps/compound constraints disagree across schema/migration/repository.
- Team capability grant fields/constraints disagree across schema/migration/repository.
- Team lineup schema/migration/repository/UI representation disagree.
- Team/Community V1 active cardinality must be explicitly enforced.
- Challenge DB constraints must enforce self-challenge and duplicate-pending-pair invariants.
- Pre-release migration chain must be replaced by one reviewed initial migration after source reconciliation.

### Authorization

- Assistant challenge/message access is currently too broad in paths relying on generic managed-Team resolution.
- Leader coordination must be accepted-challenge-only.

### Events

- current contract/service boundary must reject WATCH creation until Watch exists;
- temporary Event-chat cleanup still lacks implemented Worker ownership.

### Frontend

- Web manual pathname switch must be replaced by structured router + lazy pages;
- Web/Telegram folders must be normalized to target app/features/pages/shared organization;
- current Coach Control Room raw-ID controls are functional scaffolding, not final management UX.

### Tooling/release

- target `package-lock.json` must be generated and committed;
- CI lockfile self-repair/write permissions must be removed;
- full clean-install/typecheck/build/integration/migration verification remains pending.

---

## Verification rule

Never promote a row to `DONE` until all applicable layers are present and the relevant real commands/tests have passed.

The normalization completion gate is defined in `docs/NORMALIZATION_PLAN.md`.
