# HOOMA ULTIMATE

HOOMA ULTIMATE is a new third application built in a clean repository. The previous HOOMA codebases are read-only behavioral and architectural references; neither is the base of this repository.

## Foundation topology

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

Read `structure.md` and `requirements.md` before implementing a feature.

## First run

```bash
npm ci
npm run check
npm run dev
```

Local defaults:

- API: `http://localhost:3000`
- Web: `http://localhost:5173`
- Telegram Mini App shell: `http://localhost:5174`

The Phase 0 foundation intentionally contains no production business schema and no donor feature code. Phase 1 creates the fresh HOOMA ULTIMATE database and authentication foundation.
