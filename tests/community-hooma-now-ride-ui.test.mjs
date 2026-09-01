import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hoomaPage = await readFile("packages/frontend/src/communities/HoomaPage.tsx", "utf8");
const hoomaNowSection = await readFile(
  "packages/frontend/src/discovery/HoomaNowSection.tsx",
  "utf8",
);
const hoomaNowCss = await readFile("packages/frontend/src/discovery/hooma-now.css", "utf8");

test("Community detail composes Ride requests into the canonical HOOMA NOW surface", () => {
  assert.match(hoomaPage, /CommunityHoomaNowSection/);
  assert.match(hoomaNowSection, /export function CommunityHoomaNowSection/);
  assert.match(hoomaNowSection, /createRideApi\(transport\)/);
  assert.match(hoomaNowSection, /listCommunityRequests\(communityId/);
  assert.match(hoomaNowSection, /HoomaNowFeed/);
  assert.doesNotMatch(hoomaPage, /Community Ride Requests/);
  assert.doesNotMatch(hoomaPage, /HoomaNowCommunityCopy|CommunityRideFeed|SecondHoomaNowFeed/);
});

test("Community HOOMA NOW Ride cards preserve canonical request IDs and live expiry filtering", () => {
  assert.match(hoomaNowSection, /ride-request-\$\{item\.id\}/);
  assert.match(hoomaNowSection, /item\.href/);
  assert.match(hoomaNowSection, /NEEDS A RIDE/);
  assert.match(hoomaNowSection, /filterLiveRideItems/);
  assert.match(hoomaNowSection, /expiresAt/);
  assert.match(hoomaNowSection, /window\.setTimeout/);
});

test("Community HOOMA NOW Ride card styling stays inside canonical feed classes", () => {
  assert.match(hoomaNowCss, /\.hooma-now-card__ride-meta/);
  assert.match(hoomaNowCss, /\.hooma-now-card__ride-expiry/);
  assert.doesNotMatch(hoomaNowCss, /!important/);
});
