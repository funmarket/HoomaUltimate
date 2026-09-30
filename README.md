# HOOMA

This repository is the clean HOOMA rebuild. `HoomaUltimate` is only the repository/workspace name used to distinguish this rebuild from the original application; the product itself is **HOOMA**.

The previous/live HOOMA codebases are read-only behavioral and visual references. They are not runtime, data, authentication, or architecture dependencies of this repository.

## Repository topology

```text
apps/
  api/
  web/
  telegram/
  worker/
packages/
  auth/
  config/
  contracts/
  database/
  domain/
  frontend/
  media-processing/
  storage/
  testing/
  ui/
```

## Mandatory reading before implementation

The project-control documentation is intentionally limited to these eight files:

1. `README.md` — repository entry point and document map;
2. `AGENTS.md` — mandatory execution rules;
3. `docs/LIVING_BUILD_PLAN.md` — implementation and verification discipline;
4. `requirements.md` — product behavior and acceptance requirements;
5. `structure.md` — repository/application architecture and current topology;
6. `docs/DECISIONS.md` — consolidated architectural/product decisions;
7. `docs/CANONICAL_MODEL.md` — canonical data and authority model;
8. `progress.md` — historical implementation/verification evidence and durable progress notes.

Read the relevant parts of those files, then inspect the actual source, current branch HEAD, overlapping work, and relevant runtime/database evidence before editing. Do not recreate retired, duplicate, scoped-plan, status, or standalone ADR Markdown files unless the product owner explicitly changes this eight-document rule.

## Domain ownership rule

HOOMA is organized by clean owning domains. Do not create cross-domain monolithic services, repositories, scripts, contracts, frontend clients/stores, or catch-all modules to make implementation faster. Cross-domain workflows must preserve one authoritative owner per concept and use explicit orchestration/ports where composition is required.

This is a scalability and product-performance rule as well as a code-organization rule: unrelated product flows should not be forced to query, lock, validate, cache, load, or rerender together.

## Living documentation

Documentation is part of each implementation task. When a task changes product behavior, architecture, canonical data ownership, routes, authorization, persistence, deployment/runtime topology, or current source state, the affected authoritative docs must be updated in that same task.

Current authority is intentionally centralized in the eight files above. Put product behavior in `requirements.md`, architecture/current topology in `structure.md`, canonical data/authority in `docs/CANONICAL_MODEL.md`, decisions in `docs/DECISIONS.md`, execution discipline in `AGENTS.md` / `docs/LIVING_BUILD_PLAN.md`, and durable historical evidence in `progress.md`.

Do not create duplicate architecture, status, roadmap, scoped-plan, or standalone ADR documents when one of the eight authoritative files already owns the subject. In-flight work is evidence to inspect, not canonical product truth.

## First run

```bash
npm ci
npm run check
npm run dev
```

Local defaults:

- API: `http://localhost:3000`
- Web: `http://localhost:5173`
- Telegram Mini App development surface: follow the current workspace/runtime configuration rather than hard-coding deployment credentials or URLs.
