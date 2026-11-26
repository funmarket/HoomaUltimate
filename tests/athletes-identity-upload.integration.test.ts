import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { getDatabaseClient } from "@hooma/database";
import type { ObjectStorage } from "@hooma/storage";
import { AthletesContentAuthorization } from "../apps/api/src/modules/athletes/application/athletes-content-authorizer.js";
import { AthletesIdentityMediaService } from "../apps/api/src/modules/athletes/application/athletes-identity-media.service.js";
import { AthletesService } from "../apps/api/src/modules/athletes/application/athletes.service.js";
import { planAthletesIdentityMasterKey } from "../apps/api/src/modules/athletes/application/athletes-identity-media.repository.js";
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

test("Athletes identity replacement and removal stay isolated by slot", async () => {
  const f = await fixture();
  try {
    const storage = {
      put: async (key: string, body: Uint8Array, contentType: string) => ({
        key,
        contentType,
        sizeBytes: body.byteLength,
      }),
      get: async () => {
        throw Error("not used by upload test");
      },
      remove: async () => {
        throw Error("cleanup is deferred to the worker");
      },
    };
    const service = new AthletesIdentityMediaService(
      new AthletesContentAuthorization(f.repository),
      new PrismaAthletesIdentityMediaRepository(db),
      storage as unknown as ObjectStorage,
      "staging",
      new AthletesIdentityImageProcessor(),
    );
    await f.repository.update(f.community.id, { logoUrl: "https://example.org/logo.png" });
    const firstLogo = await service.upload(f.user.id, f.community.id, "logo", f.input);
    const firstBanner = await service.upload(f.user.id, f.community.id, "banner", f.input);
    const replacementLogo = await service.upload(f.user.id, f.community.id, "logo", f.input);
    const replacementBanner = await service.upload(f.user.id, f.community.id, "banner", f.input);
    const afterReplacement = await db.athletesCommunity.findUniqueOrThrow({
      where: { id: f.community.id },
    });
    assert.equal(afterReplacement.logoMediaId, replacementLogo.mediaId);
    assert.equal(afterReplacement.bannerMediaId, replacementBanner.mediaId);
    assert.equal(afterReplacement.bannerUrl, null);
    assert.equal(afterReplacement.logoUrl, "https://example.org/logo.png");
    await db.athletesCommunity.update({
      where: { id: f.community.id },
      data: { logoObjectKey: afterReplacement.logoObjectKey + "-wrong" },
    });
    await assert.rejects(service.removeIdentity(f.user.id, f.community.id, "logo"), {
      code: "ATHLETES_CONFLICT",
    });
    assert.equal(await db.outboxEvent.count({ where: { id: replacementLogo.mediaId } }), 0);
    await db.athletesCommunity.update({
      where: { id: f.community.id },
      data: { logoObjectKey: afterReplacement.logoObjectKey },
    });
    const oldLogoCleanup = await db.outboxEvent.findUniqueOrThrow({
      where: { id: firstLogo.mediaId },
    });
    assert.equal(oldLogoCleanup.topic, topic);
    assert.equal((oldLogoCleanup.payload as { slot: string }).slot, "logo");
    const oldBannerCleanup = await db.outboxEvent.findUniqueOrThrow({
      where: { id: firstBanner.mediaId },
    });
    assert.equal((oldBannerCleanup.payload as { slot: string }).slot, "banner");

    assert.deepEqual(await service.removeIdentity(f.user.id, f.community.id, "logo"), {
      removed: true,
    });
    const afterLogoRemoval = await db.athletesCommunity.findUniqueOrThrow({
      where: { id: f.community.id },
    });
    assert.equal(afterLogoRemoval.logoMediaId, null);
    assert.equal(afterLogoRemoval.logoObjectKey, null);
    assert.equal(afterLogoRemoval.logoContentType, null);
    assert.equal(afterLogoRemoval.logoSizeBytes, null);
    assert.equal(afterLogoRemoval.bannerMediaId, replacementBanner.mediaId);
    assert.equal(afterLogoRemoval.bannerObjectKey, afterReplacement.bannerObjectKey);
    assert.equal(afterLogoRemoval.logoUrl, "https://example.org/logo.png");
    const removedLogoCleanup = await db.outboxEvent.findUniqueOrThrow({
      where: { id: replacementLogo.mediaId },
    });
    assert.equal(removedLogoCleanup.topic, topic);
    assert.deepEqual(removedLogoCleanup.payload, {
      athletesCommunityId: f.community.id,
      mediaId: replacementLogo.mediaId,
      slot: "logo",
      objectKey: afterReplacement.logoObjectKey,
    });
    assert.deepEqual(await service.removeIdentity(f.user.id, f.community.id, "banner"), {
      removed: true,
    });
    assert.deepEqual(await service.removeIdentity(f.user.id, f.community.id, "banner"), {
      removed: false,
    });
    const final = await db.athletesCommunity.findUniqueOrThrow({
      where: { id: f.community.id },
    });
    assert.equal(final.logoMediaId, null);
    assert.equal(final.bannerMediaId, null);
    assert.equal(final.logoUrl, "https://example.org/logo.png");
    const removedBannerCleanup = await db.outboxEvent.findUniqueOrThrow({
      where: { id: replacementBanner.mediaId },
    });
    assert.deepEqual(removedBannerCleanup.payload, {
      athletesCommunityId: f.community.id,
      mediaId: replacementBanner.mediaId,
      slot: "banner",
      objectKey: afterReplacement.bannerObjectKey,
    });
  } finally {
    await f.cleanup();
  }
});

