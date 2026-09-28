import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Team lineup keeps normalized slot coordinates inside a dedicated player layer", async () => {
  const [source, css] = await Promise.all([
    read("packages/frontend/src/teams/TeamLineupPitch.tsx"),
    read("packages/frontend/src/teams/TeamLineupPitch.css"),
  ]);

  assert.match(source, /className="team-lineup-player-layer"/);
  assert.match(source, /left: `\$\{slot\.x\}%`/);
  assert.match(source, /top: `\$\{slot\.y\}%`/);
  assert.match(css, /\.team-lineup-player-layer\s*\{/);
  assert.match(css, /position:\s*absolute;/);
});

test("Team lineup preserves intentional empty slots without duplicating their position label", async () => {
  const source = await read("packages/frontend/src/teams/TeamLineupPitch.tsx");

  assert.match(source, /const isEmptySlot = slot\.teamPlayerId === null;/);
  assert.doesNotMatch(
    source,
    /rosterPlayer\?\.user\.presentation\?\.username\s*\?\?\s*slot\.position/,
  );
  assert.match(source, /<b>\{slot\.sortOrder \+ 1\}<\/b>/);
  assert.match(source, /<em>\{slot\.position\}<\/em>/);
});

test("Team lineup distinguishes resolved players from unresolved assigned slots", async () => {
  const source = await read("packages/frontend/src/teams/TeamLineupPitch.tsx");

  assert.match(source, /const isUnresolvedSlot = Boolean\(slot\.teamPlayerId\) && !rosterPlayer;/);
  assert.match(source, /photoUrl \? <img/);
  assert.match(source, /Unavailable player/);
  assert.match(source, /team-lineup-player--unresolved/);
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
});

test("Team lineup protects formation markers on narrow viewports", async () => {
  const css = await read("packages/frontend/src/teams/TeamLineupPitch.css");

  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /\.team-lineup-field\s*\{[\s\S]*?min-height:\s*24rem;/);
  assert.match(css, /\.team-lineup-player-layer\s*\{[\s\S]*?inset:/);
});

test("Team lineup status distinguishes published lineups from drafts", async () => {
  const source = await read("packages/frontend/src/teams/TeamLineupPitch.tsx");

  assert.match(source, /lineup\?\.published/);
  assert.match(source, /Published/);
  assert.match(source, /Draft/);
  assert.match(source, /Awaiting lineup/);
});
