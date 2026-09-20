/**
 * Generic glyphs for the account menu surface.
 *
 * These are presentation assets only: no icon here implies an owning domain, and the
 * application shell decides which glyph represents which destination.
 */

export function AccountMenuUserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function AccountMenuShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.6 2.9 8.3 7 10 4.1-1.7 7-5.4 7-10V6l-7-3Z" />
      <path d="m9.5 12 1.7 1.7 3.5-4" />
    </svg>
  );
}

export function AccountMenuSettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19 13.5v-3l-2.1-.7a7.8 7.8 0 0 0-.8-1.9l1-2-2.1-2.1-2 1a7.8 7.8 0 0 0-1.9-.8L10.5 2h-3l-.7 2.1a7.8 7.8 0 0 0-1.9.8l-2-1L.8 6l1 2a7.8 7.8 0 0 0-.8 1.9L-1 10.5v3l2.1.7a7.8 7.8 0 0 0 .8 1.9l-1 2L3 20.2l2-1a7.8 7.8 0 0 0 1.9.8l.7 2.1h3l.7-2.1a7.8 7.8 0 0 0 1.9-.8l2 1 2.1-2.1-1-2a7.8 7.8 0 0 0 .8-1.9l1.9-.7Z"
        transform="translate(2) scale(.83)"
      />
    </svg>
  );
}

export function AccountMenuWhistleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h8a4 4 0 0 1 0 8H9a4 4 0 0 1-4-4v-4Z" />
      <path d="M13 12V8h6v4" />
    </svg>
  );
}

export function AccountMenuChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}
