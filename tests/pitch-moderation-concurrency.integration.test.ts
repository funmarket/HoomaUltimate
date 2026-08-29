import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import type { PlatformAdminAccessPort } from "../apps/api/src/application/platform-admin-access.port.js";
import { AppError } from "../apps/api/src/http/errors/app-error.js";
import { PrismaPlaceRepository } from "../apps/api/src/modules/places/infrastructure/prisma-place.repository.js";
import { ApprovedPitchReader } from "../apps/api/src/modules/pitch/application/approved-pitch.reader.js";
import { PitchModerationService } from "../apps/api/src/modules/pitch/application/pitch-moderation.service.js";
import { PitchOwnerService } from "../apps/api/src/modules/pitch/application/pitch-owner.service.js";
import { PrismaPitchRepository } from "../apps/api/src/modules/pitch/infrastructure/prisma-pitch.repository.js";

const db = getDatabaseClient();

const allowAdmin: PlatformAdminAccessPort = {
  async isPlatformAdmin() {
    return true;
  },
  async requirePlatformAdmin() {},
  async can() {
    return true;
  },
  async requireCapability() {},
};

function isAppErrorCode(error: unknown, code: string) {
  return error instanceof AppError && error.code === code;
}

test("Pitch moderation concurrency is database-enforced", async () => {
  const suffix = Date.now().toString(36);
  const owner = await db.user.create({ data: {} });
  const adminA = await db.user.create({ data: {} });
  const adminB = await db.user.create({ data: {} });
  await db.userPresentation.create({
    data: {
      userId: owner.id,
      username: `pitch_race_owner_${suffix}`,
      displayName: "Pitch Race Owner",
    },
  });

  const place = await db.place.create({
    data: {
      slug: `pitch-race-${suffix}`,
      name: `Pitch Race ${suffix}`,
      address: "12 Concurrency Road",
      city: "Tunis",
      houma: "El Menzah",
      moderationStatus: "APPROVED",
      suggestedByUserId: owner.id,
      reviewedByUserId: adminA.id,
      reviewedAt: new Date(),
      capabilities: {
        create: {
          kind: "PITCH",
          status: "APPROVED",
          summary: "Existing approved Pitch rental profile.",
          hourlyRateMinor: 65_000,
          currency: "TND",
          reviewedByUserId: adminA.id,
          reviewedAt: new Date(),
        },
      },
      ownerships: {
        create: {
          userId: owner.id,
          verifiedByUserId: adminA.id,
        },
      },
    },
  });

  const places = new PrismaPlaceRepository(db);
  const pitchRepository = new PrismaPitchRepository(db);
  const pitchReader = new ApprovedPitchReader(pitchRepository);
  const pitchOwner = new PitchOwnerService(pitchRepository, places, allowAdmin);
  const pitchModeration = new PitchModerationService(pitchRepository, allowAdmin);
  let applicationId: string | null = null;

  try {
    const submissions = await Promise.allSettled([
      pitchOwner.submitRevision(owner.id, place.id, {
        summary: "Concurrent rental update A.",
        hourlyRateMinor: 70_000,
        currency: "TND",
      }),
      pitchOwner.submitRevision(owner.id, place.id, {
        summary: "Concurrent rental update B.",
        hourlyRateMinor: 71_000,
        currency: "TND",
      }),
    ]);

    const successfulSubmissions = submissions.filter((result) => result.status === "fulfilled");
    const failedSubmissions = submissions.filter((result) => result.status === "rejected");
    assert.equal(successfulSubmissions.length, 1);
    assert.equal(failedSubmissions.length, 1);

    const successfulSubmission = successfulSubmissions[0];
    const failedSubmission = failedSubmissions[0];
    assert.ok(successfulSubmission?.status === "fulfilled");
    assert.ok(failedSubmission?.status === "rejected");
    assert.ok(isAppErrorCode(failedSubmission.reason, "PITCH_APPLICATION_ALREADY_PENDING"));
    applicationId = successfulSubmission.value.id;

    const pendingRevisions = await db.placeCapabilityApplication.findMany({
      where: { placeId: place.id, kind: "PITCH", status: "PENDING" },
    });
    assert.equal(pendingRevisions.length, 1);
    assert.equal(pendingRevisions[0]!.id, applicationId);

    const publicBeforeReview = await pitchReader.getApproved(place.id);
    assert.equal(publicBeforeReview.hourlyRateMinor, 65_000);

    const reviews = await Promise.allSettled([
      pitchModeration.review(adminA.id, "OWNER_REVISION", applicationId, {
        decision: "APPROVE",
        note: "Admin A review",
      }),
      pitchModeration.review(adminB.id, "OWNER_REVISION", applicationId, {
        decision: "APPROVE",
        note: "Admin B review",
      }),
    ]);

    const successfulReviews = reviews.filter((result) => result.status === "fulfilled");
    const failedReviews = reviews.filter((result) => result.status === "rejected");
    assert.equal(successfulReviews.length, 1);
    assert.equal(failedReviews.length, 1);

    const failedReview = failedReviews[0];
    assert.ok(failedReview?.status === "rejected");
    assert.ok(isAppErrorCode(failedReview.reason, "PITCH_REVIEW_NOT_PENDING"));

    const reviewedRevision = await db.placeCapabilityApplication.findUnique({
      where: { id: applicationId },
    });
    assert.equal(reviewedRevision?.status, "APPROVED");
    const reviewerId = reviewedRevision?.reviewedByUserId;
    assert.ok(reviewerId === adminA.id || reviewerId === adminB.id);
    assert.ok(reviewedRevision?.reviewedAt);

    const publicAfterReview = await pitchReader.getApproved(place.id);
    assert.equal(publicAfterReview.hourlyRateMinor, reviewedRevision?.hourlyRateMinor);
    assert.equal(publicAfterReview.summary, reviewedRevision?.summary);

    assert.equal(
      await db.auditLog.count({
        where: {
          entityType: "PlaceCapabilityApplication",
          entityId: applicationId,
          action: "PITCH_APPLICATION_APPROVED",
        },
      }),
      1,
    );
  } finally {
    if (applicationId) {
      await db.auditLog.deleteMany({ where: { entityId: applicationId } });
    }
    await db.placeCapabilityApplication.deleteMany({ where: { placeId: place.id } });
    await db.placeCapability.deleteMany({ where: { placeId: place.id } });
    await db.placeOwnership.deleteMany({ where: { placeId: place.id } });
    await db.place.delete({ where: { id: place.id } });
    await db.user.deleteMany({
      where: { id: { in: [owner.id, adminA.id, adminB.id] } },
    });
  }
});
