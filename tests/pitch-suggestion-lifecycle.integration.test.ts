import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
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

test("an approved suggested Pitch preserves immutable owner moderation history", async () => {
  const suffix = Date.now().toString(36);
  const suggester = await db.user.create({ data: {} });
  const claimant = await db.user.create({ data: {} });
  const admin = await db.user.create({ data: {} });
  await db.userPresentation.create({
    data: {
      userId: suggester.id,
      username: `pitch_suggester_${suffix}`,
      displayName: "Pitch Suggester",
    },
  });
  const places = new PrismaPlaceRepository(db);
  const capabilityRepository = new PrismaPlaceCapabilityRepository(db);
  const pitch = new PlaceCapabilityService("PITCH", capabilityRepository, places, allowAdmin);

  let placeId: string | null = null;
  const applicationIds: string[] = [];
  let claimId: string | null = null;

  try {
    const suggested = await places.suggest(suggester.id, {
      name: `Community Pitch ${suffix}`,
      address: "18 Football Road",
      city: "Tunis",
      houma: "El Menzah",
      latitude: null,
      longitude: null,
      phone: "+21671000123",
      email: null,
      websiteUrl: null,
      imageUrl: null,
      imageUrls: [],
      description: "A real local football ground suggested by the community.",
      category: "Football pitch",
      menuItems: [],
      suggestedCapabilities: ["PITCH"],
      pitch: { hourlyRateMinor: 45_000, currency: "TND" },
    });
    placeId = suggested.id;
    assert.equal(suggested.status, "PENDING");

    const pendingCapability = await db.placeCapability.findUnique({
      where: { placeId_kind: { placeId, kind: "PITCH" } },
    });
    assert.equal(pendingCapability?.status, "PENDING");
    assert.equal(pendingCapability?.hourlyRateMinor, 45_000);
    assert.equal(pendingCapability?.currency, "TND");

    const queueItem = (await places.pendingPlaces()).find((item) => item.id === placeId);
    assert.ok(queueItem);
    assert.equal(queueItem.kind, "PITCH");
    assert.equal(queueItem.hourlyRateMinor, 45_000);
    assert.equal(queueItem.currency, "TND");

    assert.equal(
      await places.reviewPlace(admin.id, placeId, {
        decision: "APPROVE",
        note: "Confirmed as a real football pitch with reviewed rental pricing",
      }),
      true,
    );

    assert.equal(
      await db.placeOwnership.count({
        where: { placeId, userId: suggester.id, revokedAt: null },
      }),
      0,
      "suggesting somebody else's pitch must not make the suggester its verified owner",
    );
    assert.equal(
      await places.canManage(placeId, suggester.id),
      false,
      "an approved Pitch suggestion must stop being editable by an unverified suggester",
    );

    const publicBeforeClaim = await pitch.getPublic(placeId);
    assert.equal(publicBeforeClaim.place.id, placeId);
    assert.equal(publicBeforeClaim.hourlyRateMinor, 45_000);
    assert.equal(publicBeforeClaim.currency, "TND");

    const claim = await places.claimOwnership(claimant.id, placeId, {
      evidence: "Venue lease and management documents are available for App review.",
    });
    claimId = claim.id;
    assert.equal(claim.status, "PENDING");
    assert.equal(
      await places.reviewOwnershipClaim(admin.id, claim.id, {
        decision: "APPROVE",
      }),
      true,
    );
    assert.equal(await places.hasVerifiedOwnership(placeId, claimant.id), true);

    const firstRevision = await pitch.submit(claimant.id, placeId, {
      summary: "Floodlit five-a-side pitch with changing rooms.",
      hourlyRateMinor: 50_000,
      currency: "TND",
    });
    applicationIds.push(firstRevision.id);
    assert.equal(firstRevision.status, "PENDING");

    const stillPublicWhilePending = await pitch.getPublic(placeId);
    assert.equal(stillPublicWhilePending.hourlyRateMinor, 45_000);
    assert.equal(stillPublicWhilePending.currency, "TND");
    assert.equal(stillPublicWhilePending.place.phone, "+21671000123");

    await pitch.review(admin.id, firstRevision.id, {
      decision: "APPROVE",
      note: "Updated rental details verified",
    });

    const approvedFirstRevision = await db.placeCapabilityApplication.findUnique({
      where: { id: firstRevision.id },
    });
    assert.equal(approvedFirstRevision?.status, "APPROVED");
    assert.equal(approvedFirstRevision?.hourlyRateMinor, 50_000);
    assert.equal(approvedFirstRevision?.currency, "TND");

    const approvedRental = await pitch.getPublic(placeId);
    assert.equal(approvedRental.summary, "Floodlit five-a-side pitch with changing rooms.");
    assert.equal(approvedRental.hourlyRateMinor, 50_000);
    assert.equal(approvedRental.currency, "TND");
    assert.equal(approvedRental.place.phone, "+21671000123");

    const secondRevision = await pitch.submit(claimant.id, placeId, {
      summary: "Updated rental details awaiting review.",
      hourlyRateMinor: 55_000,
      currency: "TND",
    });
    applicationIds.push(secondRevision.id);
    assert.notEqual(secondRevision.id, firstRevision.id);
    assert.equal(secondRevision.status, "PENDING");

    const previousApprovedProfile = await pitch.getPublic(placeId);
    assert.equal(previousApprovedProfile.hourlyRateMinor, 50_000);

    await pitch.review(admin.id, secondRevision.id, {
      decision: "REJECT",
      note: "Updated price could not be verified",
    });

    const afterRejectedUpdate = await pitch.getPublic(placeId);
    assert.equal(afterRejectedUpdate.hourlyRateMinor, 50_000);
    assert.equal(afterRejectedUpdate.currency, "TND");

    const preservedFirstRevision = await db.placeCapabilityApplication.findUnique({
      where: { id: firstRevision.id },
    });
    const rejectedSecondRevision = await db.placeCapabilityApplication.findUnique({
      where: { id: secondRevision.id },
    });
    assert.equal(preservedFirstRevision?.status, "APPROVED");
    assert.equal(preservedFirstRevision?.hourlyRateMinor, 50_000);
    assert.equal(rejectedSecondRevision?.status, "REJECTED");
    assert.equal(rejectedSecondRevision?.hourlyRateMinor, 55_000);
    assert.equal(rejectedSecondRevision?.reviewNote, "Updated price could not be verified");

    const thirdRevision = await pitch.submit(claimant.id, placeId, {
      summary: "Verified new rental details.",
      hourlyRateMinor: 60_000,
      currency: "TND",
    });
    applicationIds.push(thirdRevision.id);
    assert.notEqual(thirdRevision.id, firstRevision.id);
    assert.notEqual(thirdRevision.id, secondRevision.id);

    const stillPublicBeforeThirdApproval = await pitch.getPublic(placeId);
    assert.equal(stillPublicBeforeThirdApproval.hourlyRateMinor, 50_000);

    await pitch.review(admin.id, thirdRevision.id, {
      decision: "APPROVE",
      note: "New rental price verified",
    });

    const finalPublicProfile = await pitch.getPublic(placeId);
    assert.equal(finalPublicProfile.hourlyRateMinor, 60_000);
    assert.equal(finalPublicProfile.currency, "TND");

    const preservedHistory = await db.placeCapabilityApplication.findMany({
      where: { placeId, kind: "PITCH" },
      select: { id: true, status: true, hourlyRateMinor: true },
    });
    assert.equal(preservedHistory.length, 3);
    assert.deepEqual(
      new Map(preservedHistory.map((revision) => [revision.id, revision])),
      new Map([
        [firstRevision.id, { id: firstRevision.id, status: "APPROVED", hourlyRateMinor: 50_000 }],
        [secondRevision.id, { id: secondRevision.id, status: "REJECTED", hourlyRateMinor: 55_000 }],
        [thirdRevision.id, { id: thirdRevision.id, status: "APPROVED", hourlyRateMinor: 60_000 }],
      ]),
    );
  } finally {
    if (applicationIds.length) {
      await db.auditLog.deleteMany({ where: { entityId: { in: applicationIds } } });
    }
    if (claimId) {
      await db.auditLog.deleteMany({ where: { entityId: claimId } });
    }
    if (placeId) {
      await db.auditLog.deleteMany({ where: { entityId: placeId } });
      await db.placeCapabilityApplication.deleteMany({ where: { placeId } });
      await db.placeCapability.deleteMany({ where: { placeId } });
      await db.placeOwnershipClaim.deleteMany({ where: { placeId } });
      await db.placeOwnership.deleteMany({ where: { placeId } });
      await db.place.deleteMany({ where: { id: placeId } });
    }
    await db.user.deleteMany({
      where: { id: { in: [suggester.id, claimant.id, admin.id] } },
    });
  }
});
