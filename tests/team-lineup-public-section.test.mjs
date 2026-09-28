import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Published Team lineup keeps the canonical public source and avoids nested panel framing", async () => {
  const source = await read("packages/frontend/src/teams/TeamDetailPage.tsx");

  assert.match(source, /const publishedLineup = team\?\.lineups\?\.\[0\] \?\? null;/);
  assert.match(source, /className="team-profile-lineup-section"/);
  assert.match(
    source,
    /<TeamLineupPitch teamName=\{team\.name\} lineup=\{publishedLineup\} roster=\{team\.players\} \/>/,
  );
});
