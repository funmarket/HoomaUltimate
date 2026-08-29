import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { placeUpdateSchema } from "../packages/contracts/src/places.ts";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function cssRule(css, selector) {
  const marker = `${selector} {`;
  const start = css.indexOf(marker);
  if (start < 0) return "";
  const bodyStart = start + marker.length;
  const bodyEnd = css.indexOf("\n}", bodyStart);
  return bodyEnd < 0 ? "" : css.slice(bodyStart, bodyEnd);
}

test("Watch page exposes only the four product functions and no business onboarding", () => {
  const watch = source("packages/frontend/src/watch/WatchPage.tsx");
  for (const label of ["Events", "Spots", "Create Event", "Add a Place"]) {
    assert.match(watch, new RegExp(`>\\s*${label}\\s*<`));
  }
  assert.doesNotMatch(watch, />\s*Places\s*</);
  assert.doesNotMatch(
    watch,
    /PlaceCapabilityOnboarding|Apply for Watch|Verify Place ownership|BUSINESS OWNER/,
  );
  assert.equal(
    existsSync(new URL("../packages/frontend/src/watch/watch-business.css", import.meta.url)),
    false,
  );
});

test("Watch Spots reuse canonical Places and exclude canonical Pitch capabilities", () => {
  const places = source("packages/frontend/src/places/PlacesPages.tsx");
  assert.match(places, /<h1>Spots<\/h1>/);
  assert.match(places, /pitchApi\.list\(\)/);
  assert.match(places, /pitchPlaceIds/);
  assert.match(places, /!pitchPlaceIds\.has\(place\.id\)/);
  assert.match(places, />\s*Events\s*</);
  assert.match(places, />\s*Spots\s*</);
  assert.match(places, /href="\/events\/new\?type=WATCH&kind=MATCH"/);
  assert.match(places, /href="\/places\/new"/);
  assert.doesNotMatch(places, /SpotService|SpotRepository|SpotVenue/);
});

