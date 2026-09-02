import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hoomaPage = await readFile("packages/frontend/src/communities/HoomaPage.tsx", "utf8");
const hoomaNowSection = await readFile(
  "packages/frontend/src/discovery/HoomaNowSection.tsx",
  "utf8",
);
const hoomaNowFeed = await readFile("packages/ui/src/home/HoomaNowFeed.tsx", "utf8");
const hoomaNowCss = await readFile("packages/frontend/src/discovery/hooma-now.css", "utf8");
const interactionApi = await readFile(
  "packages/frontend/src/rides/community-interaction-api.ts",
  "utf8",
);
const sharedWhistleBoard = await readFile(
  "packages/frontend/src/whistle/HoomaWhistleBoard.tsx",
  "utf8",
);
const frontendApi = await readFile("packages/frontend/src/api.ts", "utf8");

test("Community detail composes Ride requests into the canonical HOOMA NOW surface", () => {
  assert.match(hoomaPage, /CommunityHoomaNowSection/);
  assert.match(hoomaNowSection, /export function CommunityHoomaNowSection/);
  assert.match(hoomaNowSection, /createRideApi\(transport\)/);
  assert.match(hoomaNowSection, /listCommunityRequests\(communityId/);
  assert.match(hoomaNowSection, /HoomaNowFeed/);
  assert.doesNotMatch(hoomaPage, /Community Ride Requests/);
  assert.doesNotMatch(hoomaPage, /HoomaNowCommunityCopy|CommunityRideFeed|SecondHoomaNowFeed/);
});

test("Community HOOMA NOW Ride cards expand the exact request instead of routing to Ride home", () => {
  assert.match(hoomaNowSection, /ride-request-\$\{item\.id\}/);
  assert.match(hoomaNowSection, /actionLabel:\s*"View ride request"/);
  assert.match(hoomaNowSection, /CommunityRideRequestExpansion/);
  assert.doesNotMatch(hoomaNowSection, /href:\s*item\.href/);
  assert.match(hoomaNowFeed, /expandedItemId/);
  assert.match(hoomaNowFeed, /item\.expansion/);
  assert.match(hoomaNowFeed, /aria-expanded/);
});

test("Community Ride expansion loads requester identity through an authorized Ride endpoint", () => {
  assert.match(hoomaNowSection, /getRideRequestCommunityInteraction/);
  assert.match(
    interactionApi,
    /\/api\/v1\/rides\/communities\/\$\{encodeURIComponent\(communityId\)\}\/requests/,
  );
  assert.match(interactionApi, /interaction/);
  assert.match(hoomaNowSection, /REQUESTED BY/);
  assert.match(hoomaNowSection, /requester\.displayName/);
  assert.match(hoomaNowSection, /\/profile\//);
});

test("Community Ride expansion uses the canonical exact Ride Whistle context", () => {
  assert.match(hoomaNowSection, /RideWhistleBoard/);
  assert.match(hoomaNowSection, /rideRequestId=\{item\.id\}/);
  assert.doesNotMatch(hoomaNowSection, /sendDirectUserWhistle/);
  assert.match(sharedWhistleBoard, /contextType="RIDE"/);
  assert.match(sharedWhistleBoard, /api\.whistles\.ride\(contextId\)/);
  assert.match(sharedWhistleBoard, /api\.whistles\.sendToRide\(contextId, body\)/);
  assert.match(
    frontendApi,
    /\/api\/v1\/whistles\/contexts\/RIDE\/\$\{encodeURIComponent\(rideRequestId\)\}/,
  );
  assert.doesNotMatch(frontendApi, /sendToRide[\s\S]*\/api\/v1\/whistles\/users\//);
});

test("Community HOOMA NOW Ride cards preserve canonical request IDs and live expiry filtering", () => {
  assert.match(hoomaNowSection, /ride-request-\$\{item\.id\}/);
  assert.match(hoomaNowSection, /Request ID \$\{item\.id\}/);
  assert.match(hoomaNowSection, /filterLiveRideItems/);
  assert.match(hoomaNowSection, /expiresAt/);
  assert.match(hoomaNowSection, /window\.setTimeout/);
});

test("shared HOOMA NOW feed does not infer Ride-only expiry UI from generic endsAt", () => {
  assert.doesNotMatch(hoomaNowFeed, /Live until expiry/);
  assert.doesNotMatch(hoomaNowFeed, /hooma-now-card__ride-expiry/);
  assert.match(hoomaNowFeed, /detailRows/);
  assert.match(hoomaNowSection, /rideTimeRemaining\(item\)/);
});

test("Community HOOMA NOW interaction stays phone-safe", () => {
  assert.match(hoomaNowCss, /\.hooma-now-card__expansion/);
  assert.match(hoomaNowCss, /\.hooma-now-ride-detail__whistle-row/);
  assert.match(hoomaNowCss, /@media \(max-width: 520px\)/);
  assert.match(hoomaNowCss, /grid-template-columns:\s*1fr/);
  assert.doesNotMatch(hoomaNowCss, /!important/);
});
