import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_BANNER_CLEANUP_TOPIC } from "@hooma/contracts/page-banner";
import { pageBannerHttpFixture } from "./helpers/page-banner-http.ts";
import { createPageBannerCleanupHandler } from "../apps/worker/src/page-banner/page-banner-cleanup.ts";
import { OutboxRepository } from "../apps/worker/src/outbox/outbox.repository.ts";
import { OutboxRunner } from "../apps/worker/src/outbox/outbox.runner.ts";

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
    const invalidAuditCount = await f.db.auditLog.count({
      where: { action: "PAGE_BANNER_SLIDE_DELETED", entityId: first.id },
    });
    const invalidCleanupCount = await f.db.outboxEvent.count({
      where: { id: `page-banner-cleanup:${first.mediaId}` },
    });
    assert.equal((await f.requestDelete(first.id, undefined)).status, 400);
    assert.equal((await f.requestDelete(first.id, { reason: "   " })).status, 400);
    assert(await f.db.pageBannerSlide.findUnique({ where: { id: first.id } }));
    assert.equal(
      await f.db.auditLog.count({
        where: { action: "PAGE_BANNER_SLIDE_DELETED", entityId: first.id },
      }),
      invalidAuditCount,
    );
    assert.equal(
      await f.db.outboxEvent.count({ where: { id: `page-banner-cleanup:${first.mediaId}` } }),
      invalidCleanupCount,
    );
    assert.equal(
      (await f.requestDelete(first.id, { reason: "Valid reason" }, f.nonAdminHeaders)).status,
      403,
    );
    assert(await f.db.pageBannerSlide.findUnique({ where: { id: first.id } }));
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
    const runner = new OutboxRunner(
      new OutboxRepository(f.db),
      new Map([[PAGE_BANNER_CLEANUP_TOPIC, cleanup]]),
    );
    await runner.runOnce();
    const replacementCleanup = await f.db.outboxEvent.findUniqueOrThrow({
      where: { id: `page-banner-cleanup:${first.mediaId}` },
    });
    assert.equal(replacementCleanup.status, "DELIVERED");
    assert.ok(replacementCleanup.deliveredAt);
    for (const variant of old.variants) assert.equal(f.objects.has(variant.objectKey), false);
    const current = await f.db.pageBannerSlideVariant.findMany({ where: { slideId: first.id } });
    for (const variant of current) assert.equal(f.objects.has(variant.objectKey), true);
    const deletedVariants = current;
    await f.remove(first.id, "  Removed after replacement test  ");
    const deletionAudit = await f.db.auditLog.findFirstOrThrow({
      where: { action: "PAGE_BANNER_SLIDE_DELETED", entityId: first.id },
    });
    assert.equal(
      (deletionAudit.metadata as { reason: string }).reason,
      "Removed after replacement test",
    );
    const moderationCleanup = await f.db.outboxEvent.findUniqueOrThrow({
      where: { id: `page-banner-cleanup:${second.mediaId}` },
    });
    assert.equal(moderationCleanup.topic, PAGE_BANNER_CLEANUP_TOPIC);
    const cleanupResult = await runner.runOnce();
    assert.equal(cleanupResult.delivered, 1);
    const deliveredModerationCleanup = await f.db.outboxEvent.findUniqueOrThrow({
      where: { id: moderationCleanup.id },
    });
    assert.equal(deliveredModerationCleanup.status, "DELIVERED");
    assert.ok(deliveredModerationCleanup.deliveredAt);
    for (const variant of deletedVariants) assert.equal(f.objects.has(variant.objectKey), false);
    assert.deepEqual((await f.metadata()).slides, []);
    const deleted = await fetch(f.origin + replacement);
    assert.equal(deleted.status, 404);
    assert.equal(deleted.headers.get("cache-control"), "no-store");
  } finally {
    await f.close();
  }
});
