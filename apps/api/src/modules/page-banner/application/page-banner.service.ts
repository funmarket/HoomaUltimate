import { randomUUID } from "node:crypto";
import {
  PAGE_BANNER_CONTENT_TYPES,
  PAGE_BANNER_MAX_BYTES,
  PAGE_BANNER_MAX_SLIDES,
  PAGE_BANNER_PLACEMENT_IDS,
  pageBannerDestinationSchema,
  pageBannerPlacementIdSchema,
  pageBannerSlideMetadataSchema,
  type PageBannerDestination,
  type PageBannerPlacementId,
  type PageBannerSlideMetadata,
} from "@hooma/contracts/page-banner";
import { PAGE_BANNER_STANDARD, processMedia, writeMediaVariants } from "@hooma/media-processing";
import type { ObjectStorage, ObjectStorageReadUrlSigner } from "@hooma/storage";
import type { PlatformAdminAuthorizer } from "../../platform-admin/application/platform-admin.authorizer.js";
import { PageBannerError } from "../domain/page-banner-error.js";
import type {
  PageBannerRepository,
  PageBannerPlacementRecord,
  PageBannerSlideRecord,
} from "./page-banner.repository.js";

const PAGE_BANNER_READ_URL_TTL_SECONDS = 5 * 60;
const PAGE_BANNER_TYPES = new Set<string>(PAGE_BANNER_CONTENT_TYPES);

export interface PageBannerUploadInput {
  readonly contentType: string;
  readonly body: Uint8Array;
  readonly metadata: unknown;
}

export class PageBannerService {
  constructor(
    private readonly repository: PageBannerRepository,
    private readonly platformAdmin: PlatformAdminAuthorizer,
    private readonly storage: ObjectStorage | null,
    private readonly mediaStorageScope: "production" | "staging" | "development" | null,
  ) {}

  async adminList(userId: string) {
    await this.platformAdmin.requirePlatformAdmin(userId);
    return this.repository.list();
  }

  async adminGet(userId: string, rawPlacementId: string) {
    await this.platformAdmin.requirePlatformAdmin(userId);
    return this.requirePlacement(rawPlacementId);
  }

  async setEnabled(userId: string, rawPlacementId: string, enabled: boolean) {
    await this.platformAdmin.requirePlatformAdmin(userId);
    const placementId = this.parsePlacement(rawPlacementId);
    const placement = await this.repository.setEnabled(userId, placementId, enabled);
    if (!placement)
      throw new PageBannerError("PAGE_BANNER_NOT_FOUND", "PageBanner placement not found", 404);
    return placement;
  }

  async upload(
    userId: string,
    rawPlacementId: string,
    input: PageBannerUploadInput,
    slideId?: string,
  ) {
    await this.platformAdmin.requirePlatformAdmin(userId);
    const placementId = this.parsePlacement(rawPlacementId);
    const metadata = pageBannerSlideMetadataSchema.parse(input.metadata);
    const contentType = input.contentType.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!PAGE_BANNER_TYPES.has(contentType))
      throw new PageBannerError(
        "PAGE_BANNER_TYPE_INVALID",
        "PageBanner image must be JPEG, PNG, or WebP",
      );
    if (!input.body.byteLength)
      throw new PageBannerError("PAGE_BANNER_REQUIRED", "PageBanner image bytes are required");
    if (input.body.byteLength > PAGE_BANNER_MAX_BYTES)
      throw new PageBannerError(
        "PAGE_BANNER_TOO_LARGE",
        "PageBanner image must be 5 MiB or smaller",
      );
    if (!this.storage || !this.mediaStorageScope)
      throw new PageBannerError(
        "PAGE_BANNER_STORAGE_NOT_CONFIGURED",
        "PageBanner storage is not configured",
        503,
      );

