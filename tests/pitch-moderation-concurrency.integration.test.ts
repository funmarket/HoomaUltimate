import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { AppError } from "../apps/api/src/http/errors/app-error.js";
import { PlaceCapabilityService } from "../apps/api/src/modules/places/application/place-capability.service.js";
import { PrismaPlaceCapabilityRepository } from "../apps/api/src/modules/places/infrastructure/prisma-place-capability.repository.js";
import { PrismaPlaceRepository } from "../apps/api/src/modules/places/infrastructure/prisma-place.repository.js";
import type { PlatformAdminAuthorizer } from "../apps/api/src/modules/platform-admin/application/platform-admin.authorizer.js";

const db = getDatabaseClient();

const allowAdmin: PlatformAdminAuthorizer = {
  async isPlatformAdmin() {
    return true;
  },
  async requirePlatformAdmin() {},
  async can() {
    return true;
  },
  async requireCapability() {},
};

function rejectedWithCode(
  result: PromiseSettledResult<unknown>,
  code: string,
): result is PromiseRejectedResult {
  return (
    result.status === "rejected" &&
    result.reason instanceof AppError &&
    result.reason.code === code
  );
}

test(
  "Pitch moderation enforces one pending revision and one review winner under concurrency",
  async () => {
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
    const capabilityRepository = new PrismaPlaceCapabilityRepository(db);
    const pitch = new PlaceCapabilityService("PITCH", capabilityRepository, places, allowAdmin);
    let applicationId: string | null = null;

    try {
      const submissions = await Promise.allSettled([
        pitch.submit(owner.id, place.id, {
          summary: "Concurrent rental update A.",
          hourlyRateMinor: 70_000,
          currency: "TND",
        }),
        pitch.submit(owner.id, place.id, {
          summary: "Concurrent rental update B.",
          hourlyRateMinor: 71_000,
          currency: "TND",
        }),
      ]);

      const fulfilledSubmissions = submissions.filter(
        (result): result is PromiseFulfilledResult<{ id: string; status: string }> =>
          result.status === "fulfilled",
      );
      const rejectedSubmissions = submissions.filter((result) =>
        rejectedWithCode(result, "PITCH_APPLICATION_ALREADY_PENDING"),
      );
      assert.equal(fulfilledSubmissions.length, 1);
      assert.equal(rejectedSubmissions.length, 1);
      applicationId = fulfilledSubmissions[0]!.value.id;

      const pendingRevisions = await db.placeCapabilityApplication.findMany({
        where: { placeId: place.id, kind: "PITCH", status: "PENDING" },
      });
      assert.equal(pendingRevisions.length, 1);
      assert.equal(pendingRevisions[0]!.id, applicationId);

      const publicBeforeReview = await pitch.getPublic(place.id);
      assert.equal(publicBeforeReview.hourlyRateMinor, 65_000);

      const reviews = await Promise.allSettled([
        pitch.review(adminA.id, applicationId, {
          decision: "APPROVE",
          note: "Admin A review",
        }),
        pitch.review(adminB.id, applicationId, {
          decision: "APPROVE",
          note: "Admin B review",
        }),
      ]);

      assert.equal(reviews.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(
        reviews.filter((result) =>
          rejectedWithCode(result, "PITCH_APPLICATION_REVIEW_NOT_PENDING"),
        ).length,
        1,
      );

      const reviewedRevision = await db.placeCapabilityApplication.findUnique({
        where: { id: applicationId },
      });
      assert.equal(reviewedRevision?.status, "APPROVED");
      assert.ok(
        reviewedRevision?.reviewedByUserId === adminA.id ||
          reviewedRevision?.reviewedByUserId === adminB.id,
      );
      assert.ok(reviewedRevision?.reviewedAt);

      const publicAfterReview = await pitch.getPublic(place.id);
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
  },
);
