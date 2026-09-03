# HOOMA — ASSET MANIFEST

Status: **ACTIVE GOVERNED ASSET REGISTER**  
Purpose: one source of truth for approved brand and Home artwork used by Web and Telegram.

## Rules

1. Core brand/Home assets are local governed assets, not hotlinked runtime dependencies.
2. Web and Telegram share the same approved asset identity; they do not maintain unrelated duplicates.
3. A user-approved uploaded image must be matched to the exact file before production use. Never guess.
4. Derived delivery assets may compress an approved source for responsive delivery, but must preserve the approved artwork and record provenance/checksums.
5. Gateway labels remain live HTML text; readable text is not baked into raster artwork.
6. All six active gateway cards use the same shared React component and the same 10:13 card geometry.
7. The Home gateway grid is exactly three columns on phone viewports; no horizontal scrolling is allowed.

## Manifest

| Logical ID              | Asset                                                    | Approved source SHA-256                                                                                               | Delivery SHA-256                                                   | Canonical target                                                                               | Surfaces      | Status                                 |
| ----------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------- | -------------------------------------- |
| `brand.hooma.wordmark`  | HOOMA primary wordmark                                   | user-approved upload `Hoomalogo.png` (2026-08-24), `16e197ff9a18917c9af56a2276c5bdf764a998b63fc083248ad8408e63072e8a` | `f60ae7b2348d65e0f62e47d699a6bf775ec9adac3c9764c7658fa40b61698e71` | `apps/web/public/brand/hooma-wordmark.webp` via `packages/ui/src/brand/BrandMark.tsx`          | Web, Telegram | APPROVED_AND_IMPORTED                  |
| `home.matchday.hero`    | Match Day / Create a Match hero                          | donor Git blob `70be826e16f62cebe9c061dc03ff07c22139bb02`                                                             | PENDING                                                            | `packages/ui/assets/home/matchday.png`                                                         | Web, Telegram | PENDING_IMPORT_AND_VISUAL_VERIFICATION |
| `home.gateway.hooma`    | HOOMA uploaded artwork                                   | `33c09b0aea14121a2e90fe86a1015ac7560775e4e6d2e017f6508af8e8eb4a49`                                                    | `83fb0343731987ddb00c0ee718350e55e1ac3f6ffd7ef1c3138768f2d298b562` | `/home-gateways/hooma.png`                                                                     | Web, Telegram | APPROVED_AND_IMPORTED                  |
| `home.gateway.teams`    | Teams uploaded artwork                                   | `fcfbb15f911eafdc7ab1efa2eddb04de80ce8e72f79ba666fe0d7800a4967403`                                                    | `fdbdac00eca7c704b4812efbfec1032c8695ea616963fd9dd53a275edea77aa3` | `/home-gateways/teams.png`                                                                     | Web, Telegram | APPROVED_AND_IMPORTED                  |
| `home.gateway.ultras`   | Ultras uploaded artwork                                  | `4dc1befa00ce147be369e986e4b4c8d0880755ce6c668d63d18a2fb7cfe949c8`                                                    | `1ed87cb3b04c800d9ba44ff57a302125f3057560b38e6e75b9325be4fb99cede` | `/home-gateways/ultras.png`                                                                    | Web, Telegram | APPROVED_AND_IMPORTED                  |
| `home.gateway.spots`    | Current Places Home artwork; internal legacy logical id retained | `8ee7ba7b676c3eb9cc427ce943d8ed3a7c4741a896a098a8bfe3b62ffdcff9a0`                                                    | `d1678d9e4b1abdd1bcb2cf303288c6f55c362e49d8c110ffa9030242ccc5cd79` | `/home-gateways/places.png`                                                                    | Web, Telegram | APPROVED_AND_IMPORTED                  |
| `home.gateway.pitch`    | User-supplied black/gold football-pitch artwork, 500×650 | conversation upload `requests.png` (2026-08-28), exact source retained as the approval reference                      | `93b565258b8a360f3247eb00bbf815a78358cc1e4cb04c98dee46d7afde93e39` | `apps/web/public/home-gateways/pitch.webp` and `apps/telegram/public/home-gateways/pitch.webp` | Web, Telegram | APPROVED_AND_IMPORTED                  |
| `home.gateway.gamers`   | Gamers uploaded artwork                                  | `07344b6664690664f06436fafdf4dc60681135b790b2576118d1e7f2a6e8e603`                                                    | `290b5d240a16de352592b2db86736eba0d024a834142dc9db2f0f7792efd286e` | `/home-gateways/gamers.png`                                                                    | Web, Telegram | APPROVED_AND_IMPORTED                  |
| `home.gateway.ride`     | Ride uploaded artwork                                    | `9866f31e7aad673afe131e7674457de5544511df7f51b7c64cd75de03c58cb56`                                                    | `8fd3a9b947f92abaf90ffb03180b853d3f3eb9ac3e8d23abbcb703a5bad8c00c` | `/home-gateways/ride.png`                                                                      | Web, Telegram | APPROVED_AND_IMPORTED                  |
| `home.gateway.requests` | Requests uploaded artwork                                | `d52477677a230ee9e9b8a2e07fcb48d4402f532aab064603e06869ba4c25ce6d`                                                    | `a4044cf0f95bd439b4cc9449e5a094b2d0b9c7069189dce272483617209298aa` | `/home-gateways/requests.png`                                                                  | Web, Telegram | APPROVED_AND_IMPORTED                  |
| `home.gateway.fundme`   | FundMe uploaded artwork                                  | `a71049b6efdf86a0508f747255f6830ab96771e08bd826323b0eab3306357bc6`                                                    | `cfd5e86f8ce187135f02969bd31480581907ca69f30bf9a34b04b7225c6bfeb8` | `/home-gateways/fundme.png`                                                                    | Web, Telegram | APPROVED_AND_IMPORTED                  |
| `home.action.whistle`   | Whistle secondary rectangular action                     | PENDING_EXACT_FILE                                                                                                    | PENDING                                                            | `packages/ui/assets/home/actions/whistle.*`                                                    | Web, Telegram | PENDING_EXACT_FILE_RESOLUTION          |
| `home.action.replay`    | Replay secondary rectangular action                      | PENDING_EXACT_FILE                                                                                                    | PENDING                                                            | `packages/ui/assets/home/actions/replay.*`                                                     | Web, Telegram | PENDING_EXACT_FILE_RESOLUTION          |

