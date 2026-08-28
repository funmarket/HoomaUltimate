import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const placesPage = await readFile(
  new URL("../packages/frontend/src/places/PlacesPages.tsx", import.meta.url),
  "utf8",
);
const placeDetailPage = await readFile(
  new URL("../packages/frontend/src/places/PlaceDetailPage.tsx", import.meta.url),
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
const eventRepository = await readFile(
  new URL(
    "../apps/api/src/modules/events/infrastructure/prisma-event.repository.ts",
    import.meta.url,
  ),
  "utf8",
);
const contracts = await readFile(
  new URL("../packages/contracts/src/platform-management.ts", import.meta.url),
  "utf8",
);
const eventContracts = await readFile(
  new URL("../packages/contracts/src/events.ts", import.meta.url),
  "utf8",
);
const prismaSchema = await readFile(
  new URL("../packages/database/prisma/schema.prisma", import.meta.url),
  "utf8",
);
const provenanceMigration = await readFile(
  new URL(
    "../packages/database/prisma/migrations/20260828183000_place_submission_origin/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

const approvedPlaceGuard = 'place: { moderationStatus: "APPROVED", archivedAt: null }';

function section(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `Missing section start: ${start}`);
  const to = end ? source.indexOf(end, from) : source.length;
  assert.ok(to === -1 || to > from, `Invalid section end: ${end}`);
  return source.slice(from, to === -1 ? source.length : to);
}

test("Spots expose only By Owner and FanHub source tabs without hiding unclassified history", () => {
  assert.match(placesPage, />\s*By Owner\s*</);
  assert.match(placesPage, />\s*FanHub\s*</);
  assert.ok(placesPage.includes("place.submissionOrigin === spotOrigin"));
  assert.ok(placesPage.includes("place.submissionOrigin === null"));
  assert.ok(placesPage.includes("SOURCE PENDING VERIFICATION"));
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

test("Place provenance is a first-class immutable source fact rather than claim evidence", () => {
  assert.ok(prismaSchema.includes("enum PlaceSubmissionOrigin"));
  assert.ok(prismaSchema.includes("submissionOrigin    PlaceSubmissionOrigin?"));
  assert.ok(contracts.includes("readonly submissionOrigin: PlaceSubmissionOrigin | null"));
  assert.ok(placeRepository.includes("submissionOrigin: true"));
  assert.ok(capabilityRepository.includes("submissionOrigin: true"));
  assert.ok(placeRepository.includes("submissionOrigin: place.submissionOrigin"));
  assert.ok(capabilityRepository.includes("submissionOrigin: place.submissionOrigin"));
  assert.ok(!placeRepository.includes("ownerSubmitted"));
  assert.ok(!capabilityRepository.includes("ownerSubmitted"));
  assert.ok(!capabilityRepository.includes("Ownership asserted during Place submission"));

  const update = section(placeRepository, "async update(", "async archive(");
  assert.ok(!update.includes("submissionOrigin:"));
  const claim = section(placeRepository, "async claimOwnership(", "async pendingPlaces(");
  assert.ok(!claim.includes("submissionOrigin"));
});

test("Provenance migration does not invent historical OWNER or FANHUB data", () => {
  assert.ok(provenanceMigration.includes('ADD COLUMN "submissionOrigin" "PlaceSubmissionOrigin"'));
  assert.ok(!/UPDATE\s+"Place"/i.test(provenanceMigration));
  assert.ok(!provenanceMigration.includes("DEFAULT 'FANHUB'"));
  assert.ok(!provenanceMigration.includes("DEFAULT 'OWNER'"));
});

test("Owner submission persists provenance and creates its pending ownership claim atomically", () => {
  const suggest = section(placeRepository, "async suggest(", "async getApproved(");
  assert.ok(suggest.includes("return this.db.$transaction"));
  assert.ok(suggest.includes("submissionOrigin,"));
  assert.ok(suggest.includes('const ownerOrigin = submissionOrigin === "OWNER"'));
  assert.ok(suggest.includes("ownershipClaims"));
  assert.ok(suggest.includes("OWNER_SUBMISSION_CLAIM_EVIDENCE"));

  const reviewPlace = section(placeRepository, "async reviewPlace(", "async reviewOwnershipClaim(");
  assert.ok(!reviewPlace.includes("placeOwnershipClaim.update"));
  assert.ok(!reviewPlace.includes("placeOwnership.upsert"));

  const ownershipReview = section(placeRepository, "async reviewOwnershipClaim(");
  assert.ok(ownershipReview.includes(approvedPlaceGuard));
  assert.ok(ownershipReview.includes("placeOwnership.upsert"));
});

test("Canonical duplicate identity uses strong source fields and transactional advisory locks", () => {
  assert.ok(placeRepository.includes("pg_advisory_xact_lock"));
  assert.ok(placeRepository.includes("duplicateLockKeys(input)"));
  assert.ok(placeRepository.includes('matchedBy: "NAME_ADDRESS"'));
  assert.ok(placeRepository.includes('matchedBy: "PHONE"'));
  assert.ok(placeRepository.includes('matchedBy: "WEBSITE"'));
  assert.ok(placeRepository.includes('matchedBy: "NAME_COORDINATES"'));
  assert.ok(placeRepository.includes("regexp_replace(btrim(\"name\"), '[[:space:]]+', ' ', 'g')"));
  assert.ok(placeRepository.includes("regexp_replace(\"phone\", '[^0-9]', '', 'g')"));
  assert.ok(placeRepository.includes("input.latitude != null && input.longitude != null"));
  assert.ok(!placeRepository.includes('matchedBy: "COORDINATES"'));

  assert.ok(provenanceMigration.includes("Place_normalized_name_address_idx"));
  assert.ok(provenanceMigration.includes("Place_normalized_phone_idx"));
  assert.ok(provenanceMigration.includes("Place_normalized_website_idx"));
  assert.ok(provenanceMigration.includes("Place_coordinates_name_idx"));
});

test("Duplicate Add Place returns the canonical Place instead of creating a second venue", () => {
  const suggest = section(placeRepository, "async suggest(", "async getApproved(");
  const duplicateBranch = section(suggest, "if (duplicate) {", "const imageUrls");
  assert.ok(duplicateBranch.includes('outcome: "EXISTING"'));
  assert.ok(duplicateBranch.includes("placeSummary(existing, images)"));
  assert.ok(!duplicateBranch.includes("tx.place.create"));
  assert.ok(placesPage.includes("No duplicate created"));
  assert.ok(placesPage.includes("View existing Place"));
  assert.ok(placesPage.includes("Claim this Place"));
  assert.ok(placeDetailPage.includes('query.get("claim") === "1"'));
});

test("Watch read model names publisher authority separately from Place provenance", () => {
  assert.ok(eventContracts.includes("PublicEventPublisherAuthority"));
  assert.ok(eventContracts.includes("publisherAuthority: PublicEventPublisherAuthority"));
  assert.ok(!eventContracts.includes("PublicEventVenueAuthority"));
  assert.ok(eventRepository.includes("publishedByVerifiedPlaceOwner"));
  assert.ok(eventRepository.includes("publisherAuthority:"));
  assert.ok(eventRepository.includes('"VERIFIED_PLACE_OWNER"'));
  assert.ok(eventRepository.includes('"COMMUNITY_PUBLISHER"'));
  assert.ok(!eventRepository.includes("venueAuthority:"));
});
