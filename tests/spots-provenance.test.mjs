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

const forbiddenSpotDomains = /SpotService|SpotRepository|FanHubService|FanHubRepository/;
const submissionOriginEnum = /placeSubmissionOriginSchema = z\.enum\(\["OWNER", "FANHUB"\]\)/;
const publicSubmissionOrigin = /readonly submissionOrigin: PlaceSubmissionOrigin/;
const activeOwnerships = /ownerships:[\s\S]*?where: \{ revokedAt: null \}/;
const ownerOrigin = /ownerOrigin = input\.submissionOrigin === "OWNER" && !isPitchSuggestion/;

test("Spots expose only By Owner and FanHub source tabs", () => {
  assert.match(placesPage, />\s*By Owner\s*</);
  assert.match(placesPage, />\s*FanHub\s*</);
  assert.match(placesPage, /place\.submissionOrigin === spotOrigin/);
  assert.match(placesPage, /api\.capability\.list\("PITCH"\)/);
  assert.match(placesPage, /!pitchPlaceIds\.has\(place\.id\)/);
  assert.doesNotMatch(placesPage, forbiddenSpotDomains);
});

test("Add Place defaults to FanHub and sends explicit source intent", () => {
  assert.match(placesPage, /useState<PlaceSubmissionOrigin>\("FANHUB"\)/);
  assert.match(
    placesPage,
    /submissionOrigin: isPitchSuggestion \? "FANHUB" : submissionOrigin/,
  );
  assert.match(placesPage, /WHO IS ADDING THIS SPOT\?/);
  assert.match(placesPage, /Suggesting it does not make you its owner/);
});

test("Spot source is derived from canonical suggester and ownership", () => {
  assert.match(contracts, submissionOriginEnum);
  assert.match(contracts, publicSubmissionOrigin);
  assert.match(placeRepository, /suggestedByUserId: true/);
  assert.match(placeRepository, activeOwnerships);
  assert.match(placeRepository, /ownership\.userId === place\.suggestedByUserId/);
  assert.match(
    placeRepository,
    /submissionOrigin: suggestedByVerifiedOwner \? "OWNER" : "FANHUB"/,
  );
});

test("FanHub and owner submissions keep separate ownership semantics", () => {
  const suggest = placeRepository.slice(
    placeRepository.indexOf("async suggest("),
    placeRepository.indexOf("async getApproved("),
  );
  assert.match(suggest, ownerOrigin);
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
