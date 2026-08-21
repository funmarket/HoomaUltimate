# HOOMA ULTIMATE — Architectural Decisions

Status: **Active ADR index**

## ADR-001 — Build a third clean repository

**Decision:** `funmarket/HoomaUltimate` is the only implementation destination. Source A and Source B remain read-only references.

**Reason:** Neither source alone satisfies the final product. Source A is mature but carries role/architecture gaps; Source B improves architecture but regresses mature features and migrations.

## ADR-002 — Source precedence is explicit

**Decision:** Directive/latest product decision beats source code. Verified Source A maturity beats Source B simplification when no newer rule overrides it.

**Reason:** Prevent accidental regression caused by treating “newer” as automatically better.

## ADR-003 — Use B's multi-app topology and A's domain layering

**Decision:** Target runtime apps are API, Web, Telegram and Worker. Substantial API domains use `domain/application/infrastructure/http` layering.

**Reason:** This combines deployment/platform separation with mature backend boundaries.

## ADR-004 — One canonical User, two independent authentication transports

**Decision:** TelegramIdentity and WebCredential/WebSession independently resolve to one User. No heuristic auto-linking.

**Reason:** Prevent identity collision and accidental account takeover.

## ADR-005 — Use Argon2id for Web passwords

**Decision:** Do not carry Source B scrypt into the final implementation.

**Reason:** Argon2id is the locked product/security requirement.

## ADR-006 — Fail closed on credential conflict

**Decision:** Valid Telegram -> User A plus valid Web -> User B returns `AUTH_CONFLICT`.

**Reason:** Never silently choose a principal when two authenticated identities disagree.

## ADR-007 — Public browsing is a first-class API boundary

**Decision:** Public reads live under `/api/public/v1/*`; member/private actions under `/api/v1/*`.

**Reason:** Discovery is public, while authentication is action-based. This boundary is easier to audit/test.

## ADR-008 — ADMIN is global only

**Decision:** Only `PLATFORM_ADMIN` uses Admin terminology. Scoped domains use Founder/Coach/Assistant/Leader/Moderator/Member/Owner language.

**Reason:** Authority must match product language and avoid the Source A Community Admin confusion.

## ADR-009 — HOOMA ULTIMATE owns a fresh migration history

**Decision:** HOOMA ULTIMATE starts from its own clean target schema and its own initial committed migration. Source A and Source B migration histories are reference evidence only and are not imported as the target application migration chain.

**Reason:** This repository is a third greenfield application, not an upgrade of either donor. We keep the discipline of committed forward migrations without inheriting historical donor schema compromises.

## ADR-010 — Canonical Place is the physical-location source of truth

**Decision:** Lounge/Cafe, Pitch, Watch, FanHub and Ride contexts reference one physical Place.

**Reason:** Prevent duplicate venue records and contradictory ownership/location data.

## ADR-011 — Pitch remains a dedicated product

**Decision:** `/pitch` remains permanent and in bottom nav. Places Pitch tab is a second surface over the same `Place + PitchProfile` backend/data.

**Reason:** Preserve mature Source A product behavior while adopting canonical Places.

## ADR-012 — Preserve mature Teams and add scoped capabilities

**Decision:** Port Source A lineups/challenges/messages/games and integrate Source B Coach/Assistant responsibility/capability model.

**Reason:** Neither source is complete alone.

## ADR-013 — Coach Control Room replaces scoped Admin language

**Decision:** Team management is called Coach Control Room. Assistant authority is explicit capabilities, not broad role inheritance.

**Reason:** Matches product language and principle of least privilege.

## ADR-014 — Preserve mature Event/Play implementation

**Decision:** Source A Event creation/detail/RSVP/capacity/waitlist/formations/check-in/chat/completion is the baseline. Replay/Worker are integrated around it.

**Reason:** Source B's smaller Event slice is a regression.

## ADR-015 — Preserve mature payment runtime

**Decision:** Source A Cash and Telegram Stars runtime is the baseline. Re-architect without removing provider/webhook/refund/idempotency/entitlement behavior.

**Reason:** Source B's payment model is not a substitute for working runtime.

## ADR-016 — ULTRAS is independent

**Decision:** ULTRAS has its own persistent domain and roles; it is not Team tables or generic Community renamed.

**Reason:** Product semantics and privacy differ.

## ADR-017 — Gamers is independent

**Decision:** Gamer profiles/squads/challenges/results use independent models, not Team tables.

**Reason:** Avoid cross-domain coupling and incorrect football-Team semantics.

## ADR-018 — One global Whistle engine

**Decision:** One transient engine serves approved contexts. Body only in Redis, metadata only in PostgreSQL, exact 33/11/24h/60s rules.

**Reason:** Prevent duplicate messaging systems and permanent-body leaks.

## ADR-019 — PostgreSQL durable, Redis transient, object storage bytes

**Decision:** Persistent business truth stays in PostgreSQL. Redis is disposable transient infrastructure. Media bytes live in S3-compatible storage.

**Reason:** Clear failure and retention semantics.

## ADR-020 — Use transactional outbox for asynchronous work

**Decision:** Durable mutation and OutboxEvent commit together; Worker claims safely and retries without duplicating policy.

**Reason:** Avoid lost async work and inconsistent side effects.

## ADR-021 — Separate frontend shells, share feature UI selectively

**Decision:** Web and Telegram share contracts/design tokens/feature components where appropriate but maintain independent platform shells.

**Reason:** Telegram needs BackButton, viewport, safe-area, theme, haptics and initData behavior that Web does not.

## ADR-022 — Rebuild CI rather than copy V3

**Decision:** CI uses a valid dependency/prisma/migration/architecture/format/lint/typecheck/test/build/preflight order.

**Reason:** V3's checked-in pipeline has known sequencing defects.

## ADR-023 — Integration tests use real disposable PostgreSQL and Redis

**Decision:** Critical persistence/concurrency/TTL/worker behavior is not proven by mocks alone.

**Reason:** Whistle quota/TTL, migrations, outbox locking and transactional behavior require real infrastructure semantics.

## ADR-024 — Preview Mode is frontend-isolated and development-only

**Decision:** `npm run dev:preview` uses MSW or equivalent. Production backend auth never contains fake-user bypasses and production build rejects Preview Mode.

**Reason:** Enable UI review without creating a security backdoor or fake production persistence.

## ADR-025 — Feature completion is vertical-slice evidence

**Decision:** Schema/page/endpoint existence is insufficient. DONE requires migration through runtime verification.

**Reason:** Prevent Source B-style schema-only completion claims and dead shells.

## ADR-026 — Locked navigation contracts

**Decision:** Bottom nav = Home/Play/Watch/HOOMA/Pitch. Home gateway = HOOMA/Teams/ULTRAS/Gamers + Places/Requests/Ride/FundMe. Places tabs = Lounges/Cafes/Pitch/FanHub with Lounges/Cafes default.

**Reason:** These are explicit product-owner acceptance rules and cannot drift during architecture work.

## ADR-027 — Donor data import is separate from application migrations

**Decision:** The HOOMA ULTIMATE database starts clean. If historical data from a donor application is ever brought into HOOMA ULTIMATE, it must be handled by an explicit import/ETL and reconciliation process, not by redefining the target application as a migration of the donor schema.

**Reason:** Product architecture and migration history must remain greenfield even if a later business decision chooses to import historical records.