# HOOMA ULTIMATE — ASSET MANIFEST

Status: **ACTIVE GOVERNED ASSET REGISTER**  
Purpose: one source of truth for approved brand and Home artwork used by Web and Telegram.

---

## Rules

1. Core brand/Home assets are local governed assets, not hotlinked runtime dependencies.
2. Web and Telegram share the same approved asset identity; they do not maintain unrelated duplicates.
3. A donor asset is reference evidence until explicitly accepted into HOOMA ULTIMATE ownership.
4. A user-approved uploaded image must be matched to the exact file before production use. Never guess.
5. Replacements require an explicit manifest update and implementation-status note.
6. No generated approximation may silently replace an approved uploaded logo.
7. Record a stable source SHA/checksum where available.

---

## Manifest

| Logical ID | Asset | Source / provenance | Source SHA | Approval | Canonical target | Surfaces | Accessibility intent | Implementation status |
|---|---|---|---|---|---|---|---|---|
| `brand.hooma.wordmark` | HOOMA primary wordmark | Mature HOOMA donor: `apps/miniapp/public/brand/hooma-wordmark.png` | `c0d491616c1fc787290e91ab767d7e11ac9f8af0` | REFERENCE_ACCEPTED_FOR_REVIEW | `packages/ui/assets/brand/hooma-wordmark.png` | Web, Telegram | Decorative when adjacent to visible HOOMA product name; otherwise alt `HOOMA` | PENDING_IMPORT_AND_VISUAL_VERIFICATION |
| `home.matchday.hero` | Match Day / Create a Match hero artwork | Mature HOOMA donor: `apps/miniapp/src/assets/hero/matchday.png` | `70be826e16f62cebe9c061dc03ff07c22139bb02` | REFERENCE_ACCEPTED_FOR_REVIEW | `packages/ui/assets/home/matchday.png` | Web, Telegram | Action name belongs to the interactive hero: `Create a Match`; image itself normally decorative | PENDING_IMPORT_AND_VISUAL_VERIFICATION |
| `home.gateway.hooma` | HOOMA gateway logo/icon uploaded/approved by product owner | Earlier user-uploaded visual reference | PENDING_EXACT_FILE | USER_APPROVED_DIRECTION | `packages/ui/assets/home/gateways/hooma.*` | Web, Telegram | `HOOMA` | PENDING_EXACT_FILE_RESOLUTION |
| `home.gateway.teams` | Teams gateway logo/icon uploaded/approved by product owner | Earlier user-uploaded visual reference | PENDING_EXACT_FILE | USER_APPROVED_DIRECTION | `packages/ui/assets/home/gateways/teams.*` | Web, Telegram | `Teams` | PENDING_EXACT_FILE_RESOLUTION |
| `home.gateway.ultras` | Ultras gateway logo/icon uploaded/approved by product owner | Earlier user-uploaded visual reference | PENDING_EXACT_FILE | USER_APPROVED_DIRECTION | `packages/ui/assets/home/gateways/ultras.*` | Web, Telegram | `Ultras` | PENDING_EXACT_FILE_RESOLUTION |
| `home.gateway.gamers` | Gamers gateway logo/icon uploaded/approved by product owner | Earlier user-uploaded visual reference | PENDING_EXACT_FILE | USER_APPROVED_DIRECTION | `packages/ui/assets/home/gateways/gamers.*` | Web, Telegram | `Gamers` | PENDING_EXACT_FILE_RESOLUTION |
| `home.gateway.places` | Places gateway logo/icon uploaded/approved by product owner | Earlier user-uploaded visual reference | PENDING_EXACT_FILE | USER_APPROVED_DIRECTION | `packages/ui/assets/home/gateways/places.*` | Web, Telegram | `Places` | PENDING_EXACT_FILE_RESOLUTION |
| `home.gateway.requests` | Requests gateway logo/icon uploaded/approved by product owner | Earlier user-uploaded visual reference | PENDING_EXACT_FILE | USER_APPROVED_DIRECTION | `packages/ui/assets/home/gateways/requests.*` | Web, Telegram | `Requests` | PENDING_EXACT_FILE_RESOLUTION |
| `home.gateway.ride` | Ride gateway logo/icon uploaded/approved by product owner | Earlier user-uploaded visual reference | PENDING_EXACT_FILE | USER_APPROVED_DIRECTION | `packages/ui/assets/home/gateways/ride.*` | Web, Telegram | `Ride` | PENDING_EXACT_FILE_RESOLUTION |
| `home.gateway.fundme` | FundMe gateway logo/icon uploaded/approved by product owner | Earlier user-uploaded visual reference | PENDING_EXACT_FILE | USER_APPROVED_DIRECTION | `packages/ui/assets/home/gateways/fundme.*` | Web, Telegram | `FundMe` | PENDING_EXACT_FILE_RESOLUTION |
| `home.action.whistle` | Whistle secondary rectangular-action icon | Earlier user-uploaded visual reference | PENDING_EXACT_FILE | USER_APPROVED_DIRECTION | `packages/ui/assets/home/actions/whistle.*` | Web, Telegram | `Whistle` | PENDING_EXACT_FILE_RESOLUTION |
| `home.action.replay` | Replay secondary rectangular-action icon | Earlier user-uploaded visual reference | PENDING_EXACT_FILE | USER_APPROVED_DIRECTION | `packages/ui/assets/home/actions/replay.*` | Web, Telegram | `Replay` | PENDING_EXACT_FILE_RESOLUTION |

---

## Home placement contract tied to these assets

The approved icons/artwork must be consumed according to `docs/HOME_BRAND_SPEC.md`:

```text
8 primary gateway cards
↓
HOOMA NOW heading + actual feed
↓
Whistle + Replay low rectangular secondary buttons
```

Whistle and Replay assets must never be reused to turn those actions into ninth/tenth primary gateway cards.

---

## Resolution procedure for uploaded assets

Before importing any `PENDING_EXACT_FILE_RESOLUTION` asset:

1. locate the exact user-uploaded source or exact previously approved repository asset;
2. visually compare it to the approved reference;
3. record its filename/path and checksum/SHA here;
4. change approval to `APPROVED`;
5. import once into the canonical target path;
6. wire shared UI to that canonical asset;
7. verify Web and Telegram renders;
8. update `docs/IMPLEMENTATION_STATUS.md` with evidence.

If the exact file cannot be proven, leave the entry pending. Do not substitute a lookalike.
