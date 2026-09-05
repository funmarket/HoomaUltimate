import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaAthletesPhotoRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes-photo.repository.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for Athletes photo repository tests");

const db = getDatabaseClient();
const repository = new PrismaAthletesPhotoRepository(db);

test("Athletes Photo repository persists and scopes board metadata by Athletes community", async () => {
  const suffix = Date.now().toString(36);
  const uploader = await db.user.create({ data: {} });
  const firstCommunity = await db.athletesCommunity.create({
    data: {
      slug: `athletes-photo-first-${suffix}`,
      name: "Athletes Photo First",
      sport: "RUNNING",
      createdByUserId: uploader.id,
    },
  });
  const secondCommunity = await db.athletesCommunity.create({
    data: {
      slug: `athletes-photo-second-${suffix}`,
      name: "Athletes Photo Second",
      sport: "CYCLING",
      createdByUserId: uploader.id,
    },
  });

  try {
    const tiedCreatedAt = new Date("2026-01-02T03:04:05.000Z");
    const firstPhotoId = `photo-a-${suffix}`;
    const secondPhotoId = `photo-z-${suffix}`;
    const otherCommunityPhotoId = `photo-other-${suffix}`;

    await db.athletesPhoto.createMany({
      data: [
        {
          id: secondPhotoId,
          athletesCommunityId: firstCommunity.id,
          objectKey: `athletes-photos/${firstCommunity.id}/${secondPhotoId}`,
          contentType: "image/webp",
          sizeBytes: 22,
          uploadedByUserId: uploader.id,
          createdAt: tiedCreatedAt,
        },
        {
          id: firstPhotoId,
          athletesCommunityId: firstCommunity.id,
          objectKey: `athletes-photos/${firstCommunity.id}/${firstPhotoId}`,
          contentType: "image/jpeg",
          sizeBytes: 11,
          uploadedByUserId: uploader.id,
          createdAt: tiedCreatedAt,
        },
        {
          id: otherCommunityPhotoId,
          athletesCommunityId: secondCommunity.id,
          objectKey: `athletes-photos/${secondCommunity.id}/${otherCommunityPhotoId}`,
          contentType: "image/png",
          sizeBytes: 33,
          uploadedByUserId: uploader.id,
          createdAt: tiedCreatedAt,
        },
      ],
    });

    const created = await repository.create({
      id: `photo-created-${suffix}`,
      athletesCommunityId: firstCommunity.id,
      objectKey: `athletes-photos/${firstCommunity.id}/photo-created-${suffix}`,
      contentType: "image/png",
      sizeBytes: 44,
      uploadedByUserId: uploader.id,
    });

    assert.equal(created.athletesCommunityId, firstCommunity.id);
    assert.equal(created.contentType, "image/png");
    assert.equal(created.sizeBytes, 44);
    assert.equal(created.uploadedByUserId, uploader.id);
    assert.match(created.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(created.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

    const listed = await repository.listForCommunity(firstCommunity.id);
    assert.deepEqual(
      listed.map((photo) => photo.id),
      [firstPhotoId, secondPhotoId, created.id],
    );
    assert.ok(listed.every((photo) => photo.athletesCommunityId === firstCommunity.id));

    const sameCommunity = await repository.getForCommunity(firstCommunity.id, firstPhotoId);
    assert.equal(sameCommunity?.id, firstPhotoId);
    assert.equal(sameCommunity?.objectKey, `athletes-photos/${firstCommunity.id}/${firstPhotoId}`);

    const wrongCommunity = await repository.getForCommunity(
      firstCommunity.id,
      otherCommunityPhotoId,
    );
    assert.equal(wrongCommunity, null);

    const otherCommunity = await repository.getForCommunity(
      secondCommunity.id,
      otherCommunityPhotoId,
    );
    assert.equal(otherCommunity?.id, otherCommunityPhotoId);
  } finally {
    await db.athletesPhoto.deleteMany({
      where: { athletesCommunityId: { in: [firstCommunity.id, secondCommunity.id] } },
    });
    await db.athletesCommunity.deleteMany({
      where: { id: { in: [firstCommunity.id, secondCommunity.id] } },
    });
    await db.user.delete({ where: { id: uploader.id } });
  }
});