test("Watch capability application routes and service wiring are gone", () => {
  const container = source("apps/api/src/bootstrap/container.ts");
  const memberRouter = source("apps/api/src/http/v1/router.ts");
  const publicRouter = source("apps/api/src/http/public-v1/router.ts");
  const adminRoutes = source("apps/api/src/modules/platform-admin/http/platform-admin.routes.ts");
  assert.doesNotMatch(container, /watchService|PlaceCapabilityService\(\s*["']WATCH/);
  assert.doesNotMatch(memberRouter, /watchService|\/watch.*application/);
  assert.doesNotMatch(publicRouter, /watchService/);
  assert.doesNotMatch(adminRoutes, /queues\/watch|watch\.pending|watch\.review/);
});

test("Prisma keeps canonical Place and Event ownership while storing details below them", () => {
  const schema = source("packages/database/prisma/schema.prisma");
  assert.match(schema, /enum PlaceCapabilityKind \{\s*PITCH\s*\}/s);
  assert.doesNotMatch(schema, /REVIEW_WATCH_APPLICATIONS/);
  assert.doesNotMatch(schema, /model WatchVenue|model WatchBusiness|model WatchEvent\s*\{/);
  assert.match(schema, /model Event \{[\s\S]*?placeId\s+String\?/);
  assert.match(schema, /model Event \{[\s\S]*?watchDetails\s+WatchEventDetails\?/);
  assert.match(schema, /model Place \{[\s\S]*?menuItems\s+PlaceMenuItem\[\]/);
  assert.match(schema, /model Place \{[\s\S]*?archivedAt\s+DateTime\?/);
  assert.match(schema, /model WatchEventDetails \{[\s\S]*?eventId\s+String\s+@id/);
});

test("Place coordinates stay optional and update defaults stay out of partial PATCH fields", () => {
  const contracts = source("packages/contracts/src/places.ts");
  assert.match(
    contracts,
    /latitude: z\.number\(\)\.min\(-90\)\.max\(90\)\.optional\(\)\.nullable\(\)/,
  );
  assert.match(
    contracts,
    /longitude: z\.number\(\)\.min\(-180\)\.max\(180\)\.optional\(\)\.nullable\(\)/,
  );
  assert.match(
    contracts,
    /placeUpdateSchema[\s\S]*?omit\(\{ imageUrl: true, imageUrls: true, menuItems: true \}\)[\s\S]*?imageUrls: z\.array\(placeImageUrlSchema\)\.max\(4\)\.optional\(\)[\s\S]*?menuItems: z\.array\(placeMenuItemSchema\)\.max\(20\)\.optional\(\)/,
  );
});

test("Place partial updates preserve omitted images while explicit empty imageUrls clears them", () => {
  const partial = placeUpdateSchema.parse({ description: "Updated description" });
  assert.equal(partial.imageUrl, undefined);
  assert.equal(partial.imageUrls, undefined);

  const explicitClear = placeUpdateSchema.parse({ imageUrls: [] });
  assert.deepEqual(explicitClear.imageUrls, []);
});

test("Place Add and Edit share one branded form and management stays on canonical Place routes", () => {
  const places = source("packages/frontend/src/places/PlacesPages.tsx");
  const edit = source("packages/frontend/src/places/PlaceEditPage.tsx");
  const form = source("packages/frontend/src/places/PlaceForm.tsx");
  const routes = source("apps/api/src/modules/places/http/place.routes.ts");

  assert.match(places, /<PlaceForm/);
  assert.match(edit, /<PlaceForm/);
  assert.match(form, /Menu preview/);
  assert.match(form, /Use current location/);
  assert.match(form, /Latitude <em>optional<\/em>/);
  assert.match(form, /Longitude <em>optional<\/em>/);
  assert.match(routes, /\/:placeId\/manage/);
  assert.match(routes, /router\.patch\(\s*["']\/:placeId["']/);
  assert.match(routes, /router\.delete\(\s*["']\/:placeId["']/);
  assert.match(places, /Manage submitted Place/);
  assert.match(edit, /Delete Place/);
});

test("Watch Create and Edit share structured two-team matchup fields", () => {
  const contracts = source("packages/contracts/src/index.ts");
  const create = source("packages/frontend/src/events/CreateEventPage.tsx");
  const edit = source("packages/frontend/src/events/EditEventPage.tsx");
  const form = source("packages/frontend/src/events/WatchEventForm.tsx");
  const repository = source(
    "apps/api/src/modules/events/infrastructure/prisma-event.repository.ts",
  );

  for (const field of ["teamOneName", "teamOneLogoUrl", "teamTwoName", "teamTwoLogoUrl"]) {
    assert.match(contracts, new RegExp(field));
    assert.match(form, new RegExp(field));
    assert.match(repository, new RegExp(field));
  }
  assert.match(create, /<WatchEventForm/);
  assert.match(edit, /<WatchEventForm/);
  assert.match(edit, /api\.cancel\(event\.id\)/);
  assert.match(repository, /watchEventDetails\.create/);
  assert.match(repository, /watchEventDetails\.upsert/);
});

test("Watch Event errors use canonical Community, Place and manage boundaries", () => {
  const eventError = source("apps/api/src/modules/events/domain/event-error.ts");
  const errorHandler = source("apps/api/src/http/errors/error-handler.ts");

  assert.doesNotMatch(eventError, /WATCH_NOT_ENABLED/);
  assert.doesNotMatch(errorHandler, /WATCH_NOT_ENABLED/);
  for (const code of ["COMMUNITY_REQUIRED", "PLACE_REQUIRED", "EVENT_MANAGE_FORBIDDEN"]) {
    assert.match(eventError, new RegExp(code));
    assert.match(errorHandler, new RegExp(code));
  }
});

test("Watch collector ticket is shared, information-first and adaptively readable", () => {
  const watch = source("packages/frontend/src/watch/WatchPage.tsx");
  const ticket = source("packages/frontend/src/watch/WatchTicket.tsx");
  const ticketCss = source("packages/frontend/src/watch/watch.css");
  const placeDetail = source("packages/frontend/src/places/PlaceDetailPage.tsx");
  const placesCss = source("packages/frontend/src/places/places.css");
  const fitter = source("packages/frontend/src/ui/FitSingleLineText.tsx");

  assert.match(watch, /import \{ WatchTicket \} from "\.\/WatchTicket"/);
  assert.doesNotMatch(ticket, /WATCH_COLLECTOR_TICKET_MASTER/);
  assert.doesNotMatch(ticket, /watch-ticket__place-photo/);
  assert.match(ticket, /watch-ticket__upper/);
  assert.match(ticket, /watch-ticket__paper/);
  assert.match(ticket, /watch-ticket__details/);
  assert.match(ticket, /watch-ticket__photo-panel/);
  assert.match(ticket, /PinIcon/);
  assert.doesNotMatch(ticket, /CalendarIcon/);
  assert.match(ticket, /UsersIcon/);
  assert.match(ticket, /TeamMark name=\{matchup\.teamOneName\}/);
  assert.match(ticket, /TeamMark name=\{matchup\.teamTwoName\}/);
  assert.match(ticket, /FitSingleLineText/);
  assert.match(fitter, /ResizeObserver/);
  assert.match(ticket, /\/brand\/hooma-watch-stub\.webp/);
  assert.doesNotMatch(ticket, /watch-ticket__stub-date/);
  assert.doesNotMatch(ticket, /watch-ticket__stub-ball|<strong>HOOMA<\/strong>/);

  assert.match(
    ticketCss,
    /--watch-ticket-font-display:[\s\S]*?Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Narrow", sans-serif/,
  );
  assert.match(
    ticketCss,
    /--watch-ticket-font-condensed:[\s\S]*?"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif/,
  );

  const matchupRule = cssRule(ticketCss, ".watch-ticket__matchup");
  assert.doesNotMatch(matchupRule, /position:\s*absolute|top:|left:/);

  const teamNameRule = cssRule(ticketCss, ".watch-ticket__team-name");
  assert.match(teamNameRule, /font-weight:\s*950/);
  assert.match(teamNameRule, /white-space:\s*nowrap/);
  assert.doesNotMatch(teamNameRule, /text-overflow:\s*ellipsis|overflow-wrap:\s*anywhere/);

  const detailsRule = cssRule(ticketCss, ".watch-ticket__details");
  assert.match(
    detailsRule,
    /grid-template-columns:\s*minmax\(0, 1\.22fr\) minmax\(0, 0\.95fr\) minmax\(0, 0\.9fr\)/,
  );

  const dateRule = cssRule(ticketCss, ".watch-ticket__detail.watch-ticket__date");
  assert.match(dateRule, /grid-template-columns:\s*minmax\(0, 1fr\)/);

  const stubRule = cssRule(ticketCss, ".watch-ticket__stub");
  assert.match(stubRule, /grid-template-rows:\s*minmax\(0, 1fr\)/);
  assert.doesNotMatch(stubRule, /grid-template-rows:\s*minmax\(0, 1fr\) auto/);

  const stubLogoRule = cssRule(ticketCss, ".watch-ticket__stub-logo");
  assert.match(stubLogoRule, /width:\s*100%/);
  assert.match(stubLogoRule, /height:\s*100%/);
  assert.match(stubLogoRule, /object-fit:\s*contain/);
  assert.doesNotMatch(ticketCss, /\.watch-ticket__stub-date/);

  const photoRule = cssRule(ticketCss, ".watch-ticket__photo-panel");
  assert.match(photoRule, /width:\s*calc\(100% - clamp\(10px, 2cqw, 18px\)\)/);
  assert.match(photoRule, /aspect-ratio:\s*2 \/ 1/);
  assert.match(photoRule, /justify-self:\s*center/);
  assert.match(ticketCss, /\.watch-ticket__photo-panel img \{[\s\S]*?object-fit:\s*contain/);

  assert.match(ticket, /\/places\/\$\{place\.id\}\?eventId=/);
  assert.match(placeDetail, /<WatchTicket event=\{selectedEvent\} variant="place-detail" \/>/);
  assert.doesNotMatch(
    placesCss,
    /\.place-detail-page > \.watch-ticket--place-detail \.watch-ticket__(?:series|matchup|venue|date|going|status)/,
  );
});

test("archived Places stay off public Place and Watch discovery", () => {
  const placeRepository = source(
    "apps/api/src/modules/places/infrastructure/prisma-place.repository.ts",
  );
  const eventRepository = source(
    "apps/api/src/modules/events/infrastructure/prisma-event.repository.ts",
  );

  assert.match(placeRepository, /moderationStatus: "APPROVED", archivedAt: null/);
  assert.match(eventRepository, /moderationStatus: "APPROVED", archivedAt: null/);
});

test("PlaceImage is the only runtime Place image authority", () => {
  const canonicalPlace = source("apps/api/src/modules/places/boundary/canonical-place.persistence.ts");
  const placeRepository = source(
    "apps/api/src/modules/places/infrastructure/prisma-place.repository.ts",
  );
  const pitchRepository = source("apps/api/src/modules/pitch/infrastructure/prisma-pitch.repository.ts");

  assert.match(canonicalPlace, /type CanonicalPlaceImageRow/);
  assert.match(canonicalPlace, /function canonicalPlaceSummary/);
  assert.match(canonicalPlace, /function groupCanonicalPlaceImages/);
  assert.match(canonicalPlace, /imageUrl: publicImages\[0\]\?\.imageUrl \?\? null/);
  assert.doesNotMatch(canonicalPlace, /publicImages\[0\]\?\.imageUrl \?\? place\.imageUrl/);
  for (const repository of [placeRepository, pitchRepository]) {
    assert.match(repository, /this\.db\.placeImage\.findMany/);
    assert.match(repository, /canonicalPlaceSummary/);
    assert.doesNotMatch(repository, /\n  imageUrl: true,/);
  }
  assert.match(placeRepository, /groupCanonicalPlaceImages/);
  assert.match(pitchRepository, /groupCanonicalPlaceImages/);
});

test("Pitch rental pricing is canonical from contract through Prisma and repository", () => {
  const contracts = source("packages/contracts/src/pitch.ts");
  const schema = source("packages/database/prisma/schema.prisma");
  const repository = source("apps/api/src/modules/pitch/infrastructure/prisma-pitch.repository.ts");
  const migration = source(
    "packages/database/prisma/migrations/20260827112000_pitch_hourly_rental_pricing/migration.sql",
  );

  assert.match(contracts, /hourlyRateMinor: z\.number\(\)\.int\(\)\.min\(0\)/);
  assert.match(schema, /model PlaceCapabilityApplication \{[\s\S]*?hourlyRateMinor\s+Int\?/);
  assert.match(schema, /model PlaceCapabilityApplication \{[\s\S]*?currency\s+String\?/);
  assert.match(migration, /ADD COLUMN "hourlyRateMinor" INTEGER/);
  assert.match(migration, /ADD COLUMN "currency" VARCHAR\(3\)/);
  assert.match(repository, /hourlyRateMinor: input\.hourlyRateMinor/);
  assert.match(repository, /currency: input\.currency/);
  assert.doesNotMatch(repository, /\$executeRaw/);
});

test("Pitch owns its discovery page and does not live inside generic PlacesPages", () => {
  const pitch = source("packages/frontend/src/pitch/PitchPage.tsx");
  const ticket = source("packages/frontend/src/pitch/PitchTicket.tsx");
  const pitchCss = source("packages/frontend/src/pitch/pitch.css");
  const places = source("packages/frontend/src/places/PlacesPages.tsx");
  const entry = source("packages/frontend/src/index.ts");

  assert.match(pitch, /export function PitchPage/);
  assert.match(pitch, /import \{ PitchTicket \} from "\.\/PitchTicket"/);
  assert.match(pitch, /<PitchTicket item=\{item\} key=\{item\.id\} \/>/);
  assert.doesNotMatch(pitch, /pitch-rental-card/);
  assert.match(ticket, /hourlyRateMinor/);
  assert.match(ticket, /item\.place\.images\.map/);
  assert.match(pitchCss, /\.pitch-ticket__photo > img/);
  assert.doesNotMatch(pitchCss, /\.pitch-rental-card/);
  assert.doesNotMatch(places, /export function PitchPage/);
  assert.match(entry, /\.\/pitch\/PitchPage/);
  assert.match(entry, /\.\/pitch\/pitch\.css/);
});

test("temporary formatting workflow is not left in the final source tree", () => {
  assert.equal(
    existsSync(new URL("../.github/workflows/tmp-watch-place-format.yml", import.meta.url)),
    false,
  );
});
