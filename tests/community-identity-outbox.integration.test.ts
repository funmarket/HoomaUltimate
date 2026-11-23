import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { getDatabaseClient } from "@hooma/database";
import type { ObjectStorage } from "@hooma/storage";
import { CommunityIdentityImageProcessor } from "../apps/api/src/modules/communities/infrastructure/community-identity-image-processor.js";
import { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";
import { CommunityIdentityMediaService } from "../apps/api/src/modules/communities/application/community-identity-media.service.js";
import { PrismaCommunityRepository } from "../apps/api/src/modules/communities/infrastructure/prisma-community.repository.js";

const db = getDatabaseClient();
const topic = "community.identity-media.reconcile-object";

async function fixture() {
  const user = await db.user.create({ data: {} });
  const community = await db.community.create({
    data: {
      slug: `step24-upload-${randomUUID()}`,
      name: "Step 24 upload",
      createdByUserId: user.id,
    },
  });
  const repository = new PrismaCommunityRepository(db);
  const authorizer = new CommunityService(repository);
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
    await db.community.delete({ where: { id: community.id } });
    await db.user.delete({ where: { id: user.id } });
  };
  return { user, community, repository, authorizer, input, cleanup };
}

test("Community logo stores an exact planned intent before PUT and atomically adopts it", async () => {
  const f = await fixture();
  const written: string[] = [];
  try {
    const storage = {
      put: async (key: string, body: Uint8Array, contentType: string) => {
        const intent = await db.outboxEvent.findFirst({ where: { aggregateId: f.community.id } });
        assert.equal(intent?.status, "PENDING");
        assert.equal(intent?.topic, topic);
        assert.equal((intent.payload as { objectKey: string }).objectKey, key);
        written.push(key);
        return { key, contentType, sizeBytes: body.byteLength };
      },
      remove: async () => {
        throw Error("no synchronous cleanup");
      },
    };
    const service = new CommunityIdentityMediaService(
      f.authorizer,
      f.repository,
      storage as unknown as ObjectStorage,
      "staging",
      new CommunityIdentityImageProcessor(),
    );
    const result = await service.upload(f.user.id, f.community.id, "logo", f.input);
    const current = await db.community.findUniqueOrThrow({ where: { id: f.community.id } });
    assert.equal(current.logoMediaId, result.mediaId);
    assert.equal(current.logoObjectKey, written[0]);
    assert.match(current.logoObjectKey!, /^staging\/media\/v1\/community-logo\//);
    assert.equal(current.logoContentType, "image/webp");
    assert.ok((current.logoSizeBytes ?? 0) > 0);
    assert.equal(current.bannerMediaId, null);
    assert.equal(await db.outboxEvent.count({ where: { id: result.mediaId } }), 0);
  } finally {
    await f.cleanup();
  }
});

test("Community upload retains durable exact-key intent when object PUT fails", async () => {
  const f = await fixture();
  try {
    let intendedKey = "";
    const storage = {
      put: async (key: string) => {
        intendedKey = key;
        assert.equal(await db.outboxEvent.count({ where: { aggregateId: f.community.id } }), 1);
        throw Error("storage unavailable");
      },
      remove: async () => {
        throw Error("no synchronous cleanup");
      },
    };
    const service = new CommunityIdentityMediaService(
      f.authorizer,
      f.repository,
      storage as unknown as ObjectStorage,
      "staging",
      new CommunityIdentityImageProcessor(),
    );
    await assert.rejects(service.upload(f.user.id, f.community.id, "banner", f.input));
    const intent = await db.outboxEvent.findFirstOrThrow({
      where: { aggregateId: f.community.id },
    });
    assert.equal((intent.payload as { objectKey: string }).objectKey, intendedKey);
    assert.equal(intent.status, "PENDING");
    assert.equal(
      (await db.community.findUniqueOrThrow({ where: { id: f.community.id } })).bannerMediaId,
      null,
    );
  } finally {
    await f.cleanup();
  }
});

test("Community upload rejects returned key mismatch without adopting or erasing intent", async () => {
  const f = await fixture();
  try {
    const storage = {
      put: async (key: string, body: Uint8Array) => ({
        key: `${key}-wrong`,
        contentType: "image/webp",
        sizeBytes: body.byteLength,
      }),
      remove: async () => {
        throw Error("no synchronous cleanup");
      },
    };
    const service = new CommunityIdentityMediaService(
      f.authorizer,
      f.repository,
      storage as unknown as ObjectStorage,
      "staging",
      new CommunityIdentityImageProcessor(),
    );
    await assert.rejects(service.upload(f.user.id, f.community.id, "logo", f.input));
    assert.equal(await db.outboxEvent.count({ where: { aggregateId: f.community.id } }), 1);
    assert.equal(
      (await db.community.findUniqueOrThrow({ where: { id: f.community.id } })).logoMediaId,
      null,
    );
  } finally {
    await f.cleanup();
  }
});

test("Community adoption rejects claimed, expired, mismatched and missing intents", async () => {
  const f = await fixture();
  try {
    const mediaId = randomUUID();
    const key = `staging/media/v1/community-logo/${f.community.id}/${mediaId}/master.webp`;
    const input = {
      communityId: f.community.id,
      mediaId,
      slot: "logo" as const,
      objectKey: key,
      contentType: "image/webp" as const,
      sizeBytes: 4,
    };
    await f.repository.prepareIdentityUpload(input);
    await assert.rejects(
      f.repository.adoptPreparedIdentity({ ...input, objectKey: `${key}-wrong` }),
    );
    await db.outboxEvent.update({ where: { id: mediaId }, data: { claimedAt: new Date() } });
    await assert.rejects(f.repository.adoptPreparedIdentity(input));
    await db.outboxEvent.update({
      where: { id: mediaId },
      data: { claimedAt: null, availableAt: new Date(Date.now() - 1000) },
    });
    await assert.rejects(f.repository.adoptPreparedIdentity(input));
    assert.equal(
      (await db.community.findUniqueOrThrow({ where: { id: f.community.id } })).logoMediaId,
      null,
    );
  } finally {
    await f.cleanup();
  }
});

test("Community upload fails before preparation when storage or scope is absent", async () => {
  const f = await fixture();
  try {
    const processor = new CommunityIdentityImageProcessor();
    const service = new CommunityIdentityMediaService(
      f.authorizer,
      f.repository,
      null,
      "staging",
      processor,
    );
    await assert.rejects(service.upload(f.user.id, f.community.id, "logo", f.input));
    const noScope = new CommunityIdentityMediaService(
      f.authorizer,
      f.repository,
      {
        put: async () => {
          throw Error("not reached");
        },
      } as unknown as ObjectStorage,
      null,
      processor,
    );
    await assert.rejects(noScope.upload(f.user.id, f.community.id, "logo", f.input));
    assert.equal(await db.outboxEvent.count({ where: { aggregateId: f.community.id } }), 0);
  } finally {
    await f.cleanup();
  }
});

test("Community rejects malformed processor variant set before preparation and PUT", async () => {
  const f = await fixture();
  try {
    const delegate = new CommunityIdentityImageProcessor();
    let writes = 0;
    const malformed = {
      process: async (body: Uint8Array, contentType: "image/png" | "image/jpeg" | "image/webp") => {
        const actual = await delegate.process(body, contentType);
        return { ...actual, selectedVariants: ["master", "card"] as const };
      },
    };
    const storage = {
      put: async () => {
        writes++;
        throw Error("must not write");
      },
    } as unknown as ObjectStorage;
    const service = new CommunityIdentityMediaService(
      f.authorizer,
      f.repository,
      storage,
      "staging",
      malformed,
    );
    await assert.rejects(service.upload(f.user.id, f.community.id, "banner", f.input));
    assert.equal(writes, 0);
    assert.equal(await db.outboxEvent.count({ where: { aggregateId: f.community.id } }), 0);
  } finally {
    await f.cleanup();
  }
});
