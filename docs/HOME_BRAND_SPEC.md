# HOOMA ULTIMATE — HOME & BRAND ACCEPTANCE SPEC

Status: **ACTIVE SUBORDINATE PRODUCT SPEC**  
Authority: `structure.md` → `requirements.md` → this spec for Home/brand implementation details  
Applies to: Web and Telegram surfaces

---

## 0. Governing rule

Home is a football-first, mobile-first entry surface. A source component existing is not enough: routes, assets, responsive behavior, accessibility, and canonical domain ownership must agree.

No Home gateway may create a second source of business truth for an existing domain.

---

## 1. Canonical visual identity

HOOMA uses restrained vintage football/matchday heritage with modern mobile ergonomics:

- near-black primary surfaces;
- aged cream and antique/muted gold heritage details;
- lime for actions and active states;
- strong white functional copy/icons;
- approved football imagery;
- clean touch targets and readable phone typography;
- no generic dashboard treatment;
- Watch may use collector-ticket language contextually, but Home is not a ticket layout.

The primary HOOMA wordmark is a governed graphic asset, not plain text used as a replacement logo. Core Home/brand artwork must be recorded in `docs/ASSET_MANIFEST.md`.

---

## 2. Canonical Home composition

```text
HOOMA product header
↓
MATCH DAY / Create a Match hero
↓
9 primary Home gateway cards in a 3 × 3 grid
↓
HOOMA NOW heading + actual activity feed
↓
Whistle + Replay secondary rectangular buttons
↓
other approved Home read models, if any
↓
locked bottom navigation
```

The exact gateway order is:

```text
Row 1: HOOMA | Teams | Ultras
Row 2: Spots | Pitch | Gamers
Row 3: Ride  | Requests | FundMe
```

The permanent bottom navigation remains:

```text
Home | Play | Watch | HOOMA | Pitch
```

---

## 3. Main Home gateway grid — locked requirement

The primary Home grid contains exactly nine cards and exactly three columns, including on phone viewports:

```text
HOOMA     | Teams     | Ultras
Spots     | Pitch     | Gamers
Ride      | Requests  | FundMe
```

Required layout behavior:

- `grid-template-columns: repeat(3, minmax(0, 1fr))` or an equivalent three-column contract;
- equal card geometry using the approved `500 × 650` / `10:13` proportion;
- cards shrink safely with `min-width: 0` and must not force horizontal scrolling;
- gaps reduce on narrow phones before card count changes;
- no 4-column phone layout;
- no 2-column fallback that makes Home excessively tall unless the product owner explicitly changes this spec;
- no clipping, overlap, text/image collision, or viewport overflow;
- card title and supporting copy must remain readable at phone widths;
- Whistle and Replay are not gateway cards;
- no duplicate gateway for the same product elsewhere on Home.

The shared Home UI owns card presentation. Individual product domains own their routes and business truth.

---

## 4. Gateway domain boundaries

### 4.1 Spots

`Spots` replaces the old Home label `Places` for Watch-oriented venue discovery.

A Spot is still the existing canonical `Place`. `Spot` is a product/discovery label only. Do not introduce:

```text
SpotService
SpotRepository
SpotVenue
Spot table/model
```

Spots display eligible cafés, lounges, restaurants and similar Watch venues. A Place carrying the canonical `PITCH` capability must not appear in Spots.

The Spots directory has exactly two source tabs:

```text
By Owner | FanHub
```

Semantics:

- **By Owner** — the original Place suggester is also a verified owner of that same canonical Place.
- **FanHub** — the canonical Place was suggested by a registered HOOMA member without verified ownership by that original suggester.
- FanHub is a label/classification only, not a service, model, ownership system, or venue copy.
- A FanHub Place later claimed by a different real owner remains the same canonical Place and remains FanHub by original suggestion source.
- Guests may browse approved Spots but may not suggest, claim, or mutate.
- Registered HOOMA members may suggest a FanHub Spot.
- Owner-origin submission uses the existing ownership claim/ownership mechanics; it does not create a second Place.

The canonical Watch navigation remains:

```text
Events | Spots | Create Event | Add a Place
```

### 4.2 Pitch

Pitch is a separate Home gateway and routes to `/pitch`.

Pitch continues to use the canonical Place + `PITCH` capability architecture. Pitch records must not be copied into Spots and Spots must not infer Pitch from names or category strings.

The Home Pitch card uses the exact user-approved black/gold football-pitch artwork recorded in `docs/ASSET_MANIFEST.md`. Responsive compression is allowed; redesign or substitution is not.

