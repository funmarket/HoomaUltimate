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

## 6. Readable descriptive copy = `#F7F7F7`

Important descriptive/body copy on dark HOOMA surfaces uses `#F7F7F7` unless a stronger semantic state color is required. This applies especially to Requests, FundMe and Donations card descriptions, detail descriptions, form helper copy that carries meaningful information, and other user-facing descriptive text.

Do not use dim grey such as `#AAA9A4` for primary descriptive content. Metadata may use lower emphasis when contrast remains accessible, but hierarchy must come mainly from size/weight/layout rather than making core text hard to read.

## 7. Structural outlines and Help cards

Normal Help containers/cards use a 1px structural outline. The current target token is:

```css
--hooma-ui-outline: rgba(190, 180, 145, 0.22);
```

The outline should almost disappear against the graphite/near-black card surface. Do not use thick brown-gold borders, container glow, or green as a structural border. Green remains active/status/action emphasis.

Help surfaces are scrollable. Do not shrink readable typography or card geometry merely to fit more cards above the fold. Horizontal rails are appropriate for quick taxonomy/filter controls and selected embedded card rails where specified.

