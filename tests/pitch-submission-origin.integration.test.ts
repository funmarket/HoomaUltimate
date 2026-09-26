import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaPitchRepository } from "../apps/api/src/modules/pitch/infrastructure/prisma-pitch.repository.js";

const db = getDatabaseClient();

function pitchInput(suffix: string, submissionOrigin: "OWNER" | "FANHUB") {
  return {
    place: {
      name: `Pitch Origin ${suffix}`,
      address: `41 Origin Street ${suffix}`,
      city: "Tunis",
      houma: "El Menzah",
      latitude: null,
      longitude: null,
      phone: null,
      email: null,
      websiteUrl: null,
      imageUrl: null,
      imageUrls: [],
      description: "Canonical Pitch submission provenance integration test.",
      category: "Football pitch",
      menuItems: [],
      submissionOrigin,
    },
    pitch: {
      hourlyRateMinor: 45_000,
      currency: "TND" as const,
    },
  };
}

async function cleanup(placeIds: readonly string[], userIds: readonly string[]) {
  if (placeIds.length) {
    await db.placeCapabilityApplication.deleteMany({
      where: { placeId: { in: [...placeIds] } },
    });
    await db.placeCapability.deleteMany({
      where: { placeId: { in: [...placeIds] } },
    });
    await db.placeOwnershipClaim.deleteMany({
      where: { placeId: { in: [...placeIds] } },
    });
    await db.placeOwnership.deleteMany({
      where: { placeId: { in: [...placeIds] } },
    });
    await db.placeImage.deleteMany({
      where: { placeId: { in: [...placeIds] } },
    });
    await db.placeMenuItem.deleteMany({
      where: { placeId: { in: [...placeIds] } },
    });
    await db.place.deleteMany({
      where: { id: { in: [...placeIds] } },
    });
  }

  if (userIds.length) {
    await db.user.deleteMany({ where: { id: { in: [...userIds] } } });
  }
}

test("FANHUB Pitch submission preserves provenance without ownership", async () => {
  const suffix = `fanhub-${Date.now().toString(36)}`;
  const suggester = await db.user.create({ data: {} });
  const repository = new PrismaPitchRepository(db);
  let placeId: string | null = null;

  try {
    const result = await repository.suggestPlace(suggester.id, pitchInput(suffix, "FANHUB"));
    assert.equal(result.outcome, "CREATED");
    placeId = result.place.id;

    const place = await db.place.findUniqueOrThrow({
      where: { id: placeId },
      select: { submissionOrigin: true },
    });
    assert.equal(place.submissionOrigin, "FANHUB");
    assert.equal(await db.placeOwnershipClaim.count({ where: { placeId } }), 0);
    assert.equal(await db.placeOwnership.count({ where: { placeId, revokedAt: null } }), 0);

    const capability = await db.placeCapability.findUniqueOrThrow({
      where: { placeId_kind: { placeId, kind: "PITCH" } },
      select: { status: true, hourlyRateMinor: true, currency: true },
    });
    assert.deepEqual(capability, {
      status: "PENDING",
      hourlyRateMinor: 45_000,
      currency: "TND",
    });
  } finally {
    await cleanup(placeId ? [placeId] : [], [suggester.id]);
  }
});

test("OWNER Pitch submission creates pending claim without verified ownership", async () => {
  const suffix = `owner-${Date.now().toString(36)}`;
  const owner = await db.user.create({ data: {} });
  const repository = new PrismaPitchRepository(db);
  let placeId: string | null = null;

  try {
    const result = await repository.suggestPlace(owner.id, pitchInput(suffix, "OWNER"));
    assert.equal(result.outcome, "CREATED");
    placeId = result.place.id;

    const place = await db.place.findUniqueOrThrow({
      where: { id: placeId },
      select: { submissionOrigin: true },
    });
    assert.equal(place.submissionOrigin, "OWNER");

    const claims = await db.placeOwnershipClaim.findMany({
      where: { placeId },
      select: { claimantUserId: true, status: true },
    });
    assert.deepEqual(claims, [{ claimantUserId: owner.id, status: "PENDING" }]);
    assert.equal(
      await db.placeOwnership.count({ where: { placeId, revokedAt: null } }),
      0,
      "OWNER provenance must not grant verified authority before App review",
    );

    const capability = await db.placeCapability.findUniqueOrThrow({
      where: { placeId_kind: { placeId, kind: "PITCH" } },
      select: { status: true, hourlyRateMinor: true, currency: true },
    });
    assert.deepEqual(capability, {
      status: "PENDING",
      hourlyRateMinor: 45_000,
      currency: "TND",
    });
  } finally {
    await cleanup(placeId ? [placeId] : [], [owner.id]);
  }
});

test("duplicate OWNER intent preserves existing provenance and authority state", async () => {
  const suffix = `duplicate-${Date.now().toString(36)}`;
  const fanHubUser = await db.user.create({ data: {} });
  const ownerUser = await db.user.create({ data: {} });
  const repository = new PrismaPitchRepository(db);
  let placeId: string | null = null;

  try {
    const first = await repository.suggestPlace(fanHubUser.id, pitchInput(suffix, "FANHUB"));
    assert.equal(first.outcome, "CREATED");
    placeId = first.place.id;

    const second = await repository.suggestPlace(ownerUser.id, pitchInput(suffix, "OWNER"));
    assert.equal(second.outcome, "EXISTING");
    assert.equal(second.place.id, placeId);

    assert.equal(
      await db.place.count({
        where: {
          name: `Pitch Origin ${suffix}`,
          address: `41 Origin Street ${suffix}`,
        },
      }),
      1,
    );

    const place = await db.place.findUniqueOrThrow({
      where: { id: placeId },
      select: { submissionOrigin: true },
    });
    assert.equal(place.submissionOrigin, "FANHUB");
    assert.equal(
      await db.placeOwnershipClaim.count({
        where: { placeId, claimantUserId: ownerUser.id },
      }),
      0,
      "duplicate OWNER intent must use the explicit claim flow instead of silently creating authority",
    );
    assert.equal(
      await db.placeOwnership.count({
        where: { placeId, userId: ownerUser.id, revokedAt: null },
      }),
      0,
    );
    assert.equal(await db.placeCapability.count({ where: { placeId, kind: "PITCH" } }), 1);
  } finally {
    await cleanup(placeId ? [placeId] : [], [fanHubUser.id, ownerUser.id]);
  }
});
