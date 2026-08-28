import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const placesPage = await readFile(
  new URL("../packages/frontend/src/places/PlacesPages.tsx", import.meta.url),
  "utf8",
);
const placeRepository = await readFile(
  new URL(
    "../apps/api/src/modules/places/infrastructure/prisma-place.repository.ts",
    import.meta.url,
  ),
  "utf8",
);
const contracts = await readFile(
  new URL("../packages/contracts/src/platform-management.ts", import.meta.url),
  "utf8",
);

test("Spots expose only By Owner and FanHub source tabs", () => {
  assert.match(placesPage, />\s*By Owner\s*</);
  assert.match(placesPage, />\s*FanHub\s*</);
  assert.match(placesPage, /place\.submissionOrigin === spotOrigin/);
  assert.match(placesPage, /api\.capability\.list\("PITCH"\)/);
  assert.match(placesPage, /!pitchPlaceIds\.has\(place\.id\)/);
  assert.doesNotMatch(placesPage, /SpotService|SpotRepository|FanHubService|FanHubRepository/);
});

test("Spot source is derived from canonical suggester and verified ownership", () => {
  assert.match(contracts, /placeSubmissionOriginSchema = z\.enum\(\["OWNER", "FANHUB"\]\)/);
  assert.match(contracts, /readonly submissionOrigin: PlaceSubmissionOrigin/);
  assert.match(placeRepository, /suggestedByUserId: true/);
  assert.match(placeRepository, /ownerships:[\s\S]*?where: \{ revokedAt: null \}/);
  assert.match(
    placeRepository,
    /ownership\.userId === place\.suggestedByUserId/,
  );
  assert.match(
    placeRepository,
    /submissionOrigin: suggestedByVerifiedOwner \? "OWNER" : "FANHUB"/,
  );
});

test("approving a suggestion no longer grants ownership to the suggester", () => {
  const reviewPlace = placeRepository.slice(
    placeRepository.indexOf("async reviewPlace("),
    placeRepository.indexOf("async reviewOwnershipClaim("),
  );
  assert.doesNotMatch(reviewPlace, /placeOwnership\.(?:create|upsert)/);
  assert.match(reviewPlace, /placeCapability\.updateMany/);

  const canManage = placeRepository.slice(
    placeRepository.indexOf("async canManage("),
    placeRepository.indexOf("async update("),
  );
  assert.match(canManage, /if \(place\.ownerships\.length\) return true/);
  assert.match(canManage, /return place\.moderationStatus === "PENDING"/);
});