test("Athletes identity writes require an active Founder, not just membership", async () => {
  const f = await fixture();
  const member = await db.user.create({ data: {} });
  let writes = 0;
  try {
    await db.athletesMembership.create({
      data: {
        athletesCommunityId: f.community.id,
        userId: member.id,
        role: "MEMBER",
      },
    });
    const mediaId = randomUUID();
    const objectKey = planAthletesIdentityMasterKey("staging", f.community.id, mediaId, "logo");
    await db.athletesCommunity.update({
      where: { id: f.community.id },
      data: {
        logoMediaId: mediaId,
        logoObjectKey: objectKey,
        logoContentType: "image/webp",
        logoSizeBytes: 4,
      },
    });
    const service = new AthletesIdentityMediaService(
      new AthletesContentAuthorization(f.repository),
      new PrismaAthletesIdentityMediaRepository(db),
      {
        put: async (key: string, body: Uint8Array, contentType: string) => {
          writes++;
          return { key, contentType, sizeBytes: body.byteLength };
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

    await assert.rejects(service.upload(member.id, f.community.id, "banner", f.input), {
      code: "ATHLETES_FOUNDER_REQUIRED",
    });
    await assert.rejects(service.removeIdentity(member.id, f.community.id, "logo"), {
      code: "ATHLETES_FOUNDER_REQUIRED",
    });
    assert.equal(writes, 0);
    assert.equal(await db.outboxEvent.count({ where: { aggregateId: f.community.id } }), 0);
    assert.equal(
      (await db.athletesCommunity.findUniqueOrThrow({ where: { id: f.community.id } })).logoMediaId,
      mediaId,
    );

    await db.athletesCommunity.update({
      where: { id: f.community.id },
      data: { status: "ARCHIVED" },
    });
    await assert.rejects(service.upload(f.user.id, f.community.id, "banner", f.input), {
      code: "ATHLETES_NOT_FOUND",
    });
    await assert.rejects(service.removeIdentity(f.user.id, f.community.id, "logo"), {
      code: "ATHLETES_NOT_FOUND",
    });
    assert.equal(writes, 0);
    assert.equal(await db.outboxEvent.count({ where: { aggregateId: f.community.id } }), 0);
  } finally {
    await f.cleanup();
    await db.user.delete({ where: { id: member.id } });
  }
});

test("Athletes upload rechecks Founder authorization after object storage completes", async () => {
  const f = await fixture();
  let signalStarted = () => {};
  let allowCompletion = () => {};
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const completion = new Promise<void>((resolve) => {
    allowCompletion = resolve;
  });
  try {
    const service = new AthletesIdentityMediaService(
      new AthletesContentAuthorization(f.repository),
      new PrismaAthletesIdentityMediaRepository(db),
      {
        put: async (key: string, body: Uint8Array, contentType: string) => {
          signalStarted();
          await completion;
          return { key, contentType, sizeBytes: body.byteLength };
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
    const pendingUpload = service.upload(f.user.id, f.community.id, "logo", f.input);
    await started;
    await db.athletesMembership.updateMany({
      where: {
        athletesCommunityId: f.community.id,
        userId: f.user.id,
        role: "FOUNDER",
        leftAt: null,
      },
      data: { role: "MEMBER" },
    });
    allowCompletion();
    await assert.rejects(pendingUpload, { code: "ATHLETES_FOUNDER_REQUIRED" });
    const current = await db.athletesCommunity.findUniqueOrThrow({
      where: { id: f.community.id },
    });
    assert.equal(current.logoMediaId, null);
    assert.equal(current.logoObjectKey, null);
    assert.equal(await db.outboxEvent.count({ where: { aggregateId: f.community.id } }), 1);
  } finally {
    allowCompletion();
    await f.cleanup();
  }
});

test("Archiving blocks an in-flight identity replacement and preserves the current image", async () => {
  const f = await fixture();
  let holdNextPut = false;
  let signalStarted = () => {};
  let allowCompletion = () => {};
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const completion = new Promise<void>((resolve) => {
    allowCompletion = resolve;
  });
  try {
    const athletes = new AthletesService(f.repository, {
      findLastSeenByUserIds: async () => new Map<string, Date | null>(),
    });
    const storage = {
      put: async (key: string, body: Uint8Array, contentType: string) => {
        if (holdNextPut) {
          signalStarted();
          await completion;
        }
        return { key, contentType, sizeBytes: body.byteLength };
      },
      get: async () => {
        throw Error("not used by upload test");
      },
      remove: async () => {
        throw Error("cleanup is deferred to the worker");
      },
    };
    const media = new AthletesIdentityMediaService(
      athletes,
      new PrismaAthletesIdentityMediaRepository(db),
      storage as unknown as ObjectStorage,
      "staging",
      new AthletesIdentityImageProcessor(),
    );
    const currentLogo = await media.upload(f.user.id, f.community.id, "logo", f.input);
    const beforeArchive = await db.athletesCommunity.findUniqueOrThrow({
      where: { id: f.community.id },
    });
    holdNextPut = true;
    const replacement = media.upload(f.user.id, f.community.id, "logo", f.input);
    await started;
    assert.deepEqual(await athletes.archive(f.user.id, f.community.id), { ok: true });
    allowCompletion();
    await assert.rejects(replacement, { code: "ATHLETES_NOT_FOUND" });

    const archived = await db.athletesCommunity.findUniqueOrThrow({
      where: { id: f.community.id },
    });
    assert.equal(archived.status, "ARCHIVED");
    assert.equal(archived.logoMediaId, currentLogo.mediaId);
    assert.equal(archived.logoObjectKey, beforeArchive.logoObjectKey);
    assert.equal(archived.bannerMediaId, null);
    assert.equal(await db.outboxEvent.count({ where: { aggregateId: f.community.id } }), 1);
    await assert.rejects(media.removeIdentity(f.user.id, f.community.id, "logo"), {
      code: "ATHLETES_NOT_FOUND",
    });
  } finally {
    allowCompletion();
    await f.cleanup();
  }
});