### 4.3 Gamers

Gamers remains a separate product gateway and may use supporting copy such as `Find opponents`. It must not be merged with Play or built on top of Play domain behavior.

---

## 5. Match Day / Create a Match hero

The top Home hero is the real Create a Match interaction:

```text
HomePage
→ MatchDayHero
→ entire hero is interactive
→ /events/new
```

Requirements:

- full-width Match Day hero near the top of Home;
- the entire hero is one accessible action;
- creation uses the canonical Events/Play API and persistence;
- Web uses the normal protected-action auth boundary with validated return destination;
- Telegram uses Telegram identity/action-boundary behavior;
- no fake success state or client-only match persistence;
- preserve the approved football/stadium artwork and responsive crop.

---

## 6. HOOMA NOW — cross-domain activity read model

`HOOMA NOW` is a live projection of meaningful privacy-safe public activity. It is not a generic social feed, chat history, Whistle history, Replay storage, or a duplicate database.

Source domains remain authoritative. Discovery/Home may project only fields needed for Home, such as:

```text
activityType
sourceDomain
sourceId / navigation target
title
short summary
occurredAt / startsAt
privacy-safe image/icon reference
approved participant/entity summary
```

Rules:

- source-domain visibility always wins;
- private Team/Gamer/ULTRAS coordination never becomes public merely because Home exists;
- cancelled or invalidated activity must stop presenting as active;
- ordering and pagination must be deterministic and testable;
- loading, empty, error, ready, and pagination states must be real;
- no production fake feed rows;
- no copied source-domain business truth.

---

## 7. Whistle and Replay secondary actions

Immediately below the complete HOOMA NOW feed render:

```text
[ Whistle ]   [ Replay ]
```

They are secondary low rectangular actions, not tenth/eleventh gateway cards and not HOOMA NOW feed rows. On very narrow viewports they may stack only if necessary while preserving their short rectangular proportions.

Frozen/unimplemented destinations must not pretend to be complete.

---

## 8. Shared UI ownership

Home presentation belongs to the shared UI layer while platform shells own platform-specific placement:

```text
packages/ui/src/
  brand/
  home/
    MatchDayHero.tsx
    HomeGatewayGrid.tsx
    HomeGatewayCard.tsx
    HoomaNowFeed.tsx
    HomeSecondaryActions.tsx

apps/web/
apps/telegram/
```

Rules:

- one canonical Home gateway data contract;
- one shared gateway component/grid implementation;
- Web and Telegram do not independently recreate card behavior;
- platform-specific shell/safe-area behavior stays in its app;
- gateway cards navigate into domains but never own domain persistence.

---

## 9. Asset rules

All core Home assets must be registered in `docs/ASSET_MANIFEST.md` before production use.

Every governed entry records source/provenance, checksum when available, delivery path, surfaces, and approval/import status.

User-approved artwork must not be replaced by an approximation. Delivery derivatives may resize/compress the exact approved image for performance while preserving composition.

---

## 10. Responsive and accessibility acceptance

Verify Home on narrow mobile, typical phones, desktop Web, and Telegram WebView.

Required:

- exactly three gateway cards per row;
- no horizontal page scroll caused by the gateway grid;
- no card clipping;
- no text/image collisions;
- intrinsic dimensions prevent avoidable layout shift;
- safe-area top/bottom insets respected;
- keyboard focus visible on Web;
- meaningful accessible action names;
- reduced-motion preference respected;
- lazy/async loading for non-critical gateway artwork;
- Match Day critical artwork may retain eager/high-priority loading.

---

## 11. Verification gate

The Home/Spots/Pitch slice is not complete until applicable checks pass:

```text
exact 9-card Home gateway set verified
exact 3 × 3 order verified
3-column phone layout verified
no horizontal gateway overflow
Spots routes to canonical /places
Pitch routes to canonical /pitch
Spots exclude canonical PITCH capability records
By Owner | FanHub tabs verified
FanHub suggestion does not grant ownership
owner-origin submission uses canonical ownership mechanics
claiming keeps the same canonical Place
no Spot/FanHub service or duplicate venue model
Pitch artwork provenance verified
Web asset present
Telegram asset present
HOOMA NOW remains a read model
Whistle/Replay remain outside the gateway grid
Match Day hero still activates real event creation
auth boundaries preserved
architecture check
format
lint
typecheck
tests
build
integration tests
deploy preflight
mobile/safe-area smoke verification after deployment
```
