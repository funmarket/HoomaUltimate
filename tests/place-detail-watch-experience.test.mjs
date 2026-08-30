import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Place detail uses canonical Watch event context for ticket, RSVP and share actions", () => {
  const detail = source("packages/frontend/src/places/PlaceDetailPage.tsx");

  assert.match(detail, /const query = new URLSearchParams\(window\.location\.search\)/);
  assert.match(detail, /const selectedEventId = query\.get\("eventId"\)/);
  assert.match(detail, /eventsApi\.publicDetail\(eventId\)/);
  assert.match(detail, /row\.type === "WATCH" && row\.placeId === placeId/);
  assert.match(detail, /<WatchTicket event=\{selectedEvent\} variant="place-detail" \/>/);
  assert.match(detail, /eventsApi\.myRsvp\(eventId\)/);
  assert.match(detail, /eventsApi\.join\(selectedEventId\)/);
  assert.match(detail, /eventsApi\.cancelRsvp\(selectedEventId\)/);
  assert.match(detail, /navigator\.share/);
  assert.match(detail, /Share event/);
  assert.match(detail, /Join event/);
  assert.match(detail, /selectedEvent\.publisherAuthority === "VERIFIED_PLACE_OWNER"/);
});

test("Place detail ticket reuses WatchTicket without stale local ticket geometry", () => {
  const ticket = source("packages/frontend/src/watch/WatchTicket.tsx");
  const css = source("packages/frontend/src/places/places.css");

  assert.match(ticket, /export type WatchTicketVariant = "feed" \| "place-detail"/);
  assert.match(ticket, /variant = "feed"/);
  assert.match(ticket, /const feedVariant = variant === "feed"/);
  assert.match(ticket, /\{feedVariant \? \(/);
  assert.match(ticket, /className="watch-ticket__photo-panel"/);
  assert.doesNotMatch(ticket, /watch-ticket__place-photo/);
  assert.match(ticket, /className=\{`watch-ticket watch-ticket--\$\{variant\}`\}/);
  assert.doesNotMatch(
    css,
    /\.place-detail-page > \.watch-ticket--place-detail \.watch-ticket__(?:series|matchup|venue|date|going|status)/,
  );
});

test("Place detail exposes canonical contact fields instead of hiding them behind phone", () => {
  const detail = source("packages/frontend/src/places/PlaceDetailPage.tsx");

  assert.match(detail, /place-info-card__secondary/);
  assert.match(detail, /\{place\.city\}/);
  assert.match(detail, /place-info-values/);
  assert.match(detail, /href=\{`tel:\$\{place\.phone\}`\}/);
  assert.match(detail, /href=\{`mailto:\$\{place\.email\}`\}/);
  assert.match(detail, /href=\{place\.websiteUrl\}/);
  assert.doesNotMatch(detail, /place\.phone \|\| place\.email \|\| "—"/);
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
  assert.match(detail, /Upcoming Watch events at this place/);
  assert.match(detail, /place-event-row__date/);

  assert.match(css, /\.place-watch-action--primary/);
  assert.match(css, /\.place-watch-action--secondary/);
  assert.match(css, /\.place-info-grid\s*\{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.place-menu-preview\s*\{[\s\S]*?display:\s*grid/);
  assert.doesNotMatch(css, /\.place-menu-preview\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(css, /\.place-event-row\s*\{[\s\S]*?display:\s*grid/);
});

test("Upcoming Place events show one colored fitted matchup instead of a duplicate white title", () => {
  const detail = source("packages/frontend/src/places/PlaceDetailPage.tsx");
  const css = source("packages/frontend/src/places/places.css");

  assert.match(detail, /const details = event\.watchDetails/);
  assert.match(detail, /const match = details\?\.kind === "MATCH" \? details : null/);
  assert.match(detail, /className="place-event-row__matchup"/);
  assert.match(detail, /text=\{match\.teamOneName\}/);
  assert.match(detail, /text=\{match\.teamTwoName\}/);
  assert.match(detail, /className="place-event-row__legacy-title"/);
  assert.doesNotMatch(detail, /<strong>\{event\.title\}<\/strong>/);
  assert.match(css, /\.place-event-row__team-name--one\s*\{[\s\S]*?color:\s*#4f91e8/);
  assert.match(css, /\.place-event-row__team-name--two\s*\{[\s\S]*?color:\s*#d95145/);
  assert.match(css, /\.place-event-row__matchup\s*\{[\s\S]*?grid-template-columns/);
  assert.doesNotMatch(css, /\.place-event-row__match > strong/);
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
  assert.match(detail, /placesApi\.archive\(placeId\)/);
  assert.doesNotMatch(detail, /className="entity-danger-zone place-danger-zone"/);
});

test("Place detail map action keeps coordinates optional", () => {
  const detail = source("packages/frontend/src/places/PlaceDetailPage.tsx");

  assert.match(detail, /place\.latitude != null && place\.longitude != null/);
  assert.match(detail, /\[place\.address, place\.houma, place\.city\]\.filter\(Boolean\)/);
  assert.match(detail, /google\.com\/maps\/search/);
});

test("Place detail first paint is independent from bounded Watch event pagination", () => {
  const api = source("packages/frontend/src/events/api.ts");
  const watch = source("packages/frontend/src/watch/WatchPage.tsx");
  const detail = source("packages/frontend/src/places/PlaceDetailPage.tsx");
  const routes = source("apps/api/src/modules/events/http/event.routes.ts");
  const repository = source(
    "apps/api/src/modules/events/infrastructure/prisma-event.repository.ts",
  );

  assert.match(api, /placeId\?: string/);
  assert.match(api, /params\.set\("placeId", query\.placeId\)/);
  assert.match(watch, /eventApi\.publicWatch\(\{ cursor: nextCursor \}\)/);
  assert.match(watch, /Load more events/);
  assert.match(detail, /const PLACE_EVENT_PAGE_SIZE = 20/);
  assert.match(
    detail,
    /placesApi\s*\.get\(placeId\)[\s\S]*?\.then\(\(row\) => setPlace\(row\)\)/,
  );
  assert.match(
    detail,
    /eventsApi\.publicWatch\(\{[\s\S]*?placeId,[\s\S]*?limit: PLACE_EVENT_PAGE_SIZE/,
  );
  assert.match(detail, /eventsApi\.publicDetail\(eventId\)/);
  assert.match(detail, /row\.type === "WATCH" && row\.placeId === placeId/);
  assert.match(detail, /setEventsNextCursor\(page\.nextCursor\)/);
  assert.match(detail, /loadPlaceEvents\(eventsNextCursor\)/);
  assert.match(detail, /Load more events/);
  assert.doesNotMatch(
    detail,
    /do\s*\{[\s\S]*?eventsApi\.publicWatch[\s\S]*?\}\s*while\s*\(cursor\)/,
  );
  assert.doesNotMatch(
    detail,
    /Promise\.all\(\[placesApi\.get\(placeId\),\s*loadPlaceEvents\(\)\]\)/,
  );
  assert.doesNotMatch(
    detail,
    /events\.find\(\(event\) => event\.id === selectedEventId\)/,
  );
  assert.match(routes, /request\.query\.placeId/);
  assert.match(repository, /input\.placeId \? \{ placeId: input\.placeId \} : \{\}/);
});

test("Watch and Place use BrowserRouter links for the internal place-event path", () => {
  const ticket = source("packages/frontend/src/watch/WatchTicket.tsx");
  const eventDetail = source("packages/frontend/src/events/EventDetailPage.tsx");
  const placeDetail = source("packages/frontend/src/places/PlaceDetailPage.tsx");

  assert.match(ticket, /import \{ Link \} from "react-router-dom"/);
  assert.match(
    ticket,
    /<Link[\s\S]*?className="watch-ticket__detail watch-ticket__venue"[\s\S]*?to=\{placeHref\}/,
  );
  assert.match(ticket, /<Link[\s\S]*?className="watch-ticket__photo-panel"[\s\S]*?to=\{placeHref\}/);
  assert.doesNotMatch(ticket, /<a[^>]+href=\{placeHref\}/);

  assert.match(eventDetail, /import \{ Link \} from "react-router-dom"/);
  assert.match(
    eventDetail,
    /<Link[\s\S]*?className="watch-event-detail__action watch-event-detail__action--place"[\s\S]*?to=\{`\/places\/\$\{event\.place\.id\}\?eventId=/,
  );

  assert.match(placeDetail, /<Link className="place-back-link" to="\/watch"/);
  assert.match(
    placeDetail,
    /<Link className="place-event-row" key=\{event\.id\} to=\{`\/events\/\$\{event\.id\}`\}/,
  );
});

test("temporary Place formatter does not remain in the final source tree", () => {
  assert.equal(
    existsSync(new URL("../.github/workflows/tmp-place-detail-format.yml", import.meta.url)),
    false,
  );
});
