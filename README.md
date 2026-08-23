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
  storage/
  testing/
  ui/
```

## Mandatory reading before implementation

Every agent or developer must read:

1. `AGENTS.md`
2. `docs/LIVING_BUILD_PLAN.md`
3. the relevant sections of `requirements.md`
4. the relevant sections of `structure.md`
5. the relevant ADRs in `docs/DECISIONS.md`
6. the relevant data/authority contracts in `docs/CANONICAL_MODEL.md`

Then inspect the actual source before editing.

The retired `docs/NORMALIZATION_PLAN.md` and `docs/IMPLEMENTATION_STATUS.md` are not active governance and must not be recreated unless the product owner explicitly asks for them.

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
