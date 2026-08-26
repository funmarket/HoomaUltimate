import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Watch page exposes only the four product functions and no business onboarding", () => {
  const watch = source("packages/frontend/src/watch/WatchPage.tsx");
  for (const label of ["Events", "Places", "Create Event", "Add a Place"]) {
    assert.match(watch, new RegExp(`>${label}<`));
  }
  assert.doesNotMatch(
    watch,
    /PlaceCapabilityOnboarding|Apply for Watch|Verify Place ownership|BUSINESS OWNER/,
  );
  assert.equal(
    existsSync(new URL("../packages/frontend/src/watch/watch-business.css", import.meta.url)),
    false,
  );
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

test("Prisma keeps one Place and one Event path for Watch", () => {
  const schema = source("packages/database/prisma/schema.prisma");
  assert.match(schema, /enum PlaceCapabilityKind \{\s*PITCH\s*\}/s);
  assert.doesNotMatch(schema, /REVIEW_WATCH_APPLICATIONS/);
  assert.doesNotMatch(schema, /model WatchVenue|model WatchBusiness|model WatchEvent/);
  assert.match(schema, /model Event \{[\s\S]*?placeId\s+String\?/);
  assert.match(schema, /model Place \{[\s\S]*?events\s+Event\[\]/);
});

test("Watch uses one shared collector ticket component with canonical Place context", () => {
  const watch = source("packages/frontend/src/watch/WatchPage.tsx");
  const ticket = source("packages/frontend/src/watch/WatchTicket.tsx");
  const places = source("packages/frontend/src/places/PlacesPages.tsx");

  assert.match(watch, /import \{ WatchTicket \} from "\.\/WatchTicket"/);
  assert.match(ticket, /WATCH_COLLECTOR_TICKET_MASTER/);
  assert.match(ticket, /place\.imageUrl/);
  assert.match(ticket, /\/places\/\$\{place\.id\}\?eventId=/);
  assert.match(places, /<WatchTicket event=\{selectedEvent\} \/>/);
});
