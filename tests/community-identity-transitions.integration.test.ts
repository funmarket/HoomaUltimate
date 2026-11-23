import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { getDatabaseClient } from "@hooma/database";
import { communityCreateSchema, communityUpdateSchema } from "@hooma/contracts/communities";
import type { ObjectStorage } from "@hooma/storage";
import { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";
import { CommunityIdentityMediaService } from "../apps/api/src/modules/communities/application/community-identity-media.service.js";
import { CommunityIdentityImageProcessor } from "../apps/api/src/modules/communities/infrastructure/community-identity-image-processor.js";
import { PrismaCommunityRepository } from "../apps/api/src/modules/communities/infrastructure/prisma-community.repository.js";

const db = getDatabaseClient();
const sources = [
  ["empty", "external"],
  ["empty", "managed"],
  ["external", "external"],
  ["external", "managed"],
  ["managed", "managed"],
  ["managed", "external"],
  ["managed", "empty"],
  ["external", "empty"],
] as const;

type Slot = "logo" | "banner";
type Source = "empty" | "external" | "managed";

const body = new Uint8Array(
  await sharp({ create: { width: 24, height: 18, channels: 3, background: "#6699cc" } })
    .png()
    .toBuffer(),
);

async function fixture(slot: Slot) {
  const user = await db.user.create({ data: {} });
  const opposite = "https://images.example.org/independent-other-slot.png";
  const community = await db.community.create({
    data: {
      slug: `step24-transition-${randomUUID()}`,
      name: "Step 24 transitions",
      createdByUserId: user.id,
      ...(slot === "logo" ? { bannerUrl: opposite } : { logoUrl: opposite }),
    },
  });
  const repo = new PrismaCommunityRepository(db);
  const communities = new CommunityService(repo);
  const storage = {
    put: async (key: string, input: Uint8Array, contentType: string) => ({
      key,
      contentType,
      sizeBytes: input.byteLength,
    }),
    remove: async () => {
      throw Error("the Worker owns physical deletion");
    },
  } as unknown as ObjectStorage;
  const media = new CommunityIdentityMediaService(
    communities,
    repo,
    storage,
    "staging",
    new CommunityIdentityImageProcessor(),
  );
  const cleanup = async () => {
    await db.outboxEvent.deleteMany({ where: { aggregateId: community.id } });
    await db.community.delete({ where: { id: community.id } });
    await db.user.delete({ where: { id: user.id } });
  };
  return { user, community, repo, communities, media, opposite, cleanup };
}

async function setSource(
  slot: Slot,
  source: Source,
  marker: string,
  f: Awaited<ReturnType<typeof fixture>>,
) {
  if (source === "managed") {
    return f.media.upload(f.user.id, f.community.id, slot, {
      body,
      contentType: "image/png",
    });
  }
  const value = source === "external" ? `https://images.example.org/${slot}-${marker}.png` : null;
  await f.communities.update(
    f.user.id,
    f.community.id,
    slot === "logo" ? { logoUrl: value } : { bannerUrl: value },
  );
  return null;
}

for (const slot of ["logo", "banner"] as const) {
  for (const [from, to] of sources) {
    test(`${slot}: ${from} -> ${to} retains slot independence and exact cleanup`, async () => {
      const f = await fixture(slot);
      try {
        await setSource(slot, from, "previous", f);
        const before = await db.community.findUniqueOrThrow({ where: { id: f.community.id } });
        const oldMediaId = slot === "logo" ? before.logoMediaId : before.bannerMediaId;
        await setSource(slot, to, "next", f);
        const after = await db.community.findUniqueOrThrow({ where: { id: f.community.id } });
        const newMediaId = slot === "logo" ? after.logoMediaId : after.bannerMediaId;
        const currentUrl = slot === "logo" ? after.logoUrl : after.bannerUrl;
        const objectKey = slot === "logo" ? after.logoObjectKey : after.bannerObjectKey;
        const otherUrl = slot === "logo" ? after.bannerUrl : after.logoUrl;
        assert.equal(otherUrl, f.opposite);
        assert.equal(slot === "logo" ? after.bannerMediaId : after.logoMediaId, null);
        if (to === "managed") {
          assert.ok(newMediaId);
          assert.equal(currentUrl, null);
          assert.match(objectKey!, new RegExp(`^staging/media/v1/community-${slot}/`));
        } else {
          assert.equal(newMediaId, null);
          assert.equal(objectKey, null);
          assert.equal(
            currentUrl,
            to === "external" ? `https://images.example.org/${slot}-next.png` : null,
          );
        }
        if (oldMediaId) {
          const oldIntent = await db.outboxEvent.findUnique({ where: { id: oldMediaId } });
          assert.equal(oldIntent?.status, "PENDING");
          assert.equal(oldIntent?.topic, "community.identity-media.reconcile-object");
          assert.equal((oldIntent?.payload as { mediaId: string }).mediaId, oldMediaId);
        } else {
          assert.equal(await db.outboxEvent.count({ where: { aggregateId: f.community.id } }), 0);
        }
      } finally {
        await f.cleanup();
      }
    });
  }
}

test("Community identity URL source selection accepts only HTTP or HTTPS", () => {
  for (const value of ["ftp://example.org/logo.png", "file:///image.png"]) {
    assert.equal(communityUpdateSchema.safeParse({ logoUrl: value }).success, false);
    assert.equal(communityUpdateSchema.safeParse({ bannerUrl: value }).success, false);
  }
  assert.equal(
    communityCreateSchema.safeParse({
      name: "Test HOOMA",
      logoUrl: "https://example.org/logo.png",
      bannerUrl: "http://example.org/banner.png",
    }).success,
    true,
  );
});
