# HOOMA implementation progress

This file is a non-authoritative execution and verification log. Product behavior and architecture truth remain in `requirements.md`, `structure.md`, `docs/CANONICAL_MODEL.md`, `docs/DECISIONS.md`, and the applicable ADRs.

## Athletes hardening sequence

Target base: `phase-0-foundation`

Progression gate: each step must score **more than 8/10** under `docs/LIVING_BUILD_PLAN.md` before the next step starts. A score of 9 requires exact-commit deployment to the intended runtime plus live runtime/health evidence.

- [IN PROGRESS] Step A — Athletes authorization boundaries and Photo transaction unit of work
- [ ] Step B — Athletes Photo Board signed delivery optimization
- [ ] Step C — WebSession `lastSeenAt` activity projection and Active Athletes redesign
- [ ] Step D — Whistle older-history access and canonical user-profile navigation

### Step A — Athletes authorization boundaries and Photo transaction unit of work

- Branch: `refactor/athletes-authorization-photo-uow`
- Pull request: `#268`
- Base commit: `ecaecf82e2ab8479ed22d9d7c136f5a54ec4a21a`
- Scope: replace broad/concrete Athletes authorization dependencies with explicit application ports; remove Prisma Photo infrastructure re-entry into `AthletesService`; preserve Founder/member policy, lifecycle row locking, upload recovery intent, Photo deletion outbox cleanup, and all existing user-visible behavior.
- Database migration: none.
- Source review: completed; authorization direction, transaction/row-lock behavior, recovery intent, deletion outbox behavior, and affected governing documentation were reviewed. The two formatter findings from CI run `#1836` were corrected and the temporary diagnostic change was removed.
- CI: final-source run pending. Earlier run `#1836` passed install, database generation/validation/migration, and architecture verification before stopping at formatting; later gates from that run are not counted as evidence.
- Merge: product owner requested PR `#268` be merged after the final source passes the repository verification ladder.
- Exact-commit runtime deployment: not performed by this PR review/merge task.
- Live runtime/health evidence: pending a separate deployment task.
- Score: pending final CI; Step B remains blocked unless Step A later scores more than 8/10.

### Step B — Athletes Photo Board signed delivery optimization

Not started. Must wait for Step A score > 8/10.

### Step C — WebSession activity and Active Athletes redesign

Not started. Must wait for Step B score > 8/10.

### Step D — Whistle history and canonical user navigation

Not started. Must wait for Step C score > 8/10.