The Pitch delivery asset is a compressed WebP derivative of the approved 500×650 upload. Its composition, proportions, and artwork are unchanged; compression is only for phone delivery performance.

## Gateway delivery contract

```text
HomeGatewayGrid
├── Row 1: HOOMA → /hooma | Teams → /teams | Pitch → /pitch
└── Row 2: Places → /places | Ride → /rides | Requests → /requests
```

`Places` is the current visible Home label for canonical Place discovery. The source may retain the internal gateway id `spots`; that implementation detail does not create a second Place model and does not authorize restoring `Spots` as the visible Home label. Watch may continue to use `Spots` as Watch-owned presentation language independently. `Pitch` remains a separate gateway over the existing PITCH capability surface.

Each card is independently clickable when its product surface is available. Web and Telegram consume the same shared `HomeGatewayGrid`/`HomeGatewayCard` contract and resolve local assets from their public directories.

Gamers, ULTRAS and FundMe artwork remains retained approved/future artwork. Those assets are not active Home gateway cards under the current six-gateway contract.

The permanent bottom navigation is governed separately and is currently `Home | Play | Watch | HOOMA | Athletes`; no asset entry in this Home manifest should be used to infer that Pitch is still the fifth bottom-nav item.

## Home placement contract

```text
6 primary gateway cards in a phone-first 3 × 2 grid
↓
HOOMA NOW heading + actual cross-domain activity feed
↓
Whistle + Replay low rectangular secondary buttons
```

Whistle and Replay are not gateway cards and are not inside the HOOMA NOW feed.
