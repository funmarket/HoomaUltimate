# HOOMA — LIVING BUILD PLAN

Status: **ACTIVE BUILD DISCIPLINE**

Purpose: keep HOOMA development moving without drift, duplicated architecture, false completion claims, or agents interfering with one another.

This document is intentionally **not** a feature freeze and not a giant status ledger. It defines the permanent working method for building HOOMA coherently.

Read `AGENTS.md` first. Then use this file during every implementation task.

---

## 1. What stays authoritative

Permanent project truth remains in:

- `requirements.md` — product behavior and acceptance rules;
- `structure.md` — repository/application architecture and domain ownership;
- `docs/CANONICAL_MODEL.md` — current canonical data and authority model;
- `docs/DECISIONS.md` — explicit architectural decisions.

The product owner's newest explicit instruction overrides older project documents when they conflict.

This living plan controls **execution quality**, not product scope.

Documentation is part of execution quality. The affected governing docs must be updated with every completed task so the repository does not accumulate stale architectural or product instructions.

---

## 2. The build loop every agent must follow

For every issue or feature:

### A. Understand

- Restate the exact requested outcome internally before editing.
- Read the relevant product/architecture sources.
- Confirm current branch and HEAD.
- Identify whether the task is frontend, backend, data, infrastructure, or cross-layer.
- Identify another agent's active overlapping work before claiming ownership.

### B. Inspect

Trace recursively from source to consumer.

For a full vertical slice, inspect as applicable:

```text
UI / state
-> shared frontend client/contracts
-> API route
-> authentication / authorization
-> application service / domain policy
-> repository port
-> infrastructure implementation
-> Prisma schema / migration
-> PostgreSQL / Redis / storage
-> Railway / runtime configuration
```

For UI defects also inspect parent containers, shared components, CSS, responsive behavior, Telegram viewport/safe-area behavior, and rendering states.

Do not edit until the source of the problem is identified.

### C. Check for existing ownership

Search before creating:

- domain models;
- Prisma tables/enums;
- repositories/services;
- endpoints;
- DTOs/contracts;
- hooks/providers/stores;
- components/styles;
- scripts;
- migrations/tests;
- documentation;
- environment variables/infrastructure.

If an existing implementation owns the concept, extend or fix it there. Do not create a parallel source of truth.

### D. Define the smallest complete change

The change should solve **one assigned issue** from source through every required consumer.

Do not mix cleanup, refactors, future features, or another agent's scope unless required for correctness and explicitly explained.

### E. Implement

Keep architecture boundaries intact.

If implementation uncovers a contradiction that changes the product/domain model, stop and resolve it against the authoritative sources before continuing.

Never solve a difficult cross-domain workflow by creating a generic catch-all service, repository, contract file, frontend API client/store, or repair script. Keep business and persistence ownership with the owning domains and compose them through explicit application/orchestration boundaries.

### F. Update living documentation

Before verification, reconcile the affected authoritative docs with the implementation:

- product behavior -> `requirements.md`;
- architecture/domain ownership -> `structure.md`;
- canonical durable model/authority -> `docs/CANONICAL_MODEL.md`;
- architectural decision -> `docs/DECISIONS.md` / dedicated ADR when appropriate;
- execution discipline -> `AGENTS.md` / this file;
- implementation evidence/history -> `progress.md` or an established scoped audit document.

Do not create a new overlapping document merely because updating the authoritative one is inconvenient.

Open/draft PR behavior is **in-flight**, not current foundation truth. Documentation must say which is which.

### G. Verify

Use evidence appropriate to the changed layer. Prefer real behavior over static inspection when possible.

### H. Report

Provide proof, exact changed files, documentation updated, commit SHA, remaining uncertainty, and an evidence-based score out of 10.

Do not automatically begin another issue unless told to continue.

---

## 3. Non-drift and no-monolith rules

The following are always prohibited unless the product owner explicitly changes the rule:

- guessing product behavior;
- silently changing architecture to make a feature easier;
- copying donor architecture blindly;
- duplicate models/tables/services/routes/auth state/API clients;
- cross-domain monolithic services/repositories/contracts/stores/controllers;
- catch-all `shared`, `common`, `management`, `platform`, or `utils` modules that hide business ownership;
- giant migration/repair/normalization scripts that change independent domains together;
- circular domain dependencies;
- lower-level canonical domains importing higher-level feature domains to make one workflow convenient;
- scoped generic `ADMIN` roles that blur App Admin with domain authority;
- hardcoded production secrets or replaceable bot credentials;
- frontend-only protected-action authorization;
- direct database edits used instead of source/migration fixes;
- partial features presented as complete;
- fake production data or fake verification;
- arbitrary CSS/z-index/offset patches instead of tracing layout ownership;
- destructive branch operations to resolve agent concurrency;
- changing unrelated files because they look old or imperfect.

When a task touches shared infrastructure or shared contracts, inspect all known consumers before changing it.

Scalability and user experience are part of architecture quality. A user opening one product area should not unnecessarily trigger unrelated domain queries, locks, validation, caches, or rerenders because several domains were coupled into one catch-all implementation.

---

## 4. Parallel work rules

Multiple agents may work on the repository. Parallel work is allowed; **interference is not**.

Each agent must:

- snapshot HEAD before editing;
- check open PRs and active overlapping branches;
- keep its task narrow;
- re-check HEAD before committing/writing;
- inspect any incoming commit that appeared during the task;
- preserve unrelated incoming changes;
- stop if another agent is editing overlapping files/concepts and ownership is unclear.

