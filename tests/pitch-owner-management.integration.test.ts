import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import type { PlatformAdminAccessPort } from "../apps/api/src/application/platform-admin-access.port.js";
import { AppError } from "../apps/api/src/http/errors/app-error.js";
import { PrismaPlaceRepository } from "../apps/api/src/modules/places/infrastructure/prisma-place.repository.js";
import { PitchOwnerService } from "../apps/api/src/modules/pitch/application/pitch-owner.service.js";
import { PrismaPitchRepository } from "../apps/api/src/modules/pitch/infrastructure/prisma-pitch.repository.js";

const db = getDatabaseClient();

test("Pitch owner management reads approved pending and latest rejected state", async () => {
  const suffix = Date.now().toString(36);
  const owner = await db.user.create({ data: {} });
  const admin = await db.user.create({ data: {} });
  const outsider = await db.user.create({ data: {} });
  const reviewedAt = new Date();
  const place = await db.place.create({
    data: {
      slug: `pitch-manage-${suffix}`,
      name: `Pitch Manage ${suffix}`,
      address: "44 Owner Road",
      city: "Tunis",
      houma: "El Menzah",
      phone: "+21671000444",
      moderationStatus: "APPROVED",
      suggestedByUserId: outsider.id,
      reviewedByUserId: admin.id,
      reviewedAt,
      capabilities: {
        create: {
          kind: "PITCH",
          status: "APPROVED",
          summary: "Current public rental profile.",
          hourlyRateMinor: 50_000,
          currency: "TND",
          reviewedByUserId: admin.id,
          reviewedAt,
        },
      },
      ownerships: {
        create: {
          userId: owner.id,
          verifiedByUserId: admin.id,
        },
      },
    },
  });

  const rejected = await db.placeCapabilityApplication.create({
    data: {
      placeId: place.id,
      applicantUserId: owner.id,
      kind: "PITCH",
      summary: "Rejected rental update.",
      hourlyRateMinor: 55_000,
      currency: "TND",
      status: "REJECTED",
      reviewedByUserId: admin.id,
      reviewedAt,
      reviewNote: "Price could not be verified",
    },
  });
  const pending = await db.placeCapabilityApplication.create({
    data: {
      placeId: place.id,
      applicantUserId: owner.id,
      kind: "PITCH",
      summary: "Pending rental update.",
      hourlyRateMinor: 60_000,
      currency: "TND",
    },
  });

  const authorizer: PlatformAdminAccessPort = {
    async isPlatformAdmin(userId) {
      return userId === admin.id;
    },
    async requirePlatformAdmin() {},
    async can() {
      return true;
    },
    async requireCapability() {},
  };
  const places = new PrismaPlaceRepository(db);
  const pitch = new PitchOwnerService(new PrismaPitchRepository(db), places, authorizer);

  try {
    const management = await pitch.getManagementState(owner.id, place.id);
    assert.equal(management.place.id, place.id);
    assert.equal(management.place.phone, "+21671000444");
    assert.equal(management.verifiedOwnership, true);
    assert.equal(management.approvedPitch?.hourlyRateMinor, 50_000);
    assert.equal(management.approvedPitch?.currency, "TND");
    assert.equal(management.pendingApplication?.id, pending.id);
    assert.equal(management.pendingApplication?.hourlyRateMinor, 60_000);
    assert.equal(management.latestRejectedApplication?.id, rejected.id);
    assert.equal(management.latestRejectedApplication?.hourlyRateMinor, 55_000);
    assert.equal(management.latestRejectedApplication?.reviewNote, "Price could not be verified");

    const adminManagement = await pitch.getManagementState(admin.id, place.id);
    assert.equal(adminManagement.verifiedOwnership, false);
    assert.equal(adminManagement.approvedPitch?.hourlyRateMinor, 50_000);

    await assert.rejects(
      () => pitch.getManagementState(outsider.id, place.id),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 403 &&
        error.code === "PITCH_MANAGEMENT_ACCESS_DENIED",
    );
  } finally {
    await db.placeCapabilityApplication.deleteMany({ where: { placeId: place.id } });
    await db.placeCapability.deleteMany({ where: { placeId: place.id } });
    await db.placeOwnership.deleteMany({ where: { placeId: place.id } });
    await db.place.delete({ where: { id: place.id } });
    await db.user.deleteMany({ where: { id: { in: [owner.id, admin.id, outsider.id] } } });
  }
});
