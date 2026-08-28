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

test("Add Place defaults to FanHub and sends explicit source intent", () => {
  assert.match(
    placesPage,
    /useState<PlaceSubmissionOrigin>\("FANHUB"\)/,
  );
  assert.match(
    placesPage,
    /submissionOrigin: isPitchSuggestion \? "FANHUB" : submissionOrigin/,
  );
  assert.match(placesPage, /WHO IS ADDING THIS SPOT\?/);
  assert.match(placesPage, /Suggesting it does not make you its owner/);
});

test("Spot source is derived from canonical suggester and verified ownership", () => {
  assert.match(contracts, /placeSubmissionOriginSchema = z\.enum\(\["OWNER", "FANHUB"\]\)/);
  assert.match(contracts, /readonly submissionOrigin: PlaceSubmissionOrigin/);
  assert.match(placeRepository, /suggestedByUserId: true/);
  assert.match(placeRepository, /ownerships:[\s\S]*?where: \{ revokedAt: null \}/);
  assert.match(placeRepository, /ownership\.userId === place\.suggestedByUserId/);
  assert.match(
    placeRepository,
    /submissionOrigin: suggestedByVerifiedOwner \? "OWNER" : "FANHUB"/,
  );
});

test("FanHub does not create ownership while owner submissions reuse canonical ownership", () => {
  const suggest = placeRepository.slice(
    placeRepository.indexOf("async suggest("),
    placeRepository.indexOf("async getApproved("),
  );
  assert.match(
    suggest,
    /ownerOrigin = input\.submissionOrigin === "OWNER" && !isPitchSuggestion/,
  );
  assert.match(suggest, /ownerOrigin[\s\S]*?ownershipClaims/);

  const reviewPlace = placeRepository.slice(
    placeRepository.indexOf("async reviewPlace("),
    placeRepository.indexOf("async reviewOwnershipClaim("),
  );
  assert.match(reviewPlace, /if \(status === "APPROVED" && ownerSubmissionClaim\)/);
  assert.match(reviewPlace, /placeOwnership\.upsert/);
  assert.match(reviewPlace, /placeCapability\.updateMany/);

  const canManage = placeRepository.slice(
    placeRepository.indexOf("async canManage("),
    placeRepository.indexOf("async update("),
  );
  assert.match(canManage, /if \(place\.ownerships\.length\) return true/);
  assert.match(canManage, /return place\.moderationStatus === "PENDING"/);
});
