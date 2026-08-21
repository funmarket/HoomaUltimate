# HOOMA ULTIMATE — HOME & BRAND ACCEPTANCE SPEC

Status: **ACTIVE SUBORDINATE PRODUCT SPEC**  
Authority: `structure.md` → `requirements.md` → this spec for Home/brand implementation details  
Applies to: Web and Telegram surfaces

---

## 0. Why this file exists

HOOMA ULTIMATE is the third clean implementation attempt. Home and brand work must not be left as remembered visual polish, a dead route, a placeholder logo, or a later patch.

The governing rule is: **no partial or halfway feature is complete.** A component existing in source is not enough.

---

## 1. Canonical visual identity

HOOMA is a modern mobile football product expressed through restrained vintage football/matchday heritage.

Required visual language:

- near-black primary surfaces;
- aged cream display typography;
- antique/muted gold borders and heritage details;
- lime for actions, active states and small status emphasis;
- strong white functional icons/copy;
- archival/stadium/terrace football imagery where approved;
- subtle physical print/paper grain rather than generic CSS grunge;
- modern readability and touch ergonomics;
- Watch may use collector-ticket language contextually, but Home and the rest of HOOMA must not become ticket-themed.

---

## 2. HOOMA wordmark requirement

The primary HOOMA mark must be an approved graphic asset, **not plain text used as a substitute logo**.

Accepted direction from the approved Home reference:

- classic/collegiate football lettering;
- antique-gold / warm-cream outline treatment;
- dark/black interior treatment where applicable;
- football integrated into or replacing an `O` where present in the approved artwork;
- lightly distressed printed character;
- sized for recognition without overwhelming the header.

Core brand artwork must come from a governed local asset recorded in `docs/ASSET_MANIFEST.md`.

Forbidden:

- rebuilding the logo with arbitrary CSS/text because the asset is inconvenient;
- using an unrelated logo;
- hotlinking the core HOOMA logo from a third-party URL;
- maintaining different independent logo artwork for Web and Telegram;
- silently replacing a user-approved logo with a generated approximation.

---

## 3. Canonical Home composition

Home is a Match Day / football-neighborhood entry surface. It is not a generic dashboard.

Canonical hierarchy:

```text
HOOMA product header
↓
MATCH DAY / Create a Match hero
↓
8 primary Home gateway cards
↓
HOOMA NOW heading + actual feed
↓
Whistle + Replay secondary rectangular buttons
↓
other approved Home sections/read models, if any
↓
locked bottom navigation
```

The exact eight primary gateway cards are:

```text
HOOMA | Teams | Ultras | Gamers
Places | Requests | Ride | FundMe
```

These eight are the primary Home navigation grid and must remain visually distinct from Whistle and Replay.

The permanent bottom navigation remains exactly:

```text
Home | Play | Watch | HOOMA | Pitch
```

---

## 4. Main Home gateway grid — locked requirement

The main feature grid contains exactly eight primary cards:

```text
Row 1: HOOMA | Teams | Ultras | Gamers
Row 2: Places | Requests | Ride | FundMe
```

Visual rules:

- equal card dimensions;
- clean 4-column × 2-row composition in the approved design reference;
- responsive adaptation on narrow mobile without overlap or clipping;
- dark/black card body;
- bronze/aged-gold shiny outline treatment;
- silver/white icon treatment;
- clear centered card title;
- card title target visually around `18px`;
- regular/supporting text target visually around `17px` where supporting text exists;
- no fifth card forced into a row;
- no Whistle or Replay card in this primary grid;
- no duplicate product gateway with a second conflicting card elsewhere on Home.

The grid is navigation only. It must not become a second source of business data.

---

## 5. Top Home MATCH DAY / Create a Match hero — locked requirement

The top Home feature banner/hero is the mature **Create a Match** interaction from the older live HOOMA application.

Verified donor behavior:

```text
HomePage
→ MatchDayHero
→ entire hero is interactive
→ onCreateMatch
→ /events/new
```

The mature donor component uses:

```text
assets/hero/matchday.png
visible CTA: + Create a Match
accessible name: Create a Match
```

### Required target behavior

- prominent full-width Match Day hero near the top of Home;
- the **entire hero** is one accessible action, not only a tiny nested button;
- clicking/tapping starts the real Play-event creation flow;
- canonical target is `/events/new` unless the final router gives that same route a normalized named helper;
- unauthenticated Web users hit the normal protected-action auth boundary with validated `returnTo`;
- Telegram users use Telegram identity/action-boundary behavior rather than being sent through Web login;
- no fake success state;
- no separate client-only match draft system;
- creation uses the canonical Events/Play API and persistence.

### Visual behavior

Preserve the accepted matchday intent rather than replacing it with a generic card:

- football/stadium matchday artwork;
- dark integration into the Home background;
- vintage football treatment compatible with HOOMA;
- clear `+ Create a Match` CTA;
- readable contrast;
- responsive crop;
- no ticket/perforation metaphor.

---

## 6. HOOMA NOW — feed, not a container for Whistle/Replay

`HOOMA NOW` is a **feed section**.

Its job is to present the current aggregated Home/Now read model: timely, relevant product activity that HOOMA is allowed to surface.

Canonical structure:

```text
HOOMA NOW
[ actual feed item ]
[ actual feed item ]
[ actual feed item ]
...
```

Rules:

