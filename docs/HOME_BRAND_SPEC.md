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
HOOMA NOW heading + actual activity feed
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

## 6. HOOMA NOW — canonical cross-domain activity feed

`HOOMA NOW` is the **live cross-domain activity feed for meaningful public activity happening around HOOMA**.

It is not:

- a generic social-media feed;
- a follower feed;
- a chat stream;
- Whistle history;
- Replay storage;
- a duplicate Teams/Gamers/ULTRAS database;
- a place to manufacture engagement with fake activity.

Canonical structure:

```text
HOOMA NOW
[ real activity item ]
[ real activity item ]
[ real activity item ]
...
```

### 6.1 What belongs in the feed

The feed may project privacy-safe activity from implemented source domains, including examples such as:

- **Teams** — a Team challenge accepted by both sides;
- **Teams** — an upcoming Team match/game;
- **Gamers** — a Gamer Squad challenge accepted by both sides;
- **Gamers** — an upcoming Gamer match/challenge;
- **ULTRAS** — a public ULTRAS move, activity or event that its own domain explicitly allows to be public;
- **ULTRAS** — an upcoming public supporter activity where appropriate;
- **Events/Play** — relevant upcoming public football activity;
- future implemented domains — only explicitly approved activity types whose source-domain privacy policy permits Home discovery.

The list above defines the intended product meaning but does **not** authorize frozen domains to be implemented during foundation normalization. A feed activity type becomes active only when its source domain is implemented and verified.

### 6.2 Source-of-truth rule

Every HOOMA NOW item is a **projection/reference to canonical source-domain data**.

Examples:

```text
accepted Team challenge
→ source truth remains Teams
→ HOOMA NOW projects it
→ tap opens the real Team challenge/match destination

accepted Gamer challenge
→ source truth remains Gamers
→ HOOMA NOW projects it
→ tap opens the real Gamer challenge/match destination

public ULTRAS activity
→ source truth remains ULTRAS
→ HOOMA NOW projects only the allowed public projection
→ tap opens the real ULTRAS destination
```

HOOMA NOW must never create competing durable records that become a second authority for:

- challenge state;
- match state;
- ULTRAS activity state;
- RSVP state;
- membership state;
- roles/permissions.

Its backend owner is the **Discovery/Home read model**. Source domains own business truth.

### 6.3 Privacy and authorization rule

Source-domain visibility always wins.

Therefore:

- private ULTRAS HQ activity must never appear publicly merely because HOOMA NOW exists;
- private challenge coordination/messages must never become feed content;
- member-private Team/Gamer data must remain private;
- feed serialization must use explicit privacy-safe projections rather than exposing raw source records;
- removing/restricting source content must make the corresponding feed projection disappear or become unavailable according to source policy.

### 6.4 Feed item contract

The exact DTO is defined later with Discovery implementation, but every feed item must be capable of carrying only the projection data needed for Home, such as:

```text
activityType
sourceDomain
sourceId / navigation target
title
short summary
occurredAt / startsAt as applicable
privacy-safe image/icon reference as applicable
participants/entities needed for the card
```

Do not copy entire source records into a generic JSON blob as a substitute for a typed read model.

### 6.5 Ordering and lifecycle

HOOMA NOW should prioritize current/relevant activity rather than permanent historical accumulation.

Expected semantics:

- accepted challenges appear when the accepted state is real;
- upcoming matches remain discoverable while relevant;
- cancelled/invalidated source activity must not continue presenting as active;
- stale items age out according to the Discovery policy;
- ordering must be deterministic and testable;
- pagination/cursor behavior must be explicit when the feed grows.

### 6.6 Feed UI states

The feed must have real:

- loading state;
- empty state;
- error state;
- ready state;
- pagination/load-more state when needed.

No production fake feed rows are allowed.

### 6.7 Relationship to Whistle and Replay

`HOOMA NOW` is not a wrapper label for Whistle and Replay.

Whistle and Replay must not render as feed rows merely because their buttons sit below the feed.

If a future Replay output or another domain event is ever allowed in HOOMA NOW, that requires an explicit approved activity projection; the Replay button itself remains outside the feed.

---

## 7. Whistle and Replay secondary actions — locked placement

Immediately **below the complete HOOMA NOW feed section**, render two separate secondary actions:

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
- HOOMA NOW consumes the Discovery/Home read model; it does not own source-domain business truth;
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
HOOMA NOW verified as cross-domain activity feed
accepted Team challenge projection verified when Teams feed projection is enabled
upcoming Team match projection verified when enabled
accepted Gamer challenge projection verified when Gamers is implemented/enabled
public ULTRAS activity projection verified when ULTRAS is implemented/enabled
source-domain privacy leakage tests pass
feed items navigate to canonical source destinations
no duplicate business truth stored in Discovery
loading/empty/error/ready feed states verified
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
