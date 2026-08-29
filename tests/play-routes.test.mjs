import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Web preserves mature Play/Event route surfaces", async () => {
  const router = await readFile("apps/web/src/app/router/HoomaRouter.tsx", "utf8");
  for (const route of [
    'path="/play"',
    'path="/events/new"',
    'path="/events/:eventId/formation"',
    'path="/events/:eventId/chat"',
    'path="/events/:eventId/check-in"',
  ]) {
    assert.match(router, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Play owns listing-based action orchestration without taking lifecycle persistence", async () => {
  const [playClient, playRoutes, teamRoutes, teamLifecycle] = await Promise.all([
    readFile("packages/frontend/src/events/play-api.ts", "utf8"),
    readFile("apps/api/src/modules/play/http/play.routes.ts", "utf8"),
    readFile("apps/api/src/modules/teams/http/team.routes.ts", "utf8"),
    readFile(
      "apps/api/src/modules/teams/infrastructure/prisma-team-lifecycle.repository.ts",
      "utf8",
    ),
  ]);

  assert.match(playClient, /\/api\/public\/v1\/play\/player-listings/);
  assert.match(playClient, /\/api\/v1\/play\/player-actions/);
  assert.match(playClient, /\/api\/v1\/play\/managed-events/);
  assert.match(playRoutes, /player-listings\/:listingId\/team-offer/);
  assert.match(playRoutes, /player-listings\/:listingId\/event-invite/);
  assert.doesNotMatch(teamRoutes, /\/:teamId\/offers/);
  assert.doesNotMatch(teamLifecycle, /playPlayerListing/);
  assert.doesNotMatch(playClient, /@hooma\/database|@prisma\/client/);
});
