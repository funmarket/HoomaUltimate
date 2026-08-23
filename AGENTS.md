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
5. Search for existing implementations, routes, services, repositories, models, components, hooks, stores, styles, tests, and migrations before creating anything new.
6. Identify the authoritative source that should change.
7. Check whether the branch moved while tracing. If it did, inspect the incoming changes before writing.
8. Define a narrow task boundary. Work one issue at a time unless the product owner explicitly asks for parallel scope.

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

## 5. Domain and dependency discipline

- One authoritative owner per concept.
- Reuse existing domain services and shared resources instead of creating parallel implementations.
- Preserve explicit dependency direction and avoid circular dependencies.
- Keep HTTP/transport concerns out of domain/application policy.
- Keep Prisma/database-specific behavior in infrastructure/repository boundaries.
- Keep authorization server-side and capability-specific.
- Keep PostgreSQL as durable business truth, Redis as transient infrastructure where designed, and object storage for media bytes.
- Never persist Whistle body content in PostgreSQL, logs, analytics, audit metadata, outbox payloads, notifications, URLs, or query strings.
- Global App Admin is `PLATFORM_ADMIN`; scoped Team/Community/product roles must not be renamed to generic Admin.
- Public browsing stays public where product rules require it; authentication belongs at protected-action/private-data boundaries.

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

## 7. Change discipline

Every implementation should be the smallest complete source-level change that solves the assigned issue.

Before adding a new file/model/endpoint/store/component, prove an equivalent authoritative implementation does not already exist.

When changing schema or contracts, inspect and reconcile all consumers. When changing a shared API, inspect Web and Telegram consumers. When changing authorization, inspect every route/service path that uses the affected policy.

Do not opportunistically refactor unrelated code in the same task.

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
- production smoke verification when explicitly appropriate and safe.

Never say “fixed,” “working,” “deployed,” “complete,” or “DONE” beyond what the evidence proves.

If a check cannot be run, state exactly what remains unverified.

---

## 9. Mandatory completion report

Every finished task report must include:

- **Issue / root cause** — what was actually wrong.
- **Source trace** — which layers were inspected and why the chosen source is authoritative.
- **Changed files** — exact file list.
- **Commit / branch head** — exact SHA when repository changes were made.
- **Proof** — tests, builds, logs, migration checks, runtime evidence, or other concrete verification.
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
- implementing the request would require inventing missing product behavior.

Stopping with evidence is correct engineering. Guessing is not.
