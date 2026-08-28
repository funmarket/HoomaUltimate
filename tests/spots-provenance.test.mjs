import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

const ownerMarker = 'OWNER_SUBMISSION_EVIDENCE = "Ownership asserted during Place submission"';
const ownerProjection = 'submissionOrigin: ownerSubmitted ? "OWNER" : "FANHUB"';
const approvedPlaceGuard = 'place: { moderationStatus: "APPROVED", archivedAt: null }';

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = end ? source.indexOf(end, from) : source.length;
  return source.slice(from, to);
}

test("Spots expose only By Owner and FanHub source tabs", () => {
  assert.match(placesPage, />\s*By Owner\s*</);
  assert.match(placesPage, />\s*FanHub\s*</);
  assert.ok(placesPage.includes("place.submissionOrigin === spotOrigin"));
  assert.ok(placesPage.includes('api.capability.list("PITCH")'));
  assert.ok(placesPage.includes("!pitchPlaceIds.has(place.id)"));
  assert.ok(!placesPage.includes("SpotService"));
  assert.ok(!placesPage.includes("FanHubService"));
});

test("Add Place defaults to FanHub and sends explicit source intent", () => {
  assert.ok(contracts.includes('placeSubmissionOriginSchema.default("FANHUB")'));
  assert.ok(placesPage.includes('useState<PlaceSubmissionOrigin>("FANHUB")'));
  assert.ok(placesPage.includes('isPitchSuggestion ? "FANHUB" : submissionOrigin'));
  assert.ok(placesPage.includes("WHO IS ADDING THIS SPOT?"));
  assert.ok(placesPage.includes("Suggesting it does not make you its owner"));
});

test("Spot source stays tied to original submission intent", () => {
  assert.ok(contracts.includes('z.enum(["OWNER", "FANHUB"])'));
  assert.ok(contracts.includes("readonly submissionOrigin: PlaceSubmissionOrigin"));
  assert.ok(placeRepository.includes(ownerMarker));
  assert.ok(capabilityRepository.includes(ownerMarker));
  assert.ok(placeRepository.includes("ownershipClaims:"));
  assert.ok(capabilityRepository.includes("ownershipClaims:"));
  assert.ok(placeRepository.includes(ownerProjection));
  assert.ok(capabilityRepository.includes(ownerProjection));
  assert.ok(!placeRepository.includes("suggestedByVerifiedOwner"));
  assert.ok(!capabilityRepository.includes("suggestedByVerifiedOwner"));
});

test("Place moderation and ownership verification remain separate", () => {
  const suggest = section(placeRepository, "async suggest(", "async getApproved(");
  assert.ok(suggest.includes("ownerOrigin"));
  assert.ok(suggest.includes("ownershipClaims"));
  assert.ok(suggest.includes("OWNER_SUBMISSION_EVIDENCE"));

  const reviewPlace = section(placeRepository, "async reviewPlace(", "async reviewOwnershipClaim(");
  assert.ok(!reviewPlace.includes("placeOwnershipClaim.update"));
  assert.ok(!reviewPlace.includes("placeOwnership.upsert"));

  const ownershipReview = section(placeRepository, "async reviewOwnershipClaim(");
  assert.ok(ownershipReview.includes(approvedPlaceGuard));
  assert.ok(ownershipReview.includes("placeOwnership.upsert"));
});

test("Owner submission marker survives later claim updates", () => {
  const claimOwnership = section(placeRepository, "async claimOwnership(", "async pendingPlaces(");
  assert.ok(claimOwnership.includes("existing?.evidence === OWNER_SUBMISSION_EVIDENCE"));
  assert.ok(claimOwnership.includes("? OWNER_SUBMISSION_EVIDENCE : input.evidence"));
});
