import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Team lineup keeps normalized slot coordinates and live player identity", async () => {
  const source = await read("packages/frontend/src/teams/TeamLineupPitch.tsx");
  assert.match(source, /displayName/);
  assert.match(source, /left: `\$\{slot\.x\}%`/);
  assert.match(source, /top: `\$\{slot\.y\}%`/);
  assert.match(source, /<em>\{slot\.position\}<\/em>/);
});

test("Team lineup presentation uses the HOOMA stadium treatment and canonical UI tokens", async () => {
  const [source, css] = await Promise.all([
    read("packages/frontend/src/teams/TeamLineupPitch.tsx"),
    read("packages/frontend/src/teams/TeamLineupPitch.css"),
  ]);

  assert.match(css, /lineup-stadium\.webp/);
  assert.match(css, /var\(--hooma-ui-surface\)/);
  assert.match(css, /var\(--hooma-ui-outline\)/);
  assert.doesNotMatch(css, /--tlp-(cream|muted|gold|lime|white)/);
  assert.doesNotMatch(source, /team-lineup-player-glow/);
  assert.doesNotMatch(
    source,
    /team-lineup-floodlight|team-lineup-goal|team-lineup-center-circle|team-lineup-center-spot/,
  );
  assert.match(source, /className="team-lineup-player-layer"/);
  assert.match(css, /\.team-lineup-player-layer/);
});

test("Team lineup status distinguishes published lineups from drafts", async () => {
  const source = await read("packages/frontend/src/teams/TeamLineupPitch.tsx");
  assert.match(source, /lineup\?\.published/);
  assert.match(source, /Published/i);
  assert.match(source, /Draft/i);
});