- `HOOMA NOW` is not a wrapper label for Whistle and Replay;
- Whistle and Replay must not be rendered inside the HOOMA NOW feed;
- the feed must use real discovery/read-model data when implemented;
- no fake production feed rows;
- feed loading, empty and error states must be real;
- feed rendering does not become a second durable source of domain truth;
- its backend owner is the Discovery/Home read model, not Whistle or Replay individually.

---

## 7. Whistle and Replay secondary actions — locked placement

Immediately **below the HOOMA NOW feed**, render two separate secondary actions:

```text
[ Whistle ]   [ Replay ]
```

These are not part of the eight-card grid and are not inside the HOOMA NOW feed.

Visual rules:

- low, wide rectangular-button proportions;
- materially shorter than the eight primary gateway cards;
- side-by-side where the viewport safely permits;
- if a very narrow viewport requires stacking, preserve the rectangular-button proportions rather than turning them into tall cards;
- dark/black surface;
- bronze/aged-gold shiny border treatment;
- silver/white icon treatment;
- readable label, visually around `18px`;
- clear tap target and focus state;
- optional directional chevron is acceptable;
- no tall-card treatment matching the primary grid;
- no surrounding `HOOMA NOW` container that falsely groups the buttons as feed content.

Semantic role:

- Whistle button opens the real Whistle product entry when that domain is implemented;
- Replay button opens the real Replay product entry when that domain is implemented;
- until those frozen domains are implemented, production navigation must not pretend those destinations are complete.

---

## 8. ULTRAS placement rule

ULTRAS is one of the locked eight Home primary gateways and later receives its own `/ultras` public discovery/domain implementation.

Do not create an additional top-level ULTRAS banner that competes with the Match Day hero unless the product owner explicitly changes this rule.

Do not ship a dead `/ultras` gateway as if complete: production activation must coincide with the real ULTRAS discovery slice.

---

## 9. Header requirements

Target football-first header direction where appropriate:

```text
HOOMA wordmark     contextual actions     notifications     avatar
```

Rules:

- use the approved HOOMA asset;
- do not duplicate the Match Day hero CTA unnecessarily in the header unless the approved final Home design explicitly keeps both;
- notifications show only real notification state;
- avatar uses canonical profile presentation;
- no fake unread dot/count;
- Telegram may adapt placement for safe areas and Telegram controls without changing product meaning.

---

## 10. Shared ownership

Brand presentation belongs to the shared UI/brand layer, with platform shells deciding platform-specific placement.

Target ownership after frontend normalization:

```text
packages/ui/
  src/
    brand/
      BrandMark.tsx
      brand-assets.ts
    home/
      MatchDayHero.tsx
      HomeGatewayGrid.tsx
      HoomaNowFeed.tsx
      HomeSecondaryActions.tsx

apps/web/src/
  app/shell/
  pages/home/

apps/telegram/src/
  app/shell/
  pages/home/
```

Rules:

- one canonical component/asset contract;
- Web and Telegram do not independently recreate the logo, cards, or hero artwork;
- platform-specific shell/navigation behavior stays in its app;
- Match Day hero invokes Events/Play behavior; it does not own Event persistence;
- HOOMA NOW consumes a read model; it does not own the source domains;
- Whistle and Replay remain separate domain entry actions.

---

## 11. Asset rules

All core HOOMA brand/Home assets must be recorded in `docs/ASSET_MANIFEST.md` before production use.

Every governed asset entry records:

- logical ID;
- source/provenance;
- source checksum/SHA when available;
- approval state;
- canonical target path;
- allowed surfaces;
- accessibility/alt-text intent;
- implementation status.

Known donor evidence:

```text
HOOMA wordmark donor asset:
apps/miniapp/public/brand/hooma-wordmark.png
Git blob SHA: c0d491616c1fc787290e91ab767d7e11ac9f8af0

Match Day donor artwork:
apps/miniapp/src/assets/hero/matchday.png
Git blob SHA: 70be826e16f62cebe9c061dc03ff07c22139bb02
```

Donor assets are reference sources. Target ownership must be explicit before use.

If an earlier user-uploaded logo/artwork cannot be resolved to the exact approved file, mark it `PENDING_EXACT_FILE_RESOLUTION`; do not guess which image was intended.

---

## 12. Responsive/accessibility acceptance

Verify Home for:

- narrow mobile;
- typical phone widths;
- desktop Web;
- Telegram WebView;
- safe-area top/bottom insets;
- keyboard focus;
- screen-reader action names;
- image crop/object-position;
- no horizontal clipping;
- no text/image collision;
- no layout shift from missing intrinsic dimensions;
- reduced-motion behavior if motion is introduced;
- Whistle/Replay remain visually secondary to the eight primary gateways.

---

## 13. Verification gate

The Home/brand slice is not `DONE` until all applicable checks pass:

```text
asset provenance verified
canonical asset paths verified
no duplicate core logo source
no duplicate Match Day artwork source
Web render verified
Telegram render verified
exact 8-card Home gateway set verified
Whistle absent from primary grid
Replay absent from primary grid
HOOMA NOW verified as feed
Whistle + Replay verified below feed
Whistle + Replay verified as low rectangular buttons
Match Day hero activates Create a Match
/events/new creation route verified
Web action-boundary auth verified
Telegram action-boundary identity verified
real Events persistence verified
mobile/safe-area verified
accessibility names verified
architecture check
format
lint
typecheck
tests
build
live smoke test after deployment
```
