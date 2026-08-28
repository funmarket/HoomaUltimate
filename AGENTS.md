# HOOMA — AGENT RULES

Status: **MANDATORY REPOSITORY INSTRUCTIONS**

These rules apply to every AI agent, developer, automation, and coding session working in `funmarket/HoomaUltimate`.

`HoomaUltimate` is the repository/workspace name only. The product is **HOOMA**. Do not introduce “HOOMA ULTIMATE” as application branding, UI copy, API branding, or product terminology.

Before changing anything, read this file and `docs/LIVING_BUILD_PLAN.md`. For product and architecture truth, read the relevant parts of `structure.md`, `requirements.md`, `docs/CANONICAL_MODEL.md`, and `docs/DECISIONS.md`.

The retired files `docs/NORMALIZATION_PLAN.md` and `docs/IMPLEMENTATION_STATUS.md` must not be recreated or treated as active governance unless the product owner explicitly asks for them again.

---

## 1. Source-of-truth order

When sources disagree, use this order:

1. the product owner's latest explicit instruction;
2. locked product behavior in `requirements.md`;
3. architecture in `structure.md`;
4. current architectural decisions in `docs/DECISIONS.md`;
5. current data/authority contracts in `docs/CANONICAL_MODEL.md`;
6. the actual repository/database/runtime as evidence of **current state**, never as permission to override a newer target rule.

`AGENTS.md` and `docs/LIVING_BUILD_PLAN.md` govern **how work is performed**. They do not invent product requirements.

If a contradiction cannot be resolved from these sources, **stop and report it**. Do not guess.

---

## 2. Mandatory pre-build gate

Before the first edit of every task:

1. Confirm repository and branch. Do not work in another HOOMA repository by accident.
2. Record the current branch HEAD SHA.
3. Read the relevant governing sources listed above.
4. Trace the issue from its actual source through every applicable layer.
5. Search for existing implementations, routes, services, repositories, models, components, hooks, stores, styles, tests, migrations, scripts, and documentation before creating anything new.
6. Identify the authoritative source that should change.
7. Check whether the branch moved while tracing. If it did, inspect the incoming changes before writing.
8. Define a narrow task boundary. Work one issue at a time unless the product owner explicitly asks for parallel scope.
9. Identify which living documents are affected by the task and must be updated before the task can be reported complete.

No edit is allowed merely because a symptom is visible in the frontend.

---

## 3. Trace from source, not from symptoms

For backend/data behavior, inspect the applicable chain:

`UI / client -> contract -> HTTP route -> auth/authz -> application service/domain policy -> repository port -> infrastructure repository -> Prisma schema/migration -> PostgreSQL/Redis/storage -> Railway runtime/config`

For UI behavior, inspect the applicable chain:

`data/state -> trigger/lifecycle -> component -> parent/layout hierarchy -> shared component/hook/provider -> CSS/layout/positioning -> responsive/mobile/Telegram behavior`

For authentication, inspect Web and Telegram transports separately while preserving one canonical HOOMA User.

For production defects, source inspection alone may be insufficient. Inspect real logs, environment configuration, database state, or deployment evidence when they are relevant and available.

---

## 4. Root-cause rules

Mandatory:

- Fix the authoritative source, not a downstream symptom.
- No patching around broken architecture.
- No arbitrary z-index escalation, hardcoded offsets, duplicate state, duplicate API clients, duplicate role systems, duplicate tables, or shadow models to make a symptom disappear.
- No silent compatibility layer for a pre-release mistake unless the product owner explicitly requires backward compatibility.
- No fake or partial implementation may be presented as complete.
- No production mock data.
- No guessed IDs, dates, places, users, roles, URLs, credentials, or business state.
- No hardcoded secrets, Telegram bot credentials, database credentials, or environment-specific service URLs when configuration belongs in environment variables.
- No frontend-only authorization for protected behavior.
- No direct production-database patch used as a substitute for a correct migration/source fix.
- Do not use `prisma db push` as a substitute for governed migration work.
- CI verifies the repository; CI must not commit, push, or repair source files.
- Use permanent regression tests in the existing test structure. Do not create disposable `test.ts`/scratch test files and leave them behind.

When a shared component/service/domain is the source, fix it there instead of overriding every consumer.

---

## 5. Domain, scalability, and dependency discipline

Every durable product concept must have one clean canonical domain. Domain ownership is an operational scalability rule, not just a folder preference: clean boundaries keep queries, transactions, caches, authorization, frontend state, deployment work, and future scaling independently understandable as HOOMA grows to many users.

Mandatory:

- One authoritative owner per concept.
- Reuse existing domain services and shared resources instead of creating parallel implementations.
- Preserve explicit one-way dependency direction and avoid circular dependencies.
- A lower-level canonical domain must not import a higher-level product domain merely to make one workflow convenient.
- Cross-domain workflows use explicit application ports/orchestrators while the owning domain retains its own business and persistence authority.
- Keep HTTP/transport concerns out of domain/application policy.
- Keep Prisma/database-specific behavior in infrastructure/repository boundaries.
- Keep authorization server-side and capability-specific.
- Keep PostgreSQL as durable business truth, Redis as transient infrastructure where designed, and object storage for media bytes.
- Never persist Whistle body content in PostgreSQL, logs, analytics, audit metadata, outbox payloads, notifications, URLs, or query strings.
- Global App Admin is `PLATFORM_ADMIN`; scoped Team/Community/product roles must not be renamed to generic Admin.
- Public browsing stays public where product rules require it; authentication belongs at protected-action/private-data boundaries.

### No monolithic authorities

Do **not** create or expand monolithic files, scripts, services, repositories, clients, contracts, state stores, controllers, components, or catch-all modules that own unrelated domains.

