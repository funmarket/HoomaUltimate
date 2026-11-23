import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import express from "express";
import sharp from "sharp";
import { getDatabaseClient } from "@hooma/database";
import type { ObjectStorage } from "@hooma/storage";
import { errorHandler } from "../apps/api/src/http/errors/error-handler.js";
import { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";
import { CommunityIdentityMediaService } from "../apps/api/src/modules/communities/application/community-identity-media.service.js";
import { createCommunityPublicRouter } from "../apps/api/src/modules/communities/http/community.routes.js";
import { CommunityIdentityImageProcessor } from "../apps/api/src/modules/communities/infrastructure/community-identity-image-processor.js";
import { PrismaCommunityRepository } from "../apps/api/src/modules/communities/infrastructure/prisma-community.repository.js";

const db = getDatabaseClient();
const body = new Uint8Array(
  await sharp({ create: { width: 24, height: 18, channels: 3, background: "#99ccff" } })
    .png()
    .toBuffer(),
);

async function fixture(visibility: "PUBLIC" | "PRIVATE" = "PUBLIC") {
  const user = await db.user.create({ data: {} });
  const community = await db.community.create({
    data: {
      slug: `step24-content-${randomUUID()}`,
      name: "Step 24 content",
      visibility,
      createdByUserId: user.id,
      logoUrl: "https://images.example.org/legacy-logo.png",
      bannerUrl: "https://images.example.org/legacy-banner.png",
    },
  });
  const stored = new Map<string, { body: Uint8Array; contentType: string; sizeBytes: number }>();
  let reads = 0;
  const storage = {
    put: async (key: string, bytes: Uint8Array, contentType: string) => {
      stored.set(key, { body: bytes, contentType, sizeBytes: bytes.byteLength });
      return { key, contentType, sizeBytes: bytes.byteLength };
    },
    get: async (key: string) => {
      reads++;
      const object = stored.get(key);
      if (!object) throw Error("not found");
      return { key, ...object };
    },
    remove: async () => {
      throw Error("only Worker removes managed bytes");
    },
  } as ObjectStorage;
  const repository = new PrismaCommunityRepository(db);
  const communities = new CommunityService(repository);
  const media = new CommunityIdentityMediaService(
    communities,
    repository,
    storage,
    "staging",
    new CommunityIdentityImageProcessor(),
  );
  const cleanup = async () => {
    await db.outboxEvent.deleteMany({ where: { aggregateId: community.id } });
    await db.community.delete({ where: { id: community.id } });
    await db.user.delete({ where: { id: user.id } });
  };
  return {
    user,
    community,
    repository,
    communities,
    media,
    stored,
    cleanup,
    get reads() {
      return reads;
    },
  };
}

test("Community external URLs preserve original public list/detail and management responses", async () => {
  const f = await fixture();
  try {
    const detail = (await f.communities.getPublic(f.community.id)) as {
      logoUrl: string | null;
      bannerUrl: string | null;
    };
    assert.equal(detail.logoUrl, "https://images.example.org/legacy-logo.png");
    assert.equal(detail.bannerUrl, "https://images.example.org/legacy-banner.png");
    const list = await f.communities.listPublic();
    const item = (list.items as Array<{ id: string; logoUrl: string | null }>).find(
      ({ id }) => id === f.community.id,
    );
    assert.equal(item?.logoUrl, detail.logoUrl);
    const updated = await f.communities.update(f.user.id, f.community.id, { name: "Updated" });
    assert.equal(JSON.stringify(updated).includes("ObjectKey"), false);
    assert.equal(JSON.stringify(updated).includes("MediaId"), false);
  } finally {
    await f.cleanup();
  }
});

for (const slot of ["logo", "banner"] as const) {
  test(`Community managed ${slot} is publicly delivered without object-key leakage`, async () => {
    const f = await fixture("PRIVATE");
    try {
      await f.media.upload(f.user.id, f.community.id, slot, { body, contentType: "image/png" });
      const detail = (await f.communities.getPublic(f.community.id)) as {
        logoUrl: string | null;
        bannerUrl: string | null;
      };
      const path = `/api/public/v1/communities/${f.community.id}/identity/${slot}/content`;
      assert.equal(slot === "logo" ? detail.logoUrl : detail.bannerUrl, path);
      assert.equal(
        slot === "logo" ? detail.bannerUrl : detail.logoUrl,
        slot === "logo"
          ? "https://images.example.org/legacy-banner.png"
          : "https://images.example.org/legacy-logo.png",
      );
      const listed = await f.communities.listPublic();
      const summary = (
        listed.items as Array<{ id: string; logoUrl: string | null; bannerUrl: string | null }>
      ).find(({ id }) => id === f.community.id);
      assert.equal(slot === "logo" ? summary?.logoUrl : summary?.bannerUrl, path);
      assert.equal(JSON.stringify(detail).includes("/media/v1/"), false);
      assert.equal(JSON.stringify(summary).includes("ObjectKey"), false);

      const app = express();
      app.use("/api/public/v1/communities", createCommunityPublicRouter(f.communities, f.media));
      app.use(errorHandler);
      const server = app.listen(0);
      try {
        const address = server.address();
        assert.ok(address && typeof address !== "string");
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /^image\/webp/);
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        assert.equal(response.headers.get("cross-origin-resource-policy"), "cross-origin");
        const bytes = new Uint8Array(await response.arrayBuffer());
        assert.equal((await sharp(bytes).metadata()).format, "webp");
        const storedKey = (
          await db.community.findUniqueOrThrow({
            where: { id: f.community.id },
          })
        )[slot === "logo" ? "logoObjectKey" : "bannerObjectKey"];
        assert.ok(storedKey);
        assert.equal(JSON.stringify(detail).includes(storedKey!), false);
        assert.equal(JSON.stringify(summary).includes(storedKey!), false);
      } finally {
        server.close();
      }
    } finally {
      await f.cleanup();
    }
  });
}

