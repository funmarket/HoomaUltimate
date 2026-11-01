import {
  PAGE_BANNER_CLEANUP_TOPIC,
  PAGE_BANNER_RECONCILE_TOPIC,
  pageBannerCleanupPayloadSchema,
  pageBannerReconcilePayloadSchema,
} from "@hooma/contracts/page-banner";
import type { PrismaClient } from "@hooma/database";
import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler } from "../outbox/outbox.runner.js";

const variants = ["master", "display", "mobile"] as const;

function expectedKeys(scope: string, placementId: string, mediaId: string): string[] {
  return variants.map(
    (variant) => `${scope}/media/v1/page-banner/${placementId}/${mediaId}/${variant}.webp`,
  );
}

function assertKeys(
  scope: string,
  placementId: string,
  mediaId: string,
  objectKeys: readonly string[],
): void {
  const expected = new Set(expectedKeys(scope, placementId, mediaId));
  if (objectKeys.length !== expected.size || objectKeys.some((key) => !expected.has(key))) {
    throw new Error(
      `Invalid ${PAGE_BANNER_RECONCILE_TOPIC}/${PAGE_BANNER_CLEANUP_TOPIC} object key set`,
    );
  }
}

async function removeUnreferenced(
  database: PrismaClient,
  storage: ObjectStorage,
  objectKeys: readonly string[],
): Promise<void> {
  const referenced = await database.pageBannerSlideVariant.findMany({
    where: { objectKey: { in: [...objectKeys] } },
    select: { objectKey: true },
  });
  const referencedKeys = new Set(referenced.map(({ objectKey }) => objectKey));
  await Promise.all(
    objectKeys.filter((key) => !referencedKeys.has(key)).map((key) => storage.remove(key)),
  );
}

export function createPageBannerReconcileHandler(
  database: PrismaClient,
  storage: ObjectStorage,
  scope: string,
): OutboxHandler {
  return async ({ payload }) => {
    const input = pageBannerReconcilePayloadSchema.parse(payload);
    assertKeys(scope, input.placementId, input.mediaId, input.objectKeys);
    await removeUnreferenced(database, storage, input.objectKeys);
  };
}

export function createPageBannerCleanupHandler(
  database: PrismaClient,
  storage: ObjectStorage,
  scope: string,
): OutboxHandler {
  return async ({ payload }) => {
    const input = pageBannerCleanupPayloadSchema.parse(payload);
    assertKeys(scope, input.placementId, input.mediaId, input.objectKeys);
    await removeUnreferenced(database, storage, input.objectKeys);
  };
}
