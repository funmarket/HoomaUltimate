import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Team published lineup uses the canonical stadium presentation without changing data wiring", async () => {
  const [detailPage, pitch, css, manager] = await Promise.all([
    read("packages/frontend/src/teams/TeamDetailPage.tsx"),
    read("packages/frontend/src/teams/TeamLineupPitch.tsx"),
    read("packages/frontend/src/teams/TeamLineupPitch.css"),
    read("packages/frontend/src/teams/TeamLineupManager.tsx"),
  ]);

  await access(
    new URL("../apps/web/public/football/hooma-stadium-lineup.webp", import.meta.url),
  );

  assert.match(detailPage, /const publishedLineup = team\?\.lineups\?\.\[0\] \?\? null/);
  assert.match(detailPage, /teamName=\{team\.name\}[\s\S]*lineup=\{publishedLineup\}[\s\S]*roster=\{team\.players\}/);
  assert.match(detailPage, /className="team-profile-lineup-section"/);
  assert.doesNotMatch(
    detailPage,
    /<section className="panel">[\s\S]*<h2>Published lineup<\/h2>[\s\S]*<TeamLineupPitch/,
  );

  assert.match(pitch, /presentation\?\.photoUrl/);
  assert.match(pitch, /<img src=\{photoUrl\} alt="" \/>/);
  assert.match(pitch, /left: `\$\{slot\.x\}%`/);
  assert.match(pitch, /top: `\$\{slot\.y\}%`/);
  assert.match(pitch, /lineup\?\.published/);
  assert.doesNotMatch(pitch, /team-lineup-floodlight/);
  assert.doesNotMatch(pitch, /team-lineup-goal-top/);
  assert.doesNotMatch(pitch, /team-lineup-goal-bottom/);
  assert.doesNotMatch(pitch, /team-lineup-center-circle/);
  assert.doesNotMatch(pitch, /team-lineup-center-spot/);
  assert.doesNotMatch(pitch, /team-lineup-player-glow/);

  assert.match(css, /\/football\/hooma-stadium-lineup\.webp/);
  assert.match(css, /var\(--hooma-ui-surface\)/);
  assert.match(css, /var\(--hooma-ui-outline\)/);
  assert.match(css, /var\(--hooma-ui-text\)/);
  assert.match(css, /var\(--hooma-ui-text-meta\)/);
  assert.match(css, /var\(--hooma-ui-accent\)/);
  assert.doesNotMatch(css, /--tlp-(?:cream|muted|gold|lime|white)/);
  assert.doesNotMatch(css, /rgba\(181,\s*155,\s*87,\s*0\.46\)/);
  assert.doesNotMatch(css, /team-lineup-player-glow/);

  assert.match(
    manager,
    /<TeamLineupPitch[\s\S]*teamName=\{team\.name\}[\s\S]*lineup=\{previewLineup\}[\s\S]*roster=\{roster\}/,
  );
});
