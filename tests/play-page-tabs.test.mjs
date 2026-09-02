import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Play presents Games, Players, and Mine as sibling local views", async () => {
  const [page, router] = await Promise.all([
    read("packages/frontend/src/events/PlayPage.tsx"),
    read("apps/web/src/app/router/HoomaRouter.tsx"),
  ]);

  assert.match(page, /type PlayView = "games" \| "players" \| "mine";/);
  assert.match(page, /useState<PlayView>\("games"\)/);
  assert.match(
    page,
    /className="play-view-tabs play-view-tabs--three" role="tablist" aria-label="Play sections"/,
  );
  assert.match(page, />\s*Games\s*<\/button>/);
  assert.match(page, />\s*Players\s*<\/button>/);
  assert.match(page, />\s*Mine\s*<\/button>/);
  assert.match(page, /aria-selected=\{activeView === "games"\}/);
  assert.match(page, /aria-selected=\{activeView === "players"\}/);
  assert.match(page, /aria-selected=\{activeView === "mine"\}/);
  assert.match(
    page,
    /\{activeView === "games" \? \(\s*<section className="play-section" aria-labelledby="open-matches-title">/s,
  );
  assert.match(
    page,
    /\{activeView === "players" \? \(\s*<section className="play-section" aria-labelledby="players-looking-title">/s,
  );
  assert.match(
    page,
    /\{activeView === "mine" \? \(\s*<section className="play-section play-mine" aria-labelledby="mine-title">/s,
  );
  assert.doesNotMatch(page, /hidden=\{activeView/);
  assert.match(router, /path="\/play" element=\{<PlayPage \/>\}/);
  assert.doesNotMatch(router, /path="\/play\/(?:games|players|mine|open-matches)"/);
});

test("Play detail and Open Matches use the authenticated Play API authority", async () => {
  const [detailPage, eventApi, playApi, rideDestinationFields] = await Promise.all([
    read("packages/frontend/src/events/EventDetailPage.tsx"),
    read("packages/frontend/src/events/api.ts"),
    read("packages/frontend/src/events/play-api.ts"),
    read("packages/frontend/src/rides/RideDestinationFields.tsx"),
  ]);

  assert.match(
    detailPage,
    /setEvent\(await eventApi\.publicDetail\(eventId\)\);[\s\S]*setEvent\(await playApi\.matchDetail\(eventId\)\);/,
  );
  assert.match(detailPage, /reason instanceof HoomaApiError && reason\.status === 401/);
  assert.doesNotMatch(eventApi, /publicPlay/);
  assert.match(playApi, /openMatches: \(query: OpenPlayMatchQuery = \{\}\)/);
  assert.match(playApi, /\/api\/v1\/play\/open-matches/);
  assert.match(playApi, /cursor/);
  assert.match(playApi, /matchDetail: \(eventId: string\)/);
  assert.match(playApi, /\/api\/v1\/play\/matches\/\$\{encodeURIComponent\(eventId\)\}/);
  assert.match(
    rideDestinationFields,
    /Promise\.all\(\[playApi\.openMatches\(\), eventApi\.publicWatch\(\)\]\)/,
  );
  assert.doesNotMatch(rideDestinationFields, /eventApi\.publicPlay/);
});