Examples of forbidden direction include:

- one contract file that becomes the authority for Places + Pitch + Platform Admin + another product;
- one application service that mixes public reads, owner writes, moderation, unrelated domain policy, and persistence orchestration;
- one repository that becomes the persistence owner for unrelated domain tables merely because the tables are relationally connected;
- one frontend API client/store that becomes the gateway for unrelated products;
- one large migration/repair/normalization script that changes several independent domains at once;
- a generic `shared`, `common`, `management`, `platform`, or `utils` module used to hide unclear ownership.

A script must be single-purpose and bounded. A domain may share genuinely generic primitives, but shared code must not become a second business owner or a dumping ground.

When a file/module is growing across multiple domain responsibilities, stop and identify the owning domains before adding more code. Split by ownership at the authoritative boundary instead of adding another conditional branch to the catch-all.

Performance and user experience must be considered at the domain boundary. Avoid architectures that force unrelated data to load, validate, lock, cache, or rerender together when the user only needs one product flow.

Original/live HOOMA is a **read-only donor/reference**. Learn from its behavior or visuals when useful, but never wire its runtime, data, auth, routes, schema, or architecture into this repository.

---

## 6. Parallel-agent / concurrency boundary

Unless the product owner explicitly instructs otherwise, **never interfere with another agent's active work**.

That means:

- Do not revert, delete, “clean up,” rename, move, or rewrite another agent's files because you disagree with the direction.
- Do not fight another writer by repeatedly re-applying changes.
- Do not force-push, hard-reset, or move a shared branch backward.
- Do not overwrite a non-fast-forward update.
- Do not modify unrelated files while “already in the area.”
- Do not adopt another agent's task without being asked.

If HEAD changes after your initial snapshot:

1. stop the write;
2. fetch the new HEAD;
3. inspect the incoming commit/diff;
4. determine whether it overlaps your task/files;
5. if it overlaps or ownership is unclear, stop and report the conflict;
6. if it is clearly unrelated, rebuild your change on the new HEAD without altering the incoming work.

A non-fast-forward rejection is a safety signal, not a reason to force the update.

---

## 7. Change discipline and living documentation

Every implementation should be the smallest complete source-level change that solves the assigned issue.

Before adding a new file/model/endpoint/store/component/script, prove an equivalent authoritative implementation does not already exist.

When changing schema or contracts, inspect and reconcile all consumers. When changing a shared API, inspect Web and Telegram consumers. When changing authorization, inspect every route/service path that uses the affected policy.

Do not opportunistically refactor unrelated code in the same task.

Documentation is part of the implementation and must stay alive with the source. **Every task must audit and update the documents affected by that task before completion.** A task that changes product behavior, architecture, canonical data ownership, migrations, runtime topology, routes, authorization, or implementation state is not complete while its governing documentation still describes the old state.

Use the existing authoritative document for the subject instead of creating a new overlapping status/architecture file:

- product behavior -> `requirements.md`;
- repository/domain architecture -> `structure.md`;
- canonical data/authority -> `docs/CANONICAL_MODEL.md`;
- architectural decisions -> `docs/DECISIONS.md` and a dedicated ADR only when useful;
- execution discipline -> `AGENTS.md` / `docs/LIVING_BUILD_PLAN.md`;
- current implementation history/evidence -> `progress.md` and scoped audit documents where already established.

Do not duplicate an authoritative document just to record the same truth in another place. If an older document duplicates a newer authority, convert it to an explicit reference/retired pointer or update it so it cannot contradict the canonical source.

Documentation updates must describe **merged/current truth** separately from **in-flight PR work**. An open PR is not current foundation truth until merged.

---

## 8. Verification is part of the implementation

Run the strongest relevant verification available for the changed slice. Depending on scope, this can include:

- typecheck/build;
- focused unit/regression tests;
- real PostgreSQL integration tests;
- real Redis integration tests;
- migration validate/status/deploy against disposable or intended infrastructure;
- API read-back;
- Web/Telegram route behavior;
- Railway build/deploy/health/log evidence;
- production smoke verification when explicitly appropriate and safe;
- documentation/source consistency review for the changed domain.

Never say “fixed,” “working,” “deployed,” “complete,” or “DONE” beyond what the evidence proves.

If a check cannot be run, state exactly what remains unverified.

---

## 9. Mandatory completion report

Every finished task report must include:

- **Issue / root cause** — what was actually wrong.
- **Source trace** — which layers were inspected and why the chosen source is authoritative.
- **Changed files** — exact file list.
- **Documentation updated** — exact governing/current-state docs changed, or an explicit statement that the task was audited and no document required a change.
- **Commit / branch head** — exact SHA when repository changes were made.
- **Proof** — tests, builds, logs, migration checks, runtime evidence, documentation consistency, or other concrete verification.
- **Not verified / remaining risk** — explicit gaps; never hide them.
- **Implementation score: X/10** — evidence-based using the rubric in `docs/LIVING_BUILD_PLAN.md`.
- **Next issue** — state that it was not started unless the product owner explicitly requested continuation.

No vague “everything looks good” reports.

---

## 10. Stop conditions

Stop and report instead of improvising when:

- requirements conflict;
- the correct source cannot be identified;
- another agent is actively modifying overlapping work;
- a destructive migration/data operation is required but not authorized;
- required infrastructure/credentials are unavailable;
- runtime evidence contradicts the expected architecture;
- the only apparent solution is a workaround rather than a source fix;
- implementing the request would require inventing missing product behavior;
- the only way forward appears to require creating another cross-domain monolith or duplicate source of truth.

Stopping with evidence is correct engineering. Guessing is not.
