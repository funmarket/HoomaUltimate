# HOOMA app-wide semantic color rules

Status: **ACTIVE VISUAL SEMANTICS — RECONCILED 2026-09-22**

These rules are product semantics, not decoration. Feature CSS chooses color by meaning before choosing a component-specific accent.

## 1. Dark-mode canvas and surfaces

The app-wide dark-mode page canvas is **pitch black**. Do not use navy or blue-black as the primary page background.

Use neutral graphite/near-black surfaces to create elevation. Content imagery, team crests, tickets and media provide most of the visual color.

Accent colors are normally expressed as text/ink, icon, keyline, focus, selected indicator or restrained tint. Large filled accent slabs are not the default HOOMA interaction language.

## 2. Positive / healthy / confirmed = green

Use `var(--app-positive)` for:

- success confirmations;
- healthy/positive state;
- approve/accepted/joined/available state;
- positive counters where a semantic positive signal is required;
- active/selected indicators when green is the correct semantic signal.

Green does **not** require a solid green button/card background. Prefer restrained keyline/icon/text/tint treatment unless a specific approved component calls for a stronger fill.

Do not use orange or gold to communicate successful/healthy state.

## 3. People identity and football/system accent = blue

Use `var(--app-people-blue)` for people/identity emphasis where needed and as a restrained football/system accent for navigation, links, selected keylines and Requests presentation.

Blue may identify a domain or interaction, but it must not replace the pitch-black dark canvas.

The current HOOMA people-blue token is `#58BFFF` in dark mode with an accessible darker equivalent in light mode.

## 4. Warning / attention = orange

Use `var(--app-warning)` for warnings, caution and attention-required states.

Orange must not become the default color for member roles, success or general navigation.

## 5. Destructive / error = red

Use `var(--app-danger)` for destructive actions, rejection/removal/delete, errors and failed states.

## 6. Brand / heritage / premium micro-accent = gold

Use `var(--app-gold)` sparingly for HOOMA heritage/title eyebrows, premium/special labels, specialty artifacts and controlled decorative emphasis.

Gold is not a general state color and is not the default button/card fill. It must not replace green, blue, orange or red when those colors communicate state.

## 7. Light mode

Light mode is a deliberate visual system, not a literal inversion:

- soft light-gray app canvas;
- white grouped/raised surfaces;
- deep graphite text;
- quiet gray borders;
- darker readable versions of semantic blue/green/orange/red/gold.

Avoid neon slabs and large filled accent backgrounds in light mode as well.

## 8. Requests card exception

The approved Requests display card is intentionally more poster-like than a normal settings/list surface. It may use stronger electric-blue and yellow/gold accents over a black/graphite card, while the app/page canvas remains pitch black.

The accent treatment still must not invent fake data or become a second page-wide color system.

## Implementation rule

Shared semantic tokens live in `apps/web/src/theme.css`. Feature CSS should reference those tokens instead of inventing new state colors. Existing feature-specific aliases may remain temporarily for compatibility, but new active/success/member/warning/error rules should use the shared semantic tokens directly.
