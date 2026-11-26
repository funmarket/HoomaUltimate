import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { getDatabaseClient } from "@hooma/database";
import type { ObjectStorage } from "@hooma/storage";
import { AthletesContentAuthorization } from "../apps/api/src/modules/athletes/application/athletes-content-authorizer.js";
import { AthletesIdentityMediaService } from "../apps/api/src/modules/athletes/application/athletes-identity-media.service.js";
import { PrismaAthletesIdentityMediaRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes-identity-media.repository.js";
import { AthletesIdentityImageProcessor } from "../apps/api/src/modules/athletes/infrastructure/athletes-identity-image-processor.js";
import { PrismaAthletesRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes.repository.js";

const db = getDatabaseClient();
const topic = "athletes.identity-media.reconcile-object";

async function fixture() {
  const user = await db.user.create({ data: {} });
  const repository = new PrismaAthletesRepository(db);
  const community = await repository.createWithFounder(user.id, {
    name: `Athletes upload ${randomUUID()}`,
    sport: "RUNNING",
    visibility: "PUBLIC",
    joinPolicy: "OPEN",
  });
  const input = {
    body: new Uint8Array(
      await sharp({ create: { width: 24, height: 18, channels: 3, background: "#ffffff" } })
        .png()
        .toBuffer(),
    ),
    contentType: "image/png",
  };
  const cleanup = async () => {
    await db.outboxEvent.deleteMany({ where: { aggregateId: community.id } });
    await db.athletesCommunity.delete({ where: { id: community.id } });
    await db.user.delete({ where: { id: user.id } });
  };
  return { user, community, repository, input, cleanup };
}

test("Athletes logo and banner uploads prepare exact intents and adopt processed images", async () => {
  const f = await fixture();
  const written: string[] = [];
  try {
    const storage = {
      put: async (key: string, body: Uint8Array, contentType: string) => {
        const intent = await db.outboxEvent.findFirst({ where: { aggregateId: f.community.id } });
        assert.equal(intent?.status, "PENDING");
        assert.equal(intent?.topic, topic);
        assert.equal((intent?.payload as { objectKey: string }).objectKey, key);
        assert.equal(contentType, "image/webp");
        written.push(key);
        return { key, contentType, sizeBytes: body.byteLength };
      },
      get: async () => {
        throw Error("not used by upload test");
      },
      remove: async () => {
        throw Error("no synchronous cleanup");
      },
    };
    const service = new AthletesIdentityMediaService(
      new AthletesContentAuthorization(f.repository),
      new PrismaAthletesIdentityMediaRepository(db),
      storage as unknown as ObjectStorage,
      "staging",
      new AthletesIdentityImageProcessor(),
    );
    for (const slot of ["logo", "banner"] as const) {
      const result = await service.upload(f.user.id, f.community.id, slot, f.input);
      assert.ok(result.mediaId);
    }
    const current = await db.athletesCommunity.findUniqueOrThrow({
      where: { id: f.community.id },
    });
    assert.match(current.logoObjectKey!, /^staging\/media\/v1\/athletes-community-logo\//);
    assert.match(current.bannerObjectKey!, /^staging\/media\/v1\/athletes-community-banner\//);
    assert.equal(current.logoObjectKey, written[0]);
    assert.equal(current.bannerObjectKey, written[1]);
    assert.equal(current.logoContentType, "image/webp");
    assert.equal(current.bannerContentType, "image/webp");
    assert.ok((current.logoSizeBytes ?? 0) > 0);
    assert.ok((current.bannerSizeBytes ?? 0) > 0);
    assert.equal(await db.outboxEvent.count({ where: { aggregateId: f.community.id } }), 0);
  } finally {
    await f.cleanup();
  }
});

test("Athletes upload rejects unsupported and empty input before preparing storage intent", async () => {
  const f = await fixture();
  let writes = 0;
  try {
    const service = new AthletesIdentityMediaService(
      new AthletesContentAuthorization(f.repository),
      new PrismaAthletesIdentityMediaRepository(db),
      {
        put: async () => {
          writes++;
          throw Error("not reached");
        },
        get: async () => {
          throw Error("not used");
        },
        remove: async () => {
          throw Error("not used");
        },
      } as unknown as ObjectStorage,
      "staging",
      new AthletesIdentityImageProcessor(),
    );
    await assert.rejects(
      service.upload(f.user.id, f.community.id, "logo", {
        body: f.input.body,
        contentType: "image/gif",
      }),
      { code: "ATHLETES_IDENTITY_MEDIA_TYPE_INVALID" },
    );
    await assert.rejects(
      service.upload(f.user.id, f.community.id, "banner", {
        body: new Uint8Array(),
        contentType: "image/png",
      }),
      { code: "ATHLETES_IDENTITY_MEDIA_SIZE_INVALID" },
    );
    assert.equal(writes, 0);
    assert.equal(await db.outboxEvent.count({ where: { aggregateId: f.community.id } }), 0);
  } finally {
    await f.cleanup();
  }
});
