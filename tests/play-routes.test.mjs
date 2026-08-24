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

test("Play frontend uses public discovery and member action endpoints", async () => {
  const client = await readFile("packages/frontend/src/events/api.ts", "utf8");
  assert.match(client, /\/api\/public\/v1\/events\?type=PLAY/);
  assert.match(client, /\/api\/v1\/events/);
  assert.doesNotMatch(client, /@hooma\/database|@prisma\/client/);
});
