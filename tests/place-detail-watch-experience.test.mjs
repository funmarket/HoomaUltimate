import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Place detail uses canonical Watch event context for ticket, RSVP and share actions", () => {
  const detail = source("packages/frontend/src/places/PlaceDetailPage.tsx");

  assert.match(detail, /new URLSearchParams\(window\.location\.search\)\.get\("eventId"\)/);
  assert.match(detail, /<WatchTicket event=\{selectedEvent\} variant="place-detail" \/>/);
  assert.match(detail, /eventsApi\.myRsvp\(eventId\)/);
  assert.match(detail, /eventsApi\.join\(selectedEventId\)/);
  assert.match(detail, /eventsApi\.cancelRsvp\(selectedEventId\)/);
  assert.match(detail, /navigator\.share/);
  assert.match(detail, /Share event/);
  assert.match(detail, /Join event/);
  assert.match(detail, /selectedEvent\.venueAuthority === "OFFICIAL_VENUE"/);
});

test("Place detail ticket reuses WatchTicket without repeating the stacked Place photo", () => {
  const ticket = source("packages/frontend/src/watch/WatchTicket.tsx");

  assert.match(ticket, /export type WatchTicketVariant = "feed" \| "place-detail"/);
  assert.match(ticket, /variant = "feed"/);
  assert.match(ticket, /const feedVariant = variant === "feed"/);
  assert.match(ticket, /\{feedVariant \? \(/);
  assert.match(ticket, /className="watch-ticket__photo-panel"/);
  assert.doesNotMatch(ticket, /watch-ticket__place-photo/);
  assert.match(ticket, /className=\{`watch-ticket watch-ticket--\$\{variant\}`\}/);
});

test("Place detail uses the shared HOOMA icon source and rich Watch presentation", () => {
  const detail = source("packages/frontend/src/places/PlaceDetailPage.tsx");
  const icons = source("packages/frontend/src/ui/HoomaIcons.tsx");
  const css = source("packages/frontend/src/places/places.css");

  assert.match(detail, /from "\.\.\/ui\/HoomaIcons"/);
  assert.doesNotMatch(detail, /function CalendarIcon|function PinIcon|function UsersIcon/);

  for (const icon of [
    "CalendarIcon",
    "PinIcon",
    "PhoneIcon",
    "InfoIcon",
    "MenuIcon",
    "UsersIcon",
    "ShareIcon",
    "ChevronRightIcon",
  ]) {
    assert.match(detail, new RegExp(icon));
    assert.match(icons, new RegExp(`export function ${icon}`));
  }

  assert.match(detail, /place-info-card__action/);
  assert.match(detail, /View on map/);
  assert.match(detail, /View full menu/);
  assert.match(detail, /Upcoming watch events at this place/);
  assert.match(detail, /place-event-row__date/);
  assert.match(detail, /event\.watchDetails\.teamOneName/);
  assert.match(detail, /event\.watchDetails\.teamTwoName/);

  assert.match(css, /\.place-watch-action--primary/);
  assert.match(css, /\.place-watch-action--secondary/);
  assert.match(css, /\.place-info-grid\s*\{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.place-menu-preview\s*\{[\s\S]*?display:\s*grid/);
  assert.doesNotMatch(css, /\.place-menu-preview\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(css, /\.place-event-row\s*\{[\s\S]*?display:\s*grid/);
});

test("Place detail keeps a proportional mobile composition instead of giant stacked panels", () => {
  const css = source("packages/frontend/src/places/places.css");
  const mobile = css.match(/@media \(max-width: 520px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.place-detail-hero\s*\{[\s\S]*?40%/);
  assert.match(mobile, /\.place-detail-hero\s*\{[\s\S]*?41%/);
  assert.match(mobile, /\.place-info-grid\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(mobile, /\.place-menu-preview\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(mobile, /\.place-event-row__time/);
  assert.match(mobile, /\.place-event-row__teams/);
  assert.doesNotMatch(mobile, /\.place-info-grid\s*\{[\s\S]*?grid-template-columns:\s*1fr\s*;/);
});

test("Place detail keeps owner management contextual instead of a dominant danger zone", () => {
  const detail = source("packages/frontend/src/places/PlaceDetailPage.tsx");
  const places = source("packages/frontend/src/places/PlacesPages.tsx");

  assert.match(places, /export \{ PlaceDetailPage \} from "\.\/PlaceDetailPage"/);
  assert.doesNotMatch(places, /function PlaceDetailPage/);
  assert.match(detail, /<details className="place-owner-tools">/);
  assert.match(detail, /href=\{`\/places\/\$\{place\.id\}\/edit`\}/);
  assert.match(detail, /management\.places\.archive\(placeId\)/);
  assert.doesNotMatch(detail, /className="entity-danger-zone place-danger-zone"/);
});

test("Place detail map action keeps coordinates optional", () => {
  const detail = source("packages/frontend/src/places/PlaceDetailPage.tsx");

  assert.match(detail, /place\.latitude != null && place\.longitude != null/);
  assert.match(detail, /\[place\.address, place\.houma, place\.city\]\.filter\(Boolean\)/);
  assert.match(detail, /google\.com\/maps\/search/);
});

test("temporary Place formatter does not remain in the final source tree", () => {
  assert.equal(
    existsSync(new URL("../.github/workflows/tmp-place-detail-format.yml", import.meta.url)),
    false,
  );
});
