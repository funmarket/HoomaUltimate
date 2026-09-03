# HOOMA — HOME & BRAND ACCEPTANCE SPEC

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
MATCH DAY hero
↓
6 primary Home gateway cards in a 3 × 2 grid
↓
HOOMA NOW heading + actual activity feed
↓
Whistle + Replay secondary rectangular buttons
↓
other approved Home read models, if any
↓
locked bottom navigation
```

The exact current gateway order is:

```text
Row 1: HOOMA | Teams | Pitch
Row 2: Places | Ride | Requests
```

The permanent bottom navigation is:

```text
Home | Play | Watch | HOOMA | Athletes
```

Pitch remains a standalone product and Home gateway at `/pitch`; Athletes owns the fifth permanent bottom-navigation slot at `/athletes`.

---

## 3. Main Home gateway grid — locked requirement

The primary Home grid contains exactly six cards and exactly three columns, including on phone viewports:

```text
HOOMA     | Teams     | Pitch
Places    | Ride      | Requests
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

### 4.1 Places on Home / Spots in Watch

The current Home gateway visible label is `Places` and routes to `/places`.

`Spots` remains valid Watch-oriented product language where the Watch UI uses it, but it is no longer the visible Home gateway label. Both labels refer to the existing canonical `Place`; neither authorizes a second venue domain. Do not introduce:

```text
SpotService
SpotRepository
SpotVenue
Spot table/model
```

Watch Spots display eligible cafés, lounges, restaurants and similar Watch venues. A Place carrying the canonical `PITCH` capability must not be duplicated merely to participate in Watch or Pitch presentation.

Where the Watch Spots directory exposes source tabs, the existing semantics remain:

```text
By Owner | FanHub
```

Semantics:

- **By Owner** — the original Place suggester is also a verified owner of that same canonical Place.
- **FanHub** — the canonical Place was suggested by a registered HOOMA member without verified ownership by that original suggester.
- FanHub is a label/classification only, not a service, model, ownership system, or venue copy.
- A FanHub Place later claimed by a different real owner remains the same canonical Place and remains FanHub by original suggestion source where that classification remains part of Watch behavior.
- Guests may browse approved Places/Spots but may not suggest, claim, or mutate.
- Registered HOOMA members may suggest a Place through the current governed Place flow.
- Owner-origin submission uses the existing ownership claim/ownership mechanics; it does not create a second Place.

The canonical Watch navigation remains independently owned by Watch. Home naming must not be used to rename Watch screens without a separate product decision.

### 4.2 Pitch

Pitch is a separate Home gateway and routes to `/pitch`.

Pitch continues to use the canonical Place + `PITCH` capability architecture. Pitch records must not be copied into another venue store and other Place views must not infer Pitch from names or category strings.

The Home Pitch card uses the exact user-approved black/gold football-pitch artwork recorded in `docs/ASSET_MANIFEST.md`. Responsive compression is allowed; redesign or substitution is not.

### 4.3 Athletes

Athletes is a separate implemented HOOMA-connected product at `/athletes` and owns the fifth permanent bottom-navigation slot. Athletes remains independent from HOOMA Communities and Teams even though it reuses canonical HOOMA User identity.

### 4.4 Gamers

Gamers remains a separate implemented product and direct route family, but it is not an active Home gateway under the current simplified IA. It must not be merged with Play or built on top of Play domain behavior.

---

## 5. Match Day hero

The top Home hero is a direct entry into the Play product:

```text
HomePage
→ HomeHero
→ entire hero is interactive
→ /play
```

Requirements:

- full-width Match Day hero near the top of Home;
- the entire hero is one accessible action;
- activation navigates to the canonical internal `/play` route on the current Web or Telegram deployment origin;
- do not hard-code the Railway production hostname into shared UI;
- the hero does not create an Event directly; event creation remains owned by the Play/Events flow;
- preserve the approved football/stadium artwork and responsive crop;
- keyboard focus must be visible on Web.

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
    HomeHero.tsx
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

The Home/Places/Pitch slice is not complete until applicable checks pass:

```text
exact 6-card Home gateway set verified
exact 3 × 2 order verified
3-column phone layout verified
no horizontal gateway overflow
Places routes to canonical /places
Pitch routes to canonical /pitch
Athletes permanent nav routes to canonical /athletes
no duplicate Spot/Place venue model
Watch Spot presentation preserves canonical Place ownership
Pitch artwork provenance verified
Web asset present
Telegram asset present
HOOMA NOW remains a read model
Whistle/Replay remain outside the gateway grid
Match Day hero opens canonical /play
Match Day hero remains one accessible full-card action
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
