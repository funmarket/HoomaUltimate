import assert from "node:assert/strict";
import test from "node:test";
import { pageBannerHttpFixture } from "./helpers/page-banner-http.ts";
import { createPageBannerCleanupHandler } from "../apps/worker/src/page-banner/page-banner-cleanup.ts";

test("versioned PageBanner HTTP delivery follows real Admin replacement, disable, deletion and reference-safe cleanup", async () => {
  const f = await pageBannerHttpFixture();
  try {
    const forbidden = await fetch(`${f.origin}/api/v1/admin/banners/HOME_TOP`, {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost:5173" },
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal(forbidden.status, 401);
    const first = await f.upload("#213f60");
    const read = await f.metadata();
    const url = read.slides[0].variants.find(
      (v: { variant: string }) => v.variant === "display",
    ).contentUrl;
    assert.equal(
      (await f.metadata()).slides[0].variants.find(
        (v: { variant: string }) => v.variant === "display",
      ).contentUrl,
      url,
    );
    const image = await fetch(f.origin + url);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(image.headers.get("content-type"), "image/webp");
    const bytes = new Uint8Array(await image.arrayBuffer());
    assert(bytes.length > 0);
    const conditional = await fetch(f.origin + url, {
      headers: { "if-none-match": image.headers.get("etag")! },
    });
    assert.equal(conditional.status, 304);
    assert.equal((await conditional.arrayBuffer()).byteLength, 0);
    await f.enabled(false);
    assert.deepEqual((await f.metadata()).slides, []);
    const disabled = await fetch(f.origin + url);
    assert.equal(disabled.status, 404);
    assert.equal(disabled.headers.get("cache-control"), "no-store");
    await f.enabled(true);
    const old = await f.db.pageBannerSlide.findUniqueOrThrow({
      where: { id: first.id },
      include: { variants: true },
    });
    const second = await f.upload("#a53f30", first.id);
    assert.notEqual(second.mediaId, first.mediaId);
    const next = await f.metadata();
    const replacement = next.slides[0].variants.find(
      (v: { variant: string }) => v.variant === "display",
    ).contentUrl;
    assert.notEqual(replacement, url);
    assert.equal((await fetch(f.origin + url)).status, 404);
    assert.equal((await fetch(f.origin + replacement)).status, 200);
    const cleanup = createPageBannerCleanupHandler(f.db, f.storage, "development");
    await cleanup({
      id: "fixture-cleanup",
      topic: "page-banner.cleanup-object",
      payload: {
        placementId: "HOME_TOP",
        slideId: first.id,
        mediaId: first.mediaId,
        objectKeys: old.variants.map((v) => v.objectKey),
      },
    } as never);
    for (const variant of old.variants) assert.equal(f.objects.has(variant.objectKey), false);
    const current = await f.db.pageBannerSlideVariant.findMany({ where: { slideId: first.id } });
    for (const variant of current) assert.equal(f.objects.has(variant.objectKey), true);
    await f.remove(first.id);
    assert.deepEqual((await f.metadata()).slides, []);
    const deleted = await fetch(f.origin + replacement);
    assert.equal(deleted.status, 404);
    assert.equal(deleted.headers.get("cache-control"), "no-store");
  } finally {
    await f.close();
  }
});
