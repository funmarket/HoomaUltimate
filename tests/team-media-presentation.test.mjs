import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Team media is rendered from the canonical badge and banner URLs", async () => {
  const [teamsPage, detailPage, discoveryCard, media, frontendIndex] = await Promise.all([
    read("packages/frontend/src/teams/TeamsPage.tsx"),
    read("packages/frontend/src/teams/TeamDetailPage.tsx"),
    read("packages/ui/src/teams/TeamDiscoveryCard.tsx"),
    read("packages/ui/src/teams/TeamMedia.tsx"),
    read("packages/frontend/src/index.ts"),
  ]);

  assert.match(teamsPage, /bannerUrl=\{team\.bannerUrl\}/);
  assert.match(discoveryCard, /readonly bannerUrl\?: string \| null/);
  assert.match(discoveryCard, /<TeamBanner name=\{name\} src=\{bannerUrl\}/);
  assert.match(discoveryCard, /<TeamBadge name=\{name\} src=\{badgeUrl\}/);
  assert.match(detailPage, /<TeamBanner name=\{team\.name\} src=\{team\.bannerUrl\}/);
  assert.match(detailPage, /<TeamBadge name=\{team\.name\} src=\{team\.badgeUrl\}/);
  assert.match(media, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(frontendIndex, /import "\.\/teams\/team-media\.css"/);
});
