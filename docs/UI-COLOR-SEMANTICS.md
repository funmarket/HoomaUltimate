# HOOMA app-wide semantic color rules

These rules are product semantics, not decoration. New UI and future refactors must choose colors by meaning before choosing a component-specific accent.

## 1. Positive / active / healthy = green

Use `var(--app-positive)` for:
- active states and selected states;
- success confirmations;
- healthy/positive notifications;
- positive counters and totals;
- approve/accepted/joined/available states when the state is positive.

Do not use orange or gold to communicate an active or successful state.

## 2. People identity and membership = Cayenne Blue

Use `var(--app-people-blue)` for:
- display names and usernames when identity needs semantic emphasis;
- member/founder/moderator/coach/player role chips;
- people-related status labels;
- identity-linked badges.

The current HOOMA people-blue token is `#58BFFF` in dark mode with an accessible darker equivalent in light mode.

## 3. Warning / attention = orange

Use `var(--app-warning)` for:
- warnings;
- caution;
- attention-required states;
- occasional non-semantic title/accent decoration where it cannot be confused with active/success state.

Orange must not be the default color for member roles, active selections, success, or counts.

## 4. Destructive / error = red

Use `var(--app-danger)` for:
- destructive actions;
- decline/reject/remove/delete states;
- errors and failed states.

## 5. Brand/title accent = gold

Use `var(--app-gold)` for HOOMA brand/title emphasis, eyebrows, and restrained decorative identity.

Gold is not a state color and must not replace green, people blue, orange, or red when the UI communicates status.

## Implementation rule

Shared semantic tokens live in `apps/web/src/theme.css`. Feature CSS should reference those tokens instead of inventing new state colors. Existing feature-specific aliases may remain temporarily for compatibility, but new active/success/member/warning/error rules should use the shared tokens directly.

## 6. Readable text roles

HOOMA uses warm text roles on dark surfaces. Descriptions must not drift into cold blue-grey or washed-out disabled-looking grey.

- Primary titles and important labels: `#F5F4EF` or `#F7F7F7`.
- Descriptions and supporting body copy: `#D8D4CA`.
- Lower-priority metadata: `#B8B5AD`.
- Placeholder and genuinely de-emphasized content: `#858780`.

Descriptions should read as a soft warm beige/silver-beige against the near-black surface. People blue remains an identity/membership semantic color and must not be reused for ordinary descriptive copy.

Typography hierarchy should come mainly from size, weight, spacing, grouping, and position rather than making important text hard to read.

Canonical mobile baselines remain:

```css
--hooma-ui-page-title: 24px;
--hooma-ui-section-title: 20px;
--hooma-ui-card-title: 17px;
--hooma-ui-body: 16px;
--hooma-ui-body-large: 17px;
--hooma-ui-meta: 14px;
--hooma-ui-eyebrow: 12px;
--hooma-ui-readable-min: 12px;
```

The 12px token is a hard readability floor, not the normal description size. Ordinary descriptions should normally use the 16px body baseline, with 17px available for larger/expanded body copy. Do not shrink meaningful descriptions below 12px to fit a screen.

## 7. Structural outlines, cards, and readable sizing

Normal HOOMA containers/cards use the shared near-black/graphite foundation:

```css
--hooma-ui-bg: #050605;
--hooma-ui-surface: #0b0c0a;
--hooma-ui-surface-raised: #0e0f0d;
--hooma-ui-outline: rgba(190, 180, 145, 0.22);
--hooma-ui-radius-card: 18px;
```

The normal card language is:

```css
.hooma-ui-card {
  background: var(--hooma-ui-surface);
  border: 1px solid var(--hooma-ui-outline);
  border-radius: var(--hooma-ui-radius-card);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}
```

The outline should almost disappear against the card surface. Do not use thick brown-gold borders, container glow, green structural borders, inner gold rings, or bevel effects.

Readable shared sizing tokens are:

```css
--hooma-ui-page-inline: 16px;
--hooma-ui-card-padding: 16px;
--hooma-ui-card-gap: 16px;
--hooma-ui-section-gap: 20px;
--hooma-ui-control-min-height: 48px;
--hooma-ui-touch-target: 48px;
```

These are foundation baselines, not fixed one-phone dimensions. Feature layouts may need more height or width according to their real content, but they should not solve space pressure by shrinking typography, controls, cards, or touch targets below readable sizes.

Mobile pages are expected to scroll. When substantial information is present, make the page or card taller instead of compressing the content. Horizontal scrolling is appropriate for repeatable rails such as categories, dates, featured cards, and similar multi-item presentation where it preserves readability.

The preferred result is the same across Home, Play, Watch, Requests, Teams, Gear Up, Ride, Places, Athletes, Profile, Coach, Settings, Admin, Pitch, and other HOOMA surfaces: readable cards with comfortable spacing, warm descriptive text, subtle structure, and one consistent visual system.
