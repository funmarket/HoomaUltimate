import type { Prisma } from "@hooma/database";
import type { PageBannerPlacementId, PageBannerSlideMetadata } from "@hooma/contracts/page-banner";

export interface PageBannerVariantRecord {
  readonly variant: string;
  readonly objectKey: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface PageBannerSlideRecord {
  readonly id: string;
  readonly placementId: PageBannerPlacementId;
  readonly mediaId: string;
  readonly sortOrder: number;
  readonly enabled: boolean;
  readonly isDecorative: boolean;
  readonly altText: string | null;
  readonly destinationKind: "INTERNAL" | "EXTERNAL" | null;
  readonly destinationUrl: string | null;
  readonly variants: readonly PageBannerVariantRecord[];
}

export interface PageBannerPlacementRecord {
  readonly id: PageBannerPlacementId;
  readonly enabled: boolean;
  readonly slides: readonly PageBannerSlideRecord[];
}

export interface PageBannerPreparedUpload {
  readonly mediaId: string;
  readonly placementId: PageBannerPlacementId;
  readonly objectKeys: readonly string[];
}

export interface PageBannerRepository {
  list(): Promise<readonly PageBannerPlacementRecord[]>;
  get(placementId: PageBannerPlacementId): Promise<PageBannerPlacementRecord | null>;
  setEnabled(
    actorUserId: string,
    placementId: PageBannerPlacementId,
    enabled: boolean,
  ): Promise<PageBannerPlacementRecord | null>;
  prepareUpload(input: PageBannerPreparedUpload): Promise<void>;
  addPreparedSlide(input: {
    readonly actorUserId: string;
    readonly placementId: PageBannerPlacementId;
    readonly mediaId: string;
    readonly variants: readonly PageBannerVariantRecord[];
    readonly metadata: PageBannerSlideMetadata;
  }): Promise<PageBannerSlideRecord>;
  replacePreparedSlide(input: {
    readonly actorUserId: string;
    readonly placementId: PageBannerPlacementId;
    readonly slideId: string;
    readonly mediaId: string;
    readonly variants: readonly PageBannerVariantRecord[];
    readonly metadata: PageBannerSlideMetadata;
  }): Promise<PageBannerSlideRecord | null>;
  updateSlide(
    actorUserId: string,
    placementId: PageBannerPlacementId,
    slideId: string,
    metadata: PageBannerSlideMetadata,
  ): Promise<PageBannerSlideRecord | null>;
  reorder(
    actorUserId: string,
    placementId: PageBannerPlacementId,
    slideIds: readonly string[],
  ): Promise<readonly PageBannerSlideRecord[] | null>;
  deleteSlide(
    actorUserId: string,
    placementId: PageBannerPlacementId,
    slideId: string,
  ): Promise<boolean>;
}

export interface PageBannerCleanupEvent {
  readonly id: string;
  readonly topic: string;
  readonly payload: Prisma.JsonValue;
}
