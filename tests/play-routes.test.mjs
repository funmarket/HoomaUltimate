import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Web preserves mature Play/Event route surfaces", async () => {
  const main = await readFile("apps/web/src/main.tsx", "utf8");
  for (const route of ["/play", "/events/new", "/formation", "/chat", "/check-in"]) assert.match(main, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Play frontend uses public discovery and member action endpoints", async () => {
  const client = await readFile("apps/web/src/api/event-client.ts", "utf8");
  assert.match(client, /\/api\/public\/v1\/events\?type=PLAY/);
  assert.match(client, /\/api\/v1\/events/);
  assert.doesNotMatch(client, /@hooma\/database|@prisma\/client/);
});
