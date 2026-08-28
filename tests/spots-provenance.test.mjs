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
const capabilityRepository = await readFile(
  new URL(
    "../apps/api/src/modules/places/infrastructure/prisma-place-capability.repository.ts",
    import.meta.url,
  ),
  "utf8",
);
const contracts = await readFile(
  new URL("../packages/contracts/src/platform-management.ts", import.meta.url),
  "utf8",
);

const forbiddenSpotDomains =
  /SpotService|SpotRepository|FanHubService|FanHubRepository/;
const submissionOriginEnum =
  /placeSubmissionOriginSchema = z\.enum\(\["OWNER", "FANHUB"\]\)/;
const publicSubmissionOrigin =
  /readonly submissionOrigin: PlaceSubmissionOrigin/;
const ownerSubmissionEvidence =
  /OWNER_SUBMISSION_EVIDENCE = "Ownership asserted during Place submission"/;
const approvedPlaceClaimGuard =
  /place: \{ moderationStatus: "APPROVED", archivedAt: null \}/;

test("Spots expose only By Owner and FanHub source tabs", () => {
  assert.match(placesPage, />\s*By Owner\s*</);
  assert.match(placesPage, />\s*FanHub\s*</);
  assert.match(placesPage, /place\.submissionOrigin === spotOrigin/);
  assert.match(placesPage, /api\.capability\.list\("PITCH"\)/);
  assert.match(placesPage, /!pitchPlaceIds\.has\(place\.id\)/);
  assert.doesNotMatch(placesPage, forbiddenSpotDomains);
});

test("Add Place defaults to FanHub and sends explicit source intent", () => {
  assert.match(contracts, /placeSubmissionOriginSchema\.default\("FANHUB"\)/);
  assert.match(placesPage, /useState<PlaceSubmissionOrigin>\("FANHUB"\)/);
  assert.match(
    placesPage,
    /submissionOrigin: isPitchSuggestion \? "FANHUB" : submissionOrigin/,
  );
  assert.match(placesPage, /WHO IS ADDING THIS SPOT\?/);
  assert.match(placesPage, /Suggesting it does not make you its owner/);
});

test("Spot source stays tied to original submission intent", () => {
  assert.match(contracts, submissionOriginEnum);
  assert.match(contracts, publicSubmissionOrigin);
  assert.match(placeRepository, ownerSubmissionEvidence);
  assert.match(capabilityRepository, ownerSubmissionEvidence);
  assert.match(placeRepository, /ownershipClaims:/);
  assert.match(capabilityRepository, /ownershipClaims:/);
  assert.match(
    placeRepository,
    /submissionOrigin: ownerSubmitted \? "OWNER" : "FANHUB"/,
  );
  assert.match(
    capabilityRepository,
    /submissionOrigin: ownerSubmitted \? "OWNER" : "FANHUB"/,
  );
  assert.doesNotMatch(placeRepository, /suggestedByVerifiedOwner/);
  assert.doesNotMatch(capabilityRepository, /suggestedByVerifiedOwner/);
});

test("Place moderation and ownership verification remain separate", () => {
  const suggest = placeRepository.slice(
    placeRepository.indexOf("async suggest("),
    placeRepository.indexOf("async getApproved("),
  );
  assert.match(
    suggest,
    /ownerOrigin[\s\S]*?ownershipClaims[\s\S]*?OWNER_SUBMISSION_EVIDENCE/,
  );

  const reviewPlace = placeRepository.slice(
    placeRepository.indexOf("async reviewPlace("),
    placeRepository.indexOf("async reviewOwnershipClaim("),
  );
  assert.doesNotMatch(reviewPlace, /placeOwnershipClaim\.(update|updateMany)/);
  assert.doesNotMatch(reviewPlace, /placeOwnership\.upsert/);

  const reviewOwnershipClaim = placeRepository.slice(
    placeRepository.indexOf("async reviewOwnershipClaim("),
  );
  assert.match(reviewOwnershipClaim, approvedPlaceClaimGuard);
  assert.match(reviewOwnershipClaim, /placeOwnership\.upsert/);
});

test("Owner submission marker survives later claim updates", () => {
  const claimOwnership = placeRepository.slice(
    placeRepository.indexOf("async claimOwnership("),
    placeRepository.indexOf("async pendingPlaces("),
  );
  assert.match(claimOwnership, /existing\?\.evidence === OWNER_SUBMISSION_EVIDENCE/);
  assert.match(claimOwnership, /\? OWNER_SUBMISSION_EVIDENCE/);
});