Never revert another agent's valid work merely because an older document or assumption suggests a different direction. Confirm against the latest owner instruction and current ADR/canonical sources first.

Never force-push over another agent.

When two tasks overlap authoritative files, choose a clear sequence and ownership boundary rather than racing both branches.

---

## 5. Database and persistence rules

- PostgreSQL contains durable business truth.
- Redis is transient where the architecture explicitly assigns transient state.
- S3-compatible/object storage owns binary media when applicable.
- Prisma schema, migration SQL, repository behavior, and service assumptions must agree.
- Tables are single-purpose and owned by domain semantics.
- Add indexes/constraints deliberately from actual query/invariant needs.
- Do not add speculative tables for a feature that is not actually being implemented.
- Cross-domain atomic workflows may share an application transaction boundary without transferring persistence ownership into the wrong domain.
- Once the product is released, migrations are forward-only. Before release, any migration-history cleanup must still be deliberate, reviewed, and proven from a clean database.
- Never expose secrets or transient Whistle body content through durable persistence/logging.

---

## 6. Identity and authorization rules

- HOOMA has one canonical User.
- Telegram and classic Web login are separate authentication transports that resolve to that User.
- Never heuristically merge identities.
- Public browsing must remain public where the product requires it.
- Authentication belongs at protected action/private-data boundaries.
- Authorization belongs server-side.
- App-wide authority is `PLATFORM_ADMIN` only.
- Community, Team, ULTRAS, Gamers, and other domains use their own scoped vocabulary and capability rules.
- Assistants/delegates receive explicit capabilities; do not infer broad management permission from a label.

---

## 7. Donor/reference rule

Original/live HOOMA and any uploaded previous implementations are reference material only.

Allowed:

- inspect mature behavior;
- learn navigation/user-flow ideas;
- reuse visual/product concepts deliberately;
- compare edge cases and lessons learned.

Forbidden:

- make donor runtime a dependency;
- copy old confused auth/Admin/profile architecture;
- wire donor database/schema/routes into the clean rebuild;
- assume donor behavior is correct merely because it existed.

Current HOOMA architecture remains authoritative.

---

## 8. Verification ladder

Use the strongest relevant levels. More complex/high-risk work should climb higher.

1. **Source proof** — changed source re-read; imports/usages traced.
2. **Architecture/document proof** — ownership/dependency rules and governing docs match the source.
3. **Static proof** — typecheck/lint/architecture checks as relevant.
4. **Build proof** — affected packages/apps build successfully.
5. **Focused test proof** — permanent regression/unit tests pass.
6. **Infrastructure integration proof** — real disposable PostgreSQL/Redis/storage where behavior depends on them.
7. **Migration proof** — validate/status/deploy/read-back where schema changes occur.
8. **Deployment proof** — exact commit deployed successfully; health/logs checked.
9. **Live behavior proof** — safe authenticated/public end-to-end behavior tested and read back.

Do not claim a higher verification level than was actually performed.

A successful build does not prove database behavior. A source review does not prove deployment. A deployed container does not prove the user flow works. A CI run stopped at formatting does not prove later skipped gates.

---

## 9. Implementation scoring rubric

Every completed task receives **one score from 1 to 10** based on evidence, not confidence.

- **1–2:** exploratory/partial; root cause or implementation not established.
- **3–4:** meaningful source change but major layers or verification missing.
- **5–6:** source fix is coherent and builds/tests partly verified, but important runtime/integration proof remains.
- **7:** complete source-level fix with good regression/static/build evidence; production/integration proof still limited.
- **8:** complete vertical slice with strong tests and relevant infrastructure verification; minor live/deployment evidence missing.
- **9:** source + tests + real infrastructure + successful exact-commit deployment; only narrow live/user-path proof or noncritical evidence remains.
- **10:** complete applicable vertical slice proven from UI/action through API/authz/service/repository/persistence/read-back on the intended runtime, governing docs updated, with no known unresolved issue in the assigned scope.

Never award 10 because “the code looks correct.”

---

## 10. Required proof report template

Every implementation report must contain these fields:

```text
Issue / root cause:

Source trace:

What changed:

Changed files:
- exact/path/one
- exact/path/two

Documentation updated:
- exact/path/doc
- or: audited; no governing document required a change

Commit / current HEAD:

Verification proof:
- command/check/runtime evidence
- result

Not verified / remaining risk:

Implementation score: X/10

Next issue started: No
```

If no files changed, say so explicitly.

If another agent's concurrent commit was adopted or preserved, distinguish it from files you personally changed.

---

## 11. Definition of complete

A task is complete only for the exact scope assigned.

“Complete” means:

- the root cause is addressed at the authoritative layer;
- affected dependencies/consumers remain coherent;
- domain ownership remains clean and one-way;
- no duplicate or monolithic authority was introduced;
- relevant authorization/data boundaries are intact;
- affected governing documentation describes the resulting source state;
- verification evidence supports the claim;
- remaining uncertainty is disclosed.

It does **not** mean the entire product/domain is finished unless that entire domain was explicitly the assigned task and verified end to end.

---

## 12. Living-plan maintenance

Update this file only when the **working discipline itself** changes.

Do not turn it into another giant feature-status ledger.

Do not add temporary issue lists, percentages, freeze tables, or per-feature progress tracking here.

Product behavior belongs in `requirements.md`; architecture belongs in `structure.md`; decisions belong in `docs/DECISIONS.md`; canonical model changes belong in `docs/CANONICAL_MODEL.md`; implementation evidence/history belongs in the established current-state/history source.

Every task must audit those sources and update the ones its work actually changes. This keeps the documentation alive without multiplying authorities.
