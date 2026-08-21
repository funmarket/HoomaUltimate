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

The mature live-HOOMA baseline proves the first Home element is `MatchDayHero`, not an ULTRAS banner.

Canonical Home hierarchy begins:

```text
HOOMA product header
↓
MATCH DAY / Create a Match hero
↓
Home discovery/content sections
↓
eight locked product gateways where the normalized Home design places them
↓
locked bottom navigation
```

The exact eight gateway destinations remain:

```text
HOOMA | Teams | Ultras | Gamers
Places | Requests | Ride | FundMe
```

The permanent bottom navigation remains exactly:

```text
Home | Play | Watch | HOOMA | Pitch
```

ULTRAS is a Home gateway/domain destination. It is **not** the top Home banner.

---

## 4. Top Home MATCH DAY / Create a Match hero — locked requirement

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
- no ticket/perforation metaphor;
- no unrelated ULTRAS/tifo labeling on this hero.

### Completion gate

The hero is not `DONE` until:

1. its governed artwork exists in the target asset system;
2. Web renders it correctly;
3. Telegram renders it correctly;
4. the whole hero is keyboard/touch accessible;
5. activation reaches the real event-creation route;
6. auth boundary is correct on Web;
7. Telegram identity behavior is correct;
8. event creation persists through the canonical Events domain;
9. error/loading/submission states of the creation flow are real;
10. mobile/safe-area checks pass.

---

## 5. ULTRAS placement rule

ULTRAS remains one of the locked eight Home product gateways and later receives its own `/ultras` public discovery/domain implementation.

Do not create a second top-level ULTRAS Home banner unless the product owner explicitly requests one later.

Do not ship a dead `/ultras` gateway: the route may be visually reserved during foundation work, but production action must become active only with the real ULTRAS discovery slice.

---

## 6. Header requirements

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

## 7. Shared ownership

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

apps/web/src/
  app/shell/
  pages/home/

apps/telegram/src/
  app/shell/
  pages/home/
```

Rules:

- one canonical component/asset contract;
- Web and Telegram do not independently recreate the logo or hero artwork;
- platform-specific shell/navigation behavior stays in its app;
- Match Day hero invokes Events/Play behavior; it does not own Event persistence.

---

## 8. Asset rules

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
```

Donor assets are reference sources. Target ownership must be explicit before use.

If an earlier user-uploaded logo/artwork cannot be resolved to the exact approved file, mark it `PENDING_EXACT_FILE_RESOLUTION`; do not guess which image was intended.

---

## 9. Responsive/accessibility acceptance

Verify Home and Match Day hero for:

- narrow mobile;
- typical phone widths;
- desktop Web;
- Telegram WebView;
- safe-area top/bottom insets;
- keyboard focus;
- screen-reader action name;
- image crop/object-position;
- no horizontal clipping;
- no text/image collision;
- no layout shift from missing intrinsic dimensions;
- reduced-motion behavior if motion is introduced.

---

## 10. Verification gate

The Home/brand slice is not `DONE` until all applicable checks pass:

```text
asset provenance verified
canonical asset path verified
no duplicate core logo source
no duplicate Match Day artwork source
Web render verified
Telegram render verified
Match Day hero is first major Home feature
whole hero activates Create a Match
/events/new creation route verified
Web action-boundary auth verified
Telegram action-boundary identity verified
real Events persistence verified
mobile/safe-area verified
accessibility name verified
architecture check
format
lint
typecheck
tests
build
live smoke test after deployment
```