    const mediaId = randomUUID();
    const processed = await processMedia({
      body: input.body,
      contentType: contentType as "image/jpeg" | "image/png" | "image/webp",
      profile: PAGE_BANNER_STANDARD,
    });
    const written = await writeMediaVariants({
      storage: this.storage,
      identity: {
        scope: this.mediaStorageScope,
        namespace: "PAGE_BANNER",
        ownerId: placementId,
        mediaId,
      },
      processed,
    });
    await this.repository.prepareUpload({
      mediaId,
      placementId,
      objectKeys: written.descriptors.map(({ objectKey }) => objectKey),
    });
    try {
      const variants = written.descriptors.map((descriptor, index) => ({
        ...descriptor,
        widthPx: processed.variants[index]?.widthPx ?? 0,
        heightPx: processed.variants[index]?.heightPx ?? 0,
      }));
      if (slideId) {
        const replaced = await this.repository.replacePreparedSlide({
          actorUserId: userId,
          placementId,
          slideId,
          mediaId,
          variants,
          metadata,
        });
        if (!replaced)
          throw new PageBannerError(
            "PAGE_BANNER_SLIDE_NOT_FOUND",
            "PageBanner slide not found",
            404,
          );
        return replaced;
      }
      return await this.repository.addPreparedSlide({
        actorUserId: userId,
        placementId,
        mediaId,
        variants,
        metadata,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PAGE_BANNER_LIMIT_REACHED")
        throw new PageBannerError(
          "PAGE_BANNER_LIMIT_REACHED",
          `A PageBanner placement may contain at most ${PAGE_BANNER_MAX_SLIDES} slides`,
          409,
        );
      throw error;
    }
  }

  async updateSlide(userId: string, rawPlacementId: string, slideId: string, input: unknown) {
    await this.platformAdmin.requirePlatformAdmin(userId);
    const placementId = this.parsePlacement(rawPlacementId);
    const metadata = pageBannerSlideMetadataSchema.parse(input);
    const slide = await this.repository.updateSlide(userId, placementId, slideId, metadata);
    if (!slide)
      throw new PageBannerError("PAGE_BANNER_SLIDE_NOT_FOUND", "PageBanner slide not found", 404);
    return slide;
  }

  async reorder(userId: string, rawPlacementId: string, slideIds: readonly string[]) {
    await this.platformAdmin.requirePlatformAdmin(userId);
    const placementId = this.parsePlacement(rawPlacementId);
    const slides = await this.repository.reorder(userId, placementId, slideIds);
    if (!slides)
      throw new PageBannerError("PAGE_BANNER_NOT_FOUND", "PageBanner placement not found", 404);
    return slides;
  }

  async deleteSlide(userId: string, rawPlacementId: string, slideId: string) {
    await this.platformAdmin.requirePlatformAdmin(userId);
    const placementId = this.parsePlacement(rawPlacementId);
    if (!(await this.repository.deleteSlide(userId, placementId, slideId)))
      throw new PageBannerError("PAGE_BANNER_SLIDE_NOT_FOUND", "PageBanner slide not found", 404);
    return { ok: true as const };
  }

  async publicRead(rawPlacementId: string) {
    const placement = await this.requirePlacement(rawPlacementId);
    const slides = placement.enabled ? placement.slides.filter((slide) => slide.enabled) : [];
    return {
      placementId: placement.id,
      enabled: placement.enabled,
      slides: await Promise.all(slides.map((slide) => this.publicSlide(slide))),
    };
  }

  private async publicSlide(slide: PageBannerSlideRecord) {
    if (
      !this.storage ||
      !("createReadUrl" in this.storage) ||
      typeof this.storage.createReadUrl !== "function"
    ) {
      throw new PageBannerError(
        "PAGE_BANNER_STORAGE_NOT_CONFIGURED",
        "PageBanner storage is not configured",
        503,
      );
    }
    const storage = this.storage as ObjectStorage & ObjectStorageReadUrlSigner;
    const variants = await Promise.all(
      slide.variants.map(async (variant) => ({
        variant: variant.variant,
        contentUrl: await storage.createReadUrl(
          variant.objectKey,
          PAGE_BANNER_READ_URL_TTL_SECONDS,
        ),
        expiresAt: new Date(Date.now() + PAGE_BANNER_READ_URL_TTL_SECONDS * 1000).toISOString(),
        contentType: variant.contentType,
        widthPx: variant.widthPx,
        heightPx: variant.heightPx,
      })),
    );
    return {
      id: slide.id,
      sortOrder: slide.sortOrder,
      isDecorative: slide.isDecorative,
      altText: slide.altText,
      destination:
        slide.destinationKind && slide.destinationUrl
          ? { kind: slide.destinationKind, url: slide.destinationUrl }
          : null,
      variants,
    };
  }

  private parsePlacement(rawPlacementId: string): PageBannerPlacementId {
    const parsed = pageBannerPlacementIdSchema.safeParse(rawPlacementId);
    if (!parsed.success)
      throw new PageBannerError(
        "PAGE_BANNER_PLACEMENT_INVALID",
        `Placement must be one of ${PAGE_BANNER_PLACEMENT_IDS.join(", ")}`,
      );
    return parsed.data;
  }

  private async requirePlacement(rawPlacementId: string): Promise<PageBannerPlacementRecord> {
    const placement = await this.repository.get(this.parsePlacement(rawPlacementId));
    if (!placement)
      throw new PageBannerError("PAGE_BANNER_NOT_FOUND", "PageBanner placement not found", 404);
    return placement;
  }
}

export function parsePageBannerMetadata(input: unknown): PageBannerSlideMetadata {
  return pageBannerSlideMetadataSchema.parse(input);
}

export function parsePageBannerDestination(input: unknown): PageBannerDestination | null {
  if (input === null || input === undefined || input === "") return null;
  return pageBannerDestinationSchema.parse(input);
}