test("Community archived or wrong-key image references are not publicly delivered", async () => {
  const f = await fixture();
  try {
    await f.media.upload(f.user.id, f.community.id, "logo", { body, contentType: "image/png" });
    const beforeReads = f.reads;
    await db.community.update({
      where: { id: f.community.id },
      data: { logoObjectKey: "staging/media/v1/community-logo/wrong-owner/image/master.webp" },
    });
    await assert.rejects(f.media.contentPublic(f.community.id, "logo"));
    assert.equal(f.reads, beforeReads);
    await f.communities.archive(f.user.id, f.community.id);
    await assert.rejects(f.media.contentPublic(f.community.id, "logo"));
    assert.equal(f.reads, beforeReads);
  } finally {
    await f.cleanup();
  }
});

test("Full Community HTTP upload and public content preserve auth, URL shape and bytes", async () => {
  const { loadApiConfig } = await import("@hooma/config");
  const { createContainer } = await import("../apps/api/src/bootstrap/container.js");
  const { createApp } = await import("../apps/api/src/bootstrap/app.js");
  const config = loadApiConfig({
    ...process.env,
    NODE_ENV: "test",
    WEB_ORIGIN: "http://localhost:5173",
    TELEGRAM_ORIGIN: "http://localhost:5174",
    TELEGRAM_BOT_TOKEN: "integration-test-token",
    MEDIA_STORAGE_SCOPE: "staging",
  });
  const saved = new Map<string, { body: Uint8Array; contentType: string; sizeBytes: number }>();
  const storage = {
    put: async (key: string, input: Uint8Array, contentType: string) => {
      const object = { body: input, contentType, sizeBytes: input.byteLength };
      saved.set(key, object);
      return { key, contentType, sizeBytes: input.byteLength };
    },
    get: async (key: string) => {
      const object = saved.get(key);
      if (!object) throw Error("missing");
      return { key, ...object };
    },
    remove: async () => {
      throw Error("Worker-owned cleanup only");
    },
  } as ObjectStorage;
  const container = createContainer(config, { objectStorage: storage });
  const server = createApp(config, container).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const userIds: string[] = [];
  let communityId: string | null = null;
  const register = async (username: string) => {
    const response = await fetch(`${base}/api/public/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: config.WEB_ORIGIN,
      },
      body: JSON.stringify({
        loginUsername: username,
        password: "correct horse battery staple",
        displayUsername: username,
        displayName: username,
      }),
    });
    assert.equal(response.status, 201);
    const cookie = response.headers.get("set-cookie");
    assert.ok(cookie);
    const credential = await db.webCredential.findUniqueOrThrow({
      where: { loginUsername: username },
    });
    userIds.push(credential.userId);
    return cookie;
  };
  try {
    const suffix = randomUUID().slice(0, 12).replace(/-/g, "");
    const owner = await register(`media_owner_${suffix}`);
    const outsider = await register(`media_outsider_${suffix}`);
    const created = await fetch(`${base}/api/v1/communities`, {
      method: "POST",
      headers: { cookie: owner, origin: config.WEB_ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ name: `Step 24 API ${suffix}` }),
    });
    assert.equal(created.status, 201);
    const record = (await created.json()) as { id: string };
    communityId = record.id;
    const uploadUrl = `${base}/api/v1/communities/${record.id}/identity/logo/upload`;
    const denied = await fetch(uploadUrl, {
      method: "POST",
      headers: { cookie: outsider, origin: config.WEB_ORIGIN, "content-type": "image/png" },
      body: Buffer.from(body),
    });
    assert.equal(denied.status, 403);
    const denial = (await denied.json()) as { error?: { code: string } };
    assert.equal(denial.error?.code, "COMMUNITY_OWNER_OR_ADMIN_REQUIRED");
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { cookie: owner, origin: config.WEB_ORIGIN, "content-type": "image/png" },
      body: Buffer.from(body),
    });
    assert.equal(response.status, 201);
    const uploaded = (await response.json()) as { mediaId: string };
    assert.ok(uploaded.mediaId);

    const detail = await fetch(`${base}/api/public/v1/communities/${record.id}`);
    assert.equal(detail.status, 200);
    const bodyJson = await detail.text();
    assert.equal(bodyJson.includes("ObjectKey"), false);
    assert.equal(bodyJson.includes("/media/v1/"), false);
    const detailRecord = JSON.parse(bodyJson) as { logoUrl: string };
    const content = await fetch(`${base}${detailRecord.logoUrl}`);
    assert.equal(content.status, 200);
    assert.match(content.headers.get("content-type") ?? "", /^image\/webp/);
    assert.equal(content.headers.get("cache-control"), "private, no-store");
    assert.equal(content.headers.get("cross-origin-resource-policy"), "cross-origin");
    assert.equal(
      (await sharp(new Uint8Array(await content.arrayBuffer())).metadata()).format,
      "webp",
    );
  } finally {
    if (communityId) {
      await db.outboxEvent.deleteMany({ where: { aggregateId: communityId } });
      await db.communityMembership.deleteMany({ where: { communityId } });
      await db.community.delete({ where: { id: communityId } });
    }
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
