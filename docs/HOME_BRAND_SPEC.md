# HOOMA ULTIMATE — HOME & BRAND ACCEPTANCE SPEC

Status: **ACTIVE SUBORDINATE PRODUCT SPEC**  
Authority: `structure.md` → `requirements.md` → this spec for Home/brand implementation details  
Applies to: Web and Telegram surfaces

---

## 0. Why this file exists

HOOMA ULTIMATE is the third clean implementation attempt. Home and brand work must not be left as remembered visual polish, a dead route, a placeholder logo, or a later patch.

This file makes the Home composition, approved brand usage, ULTRAS entry banner, route behavior, responsive behavior, and verification gates explicit before implementation.

The governing engineering rule remains: **no partial or halfway feature is complete.** A component existing in source is not enough.

---

## 1. Canonical visual identity

HOOMA is a modern mobile football product expressed through restrained vintage football/matchday heritage.

Required visual language:

- near-black primary surfaces;
- aged cream display typography;
- antique/muted gold borders and heritage details;
- lime used for actions, active states, and small status emphasis;
- strong white functional icons/copy;
- archival/stadium/terrace football imagery where approved and appropriate;
- subtle physical print/paper grain rather than generic CSS grunge;
- modern readability and touch ergonomics;
- Watch may use collector-ticket language contextually, but Home and the rest of HOOMA must not become ticket-themed.

Normal body copy target: approximately `17px`.
Actions/buttons target: approximately `17px`, generally around `font-weight: 600`.

---

## 2. HOOMA wordmark requirement

The primary HOOMA mark must be an approved graphic asset, **not plain text used as a substitute logo**.

Accepted visual direction from the approved Home reference:

- classic/collegiate football lettering;
- antique-gold / warm-cream outline treatment;
- dark/black interior treatment where applicable;
- football integrated into or replacing an `O` where present in the approved artwork;
- lightly distressed printed character;
- sized for recognition without overwhelming the header.

Core brand artwork must come from a governed local asset listed in `docs/ASSET_MANIFEST.md`.

Forbidden:

- rebuilding the logo with arbitrary CSS/text because the asset is inconvenient;
- using an unrelated logo;
- hotlinking the core HOOMA logo from a third-party URL;
- maintaining different independent logo artwork for Web and Telegram;
- silently replacing a user-approved logo with a newly generated approximation.

---

## 3. Canonical Home composition

Home is a Match Day / football-neighborhood entry surface. It is not a generic dashboard.

The final Home hierarchy is:

```text
HOOMA product header / Match Day identity
↓
primary Home gateway/actions
↓
ULTRAS feature-entry banner
↓
Trending Now
↓
other approved Home sections/read models
↓
locked bottom navigation
```

The exact eight primary gateway cards remain:

```text
HOOMA | Teams | Ultras | Gamers
Places | Requests | Ride | FundMe
```

The permanent bottom navigation remains exactly:

```text
Home | Play | Watch | HOOMA | Pitch
```

No sixth ULTRAS bottom tab is permitted.

---

## 4. Top Home ULTRAS banner — locked requirement

Home must include one prominent, full-width **ULTRAS feature-entry banner above Trending Now**.

Purpose:

```text
Home
→ ULTRAS banner
→ /ultras
→ ULTRAS discovery
```

The Home banner is an **entry point only**. Home must not duplicate or own the ULTRAS directory/feed.

### Visual direction

The banner should communicate supporter/terrace culture while remaining recognizably HOOMA:

- supporter terrace / tifo / flags / scarves / stadium atmosphere;
- dark photographic treatment compatible with the Home surface;
- cream/gold heritage typography/details;
- lime only as restrained action/accent;
- real approved artwork/photography only;
- readable overlay and accessible contrast;
- full-width mobile treatment;
- no ticket-stub/perforation/boarding-pass metaphor.

### Content

The Home banner may contain approved static feature-entry copy such as `ULTRAS` and a short supporter-oriented line.

It must not fabricate dynamic data such as:

- member counts;
- live activity counts;
- fake clubs;
- fake supporter groups;
- fake Watch events.

Any dynamic value shown later must come from the canonical ULTRAS/discovery read model.

### Routing gate

Do **not** ship a clickable production banner that points to a dead or placeholder `/ultras` page.

The banner implementation is complete only in the same verified release slice where:

1. `/ultras` is a real route;
2. the ULTRAS public discovery surface is implemented;
3. public/member behavior is correctly gated;
4. Web and Telegram navigation both open the real route;
5. back navigation works on each platform;
6. empty/loading/error states are real;
7. no mock ULTRAS data is required for production.

During foundation normalization, brand assets and component contracts may be prepared, but the production navigation must not become a dead half-feature.

---

## 5. Header requirements

The approved Home reference calls for a compact football-first header rather than a large dashboard masthead.

Target composition where the surface supports it:

```text
HOOMA wordmark     [+ Create a Match]     notifications     avatar
```

Rules:

- use the approved HOOMA asset;
- Create a Match is an actual action/route, not decorative text;
- notifications must only show real notification state when implemented;
- avatar uses canonical profile presentation;
- no fake unread dot/count;
- Telegram shell may adapt placement to safe area and Telegram controls without changing product meaning.

---

## 6. Shared ownership

Brand presentation belongs to the shared UI/brand layer, with platform shells deciding platform-specific placement.

Target source ownership after frontend normalization:

```text
packages/ui/
  src/
    brand/
      BrandMark.tsx
      brand-assets.ts
    home/
      HomeUltrasBanner.tsx

apps/web/src/
  app/shell/
  pages/home/

apps/telegram/src/
  app/shell/
  pages/home/
```

Exact folders may be adjusted during the active frontend normalization if needed, but these rules do not change:

- one canonical component/asset contract;
- Web and Telegram do not independently recreate the logo/banner design;
- platform-specific shell behavior stays in its platform app;
- Home does not own ULTRAS business data.

---

## 7. Asset rules

All core HOOMA brand assets must be recorded in `docs/ASSET_MANIFEST.md` before production use.

Every governed asset entry records:

- logical ID;
- source/provenance;
- source checksum/SHA when available;
- approval state;
- canonical target path;
- allowed surfaces;
- accessibility/alt-text intent;
- implementation status.

If an earlier user-uploaded logo cannot be resolved to the exact file, it must remain `PENDING_EXACT_FILE_RESOLUTION`; implementation must not guess which image was intended.

---

## 8. Responsive/accessibility acceptance

Verify Home and the ULTRAS banner at minimum for:

- narrow mobile;
- typical phone widths;
- desktop Web;
- Telegram WebView;
- safe-area top/bottom insets;
- long translated copy;
- keyboard focus;
- screen-reader link/button names;
- image alt behavior;
- image crop/object-position;
- no horizontal clipping;
- no text/image collision;
- no layout shift from missing intrinsic image dimensions;
- reduced-motion behavior if any motion is introduced.

---

## 9. Required states

Home/brand implementation must not rely on fake fallback content.

Where data is involved, provide:

- loading;
- empty;
- error;
- ready;
- unauthenticated action-boundary behavior;
- authenticated behavior.

Static brand artwork must fail gracefully without exposing broken-image chrome or replacing the approved logo with arbitrary text styling.

---

## 10. Verification gate

The Home/brand slice is not `DONE` until all applicable checks pass:

```text
asset provenance verified
canonical asset path verified
no duplicate core logo source
Web render verified
Telegram render verified
ULTRAS banner position above Trending Now verified
/ultras route verified
public discovery verified
action-boundary auth verified
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

If `/ultras` is not yet implemented, the banner remains an explicit planned requirement rather than a fake completed feature.
