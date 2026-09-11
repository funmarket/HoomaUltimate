import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { getDatabaseClient } from "@hooma/database";
import { ATHLETES_PHOTO_RECONCILE_TOPIC } from "@hooma/contracts/athletes";
import { AthletesContentAuthorization } from "../apps/api/src/modules/athletes/application/athletes-content-authorizer.js";
import { AthletesService } from "../apps/api/src/modules/athletes/application/athletes.service.js";
import { PrismaAthletesRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes.repository.js";
import { PrismaAthletesPhotoRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes-photo.repository.js";
import { createAthletesPhotoCleanupHandler } from "../apps/worker/src/athletes/athletes-photo-cleanup.js";
import { OutboxRepository } from "../apps/worker/src/outbox/outbox.repository.js";
import { OutboxRunner } from "../apps/worker/src/outbox/outbox.runner.js";

const db = getDatabaseClient();
test("Athletes recovery survives failed publication and never deletes a published photo", async () => {
  const user = await db.user.create({ data: {} });
  const athletes = new AthletesService(new PrismaAthletesRepository(db));
  const community = await athletes.create(user.id, {
    name: `Photo recovery ${randomUUID()}`,
    sport: "RUNNING",
    visibility: "PUBLIC",
    joinPolicy: "OPEN",
  });
  const photos = new PrismaAthletesPhotoRepository(db);
  const publishedId = randomUUID();
  const failedId = randomUUID();
  const removed: string[] = [];
  const cleanup = createAthletesPhotoCleanupHandler(db, {
    put: async () => {
      throw new Error("not used");
    },
    get: async () => {
      throw new Error("not used");
    },
    remove: async (key) => {
      removed.push(key);
    },
  });
  const key = (id: string) => `athletes-photos/${community.id}/${id}`;
  const metadata = (id: string) => ({
    id,
    athletesCommunityId: community.id,
    objectKey: key(id),
    contentType: "image/png",
    sizeBytes: 10,
    uploadedByUserId: user.id,
  });
  const publish = async (input: ReturnType<typeof metadata>) =>
    photos.withCommunityLock(input.athletesCommunityId, async (scope) => {
      const authorization = new AthletesContentAuthorization(scope.athletes);
      await authorization.requireFounderContent(input.uploadedByUserId, input.athletesCommunityId);
      return scope.photos.createPrepared(input);
    });
  try {
    await photos.prepareUpload(publishedId, community.id, key(publishedId));
    assert.ok(await db.outboxEvent.findUnique({ where: { id: publishedId } }));
    await publish(metadata(publishedId));
    assert.equal(await db.outboxEvent.findUnique({ where: { id: publishedId } }), null);
    await cleanup({
      id: publishedId,
      topic: ATHLETES_PHOTO_RECONCILE_TOPIC,
      payload: {
        photoId: publishedId,
        athletesCommunityId: community.id,
        objectKey: key(publishedId),
      },
    });
    assert.deepEqual(removed, []);

    await photos.prepareUpload(failedId, community.id, key(failedId));
    await athletes.archive(user.id, community.id);
    await assert.rejects(() => publish(metadata(failedId)), /not found/);
    assert.ok(await db.outboxEvent.findUnique({ where: { id: failedId } }));
    await db.outboxEvent.update({ where: { id: failedId }, data: { availableAt: new Date(0) } });
    const runner = new OutboxRunner(
      new OutboxRepository(db),
      new Map([[ATHLETES_PHOTO_RECONCILE_TOPIC, cleanup]]),
    );
    const result = await runner.runOnce();
    assert.equal(result.delivered, 1);
    assert.deepEqual(removed, [key(failedId)]);
    assert.equal(
      (await db.outboxEvent.findUniqueOrThrow({ where: { id: failedId } })).status,
      "DELIVERED",
    );
    assert.ok(await db.athletesPhoto.findUnique({ where: { id: publishedId } }));
    await assert.rejects(
      () =>
        cleanup({
          id: failedId,
          topic: ATHLETES_PHOTO_RECONCILE_TOPIC,
          payload: {
            photoId: failedId,
            athletesCommunityId: community.id,
            objectKey: "another-domain/photo",
          },
        }),
      /ownership boundary/,
    );
  } finally {
    await db.outboxEvent.deleteMany({ where: { id: { in: [publishedId, failedId] } } });
    await db.athletesPhoto.deleteMany({ where: { athletesCommunityId: community.id } });
    await db.athletesCommunity.delete({ where: { id: community.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
