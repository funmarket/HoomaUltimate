import assert from "node:assert/strict";
import test from "node:test";
import {
  ATHLETES_PHOTO_MAX_BYTES,
  athletesCommunityCreateSchema,
  athletesJoinRequestStatusSchema,
  athletesMemberAddSchema,
  athletesPhotoContentTypeSchema,
  athletesPhotoListSchema,
  athletesPhotoMetadataSchema,
  athletesPhotoUploadResponseSchema,
  athletesPublicDetailSchema,
  athletesPublicSummarySchema,
  athletesRoleSchema,
  athletesSportSchema,
} from "@hooma/contracts/athletes";

test("Athletes contracts accept a bounded valid create payload", () => {
  const parsed = athletesCommunityCreateSchema.parse({
    name: "Carthage Runners",
    sport: "RUNNING",
    description: "Morning runs and race prep.",
    city: "Tunis",
    houma: "Carthage",
    logoUrl: "https://images.example.com/logo.png",
    bannerUrl: "https://images.example.com/banner.png",
    visibility: "PUBLIC",
    joinPolicy: "APPROVAL_REQUIRED",
  });
  assert.equal(parsed.name, "Carthage Runners");
  assert.equal(parsed.sport, "RUNNING");
});

test("Athletes contracts reject invalid sport, role, status and generic fields", () => {
  assert.throws(() => athletesSportSchema.parse("ULTRAS"));
  assert.throws(() => athletesRoleSchema.parse("COACH"));
  assert.throws(() => athletesJoinRequestStatusSchema.parse("ACCEPTED"));
  assert.throws(() =>
    athletesCommunityCreateSchema.parse({
      name: "Generic",
      sport: "CYCLING",
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      communityId: "community-1",
    }),
  );
});

test("Athletes direct add uses username input only", () => {
  assert.deepEqual(athletesMemberAddSchema.parse({ username: "runner_one" }), {
    username: "runner_one",
  });
  assert.throws(() => athletesMemberAddSchema.parse({ userId: "user-1" }));
});

test("public Athletes projections do not expose creator user ids", () => {
  assert.equal("createdByUserId" in athletesPublicSummarySchema.shape, false);
  assert.equal("createdByUserId" in athletesPublicDetailSchema.shape, false);
});

test("Athletes Photo contracts expose canonical private-board metadata", () => {
  const photo = {
    id: "photo-1",
    athletesCommunityId: "ath-1",
    contentType: "image/jpeg" as const,
    sizeBytes: 1024,
    createdAt: "2026-09-05T11:30:00.000Z",
    updatedAt: "2026-09-05T11:30:00.000Z",
  };

  assert.deepEqual(athletesPhotoMetadataSchema.parse(photo), photo);
  assert.deepEqual(athletesPhotoUploadResponseSchema.parse(photo), photo);
  assert.deepEqual(athletesPhotoListSchema.parse([photo]), [photo]);
});

test("Athletes Photo contracts enforce the accepted MIME and size policy", () => {
  for (const contentType of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(athletesPhotoContentTypeSchema.parse(contentType), contentType);
  }
  assert.throws(() => athletesPhotoContentTypeSchema.parse("image/gif"));

  const basePhoto = {
    id: "photo-1",
    athletesCommunityId: "ath-1",
    contentType: "image/png" as const,
    createdAt: "2026-09-05T11:30:00.000Z",
    updatedAt: "2026-09-05T11:30:00.000Z",
  };

  assert.equal(
    athletesPhotoMetadataSchema.parse({ ...basePhoto, sizeBytes: ATHLETES_PHOTO_MAX_BYTES })
      .sizeBytes,
    ATHLETES_PHOTO_MAX_BYTES,
  );
  assert.throws(() => athletesPhotoMetadataSchema.parse({ ...basePhoto, sizeBytes: 0 }));
  assert.throws(() =>
    athletesPhotoMetadataSchema.parse({
      ...basePhoto,
      sizeBytes: ATHLETES_PHOTO_MAX_BYTES + 1,
    }),
  );
});

test("Athletes Photo metadata rejects storage, uploader, and social fields", () => {
  const photo = {
    id: "photo-1",
    athletesCommunityId: "ath-1",
    contentType: "image/webp" as const,
    sizeBytes: 2048,
    createdAt: "2026-09-05T11:30:00.000Z",
    updatedAt: "2026-09-05T11:30:00.000Z",
  };

  for (const [field, value] of [
    ["objectKey", "athletes/ath-1/photo-1"],
    ["uploadedByUserId", "founder"],
    ["storageUrl", "https://storage.example.com/private/photo-1"],
    ["caption", "finish line"],
    ["reactions", 3],
  ] as const) {
    assert.throws(() => athletesPhotoMetadataSchema.parse({ ...photo, [field]: value }));
  }
});
