import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Play presents Players and Open matches as sibling local views", async () => {
  const [page, css, router] = await Promise.all([
    read("packages/frontend/src/events/PlayPage.tsx"),
    read("packages/frontend/src/events/play.css"),
    read("apps/web/src/app/router/HoomaRouter.tsx"),
  ]);

  assert.match(page, /type PlayView = "players" \| "open-matches";/);
  assert.match(page, /useState<PlayView>\("players"\)/);
  assert.match(page, /className="play-view-tabs" role="tablist" aria-label="Play sections"/);
  assert.match(page, />\s*Players\s*<\/button>/);
  assert.match(page, />\s*Open matches\s*<\/button>/);
  assert.match(page, /aria-selected=\{activeView === "players"\}/);
  assert.match(page, /aria-selected=\{activeView === "open-matches"\}/);
  assert.match(page, /hidden=\{activeView !== "players"\}/);
  assert.match(page, /hidden=\{activeView !== "open-matches"\}/);
  assert.match(
    css,
    /\.play-view-tabs\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s,
  );
  assert.match(css, /\.play-view-tab\.is-active\s*\{/);
  assert.match(router, /path="\/play" element=\{<PlayPage \/>\}/);
  assert.doesNotMatch(router, /path="\/play\/(?:players|open-matches)"/);
});
