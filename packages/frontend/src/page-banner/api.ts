import type { PageBannerPlacementId } from "@hooma/contracts/page-banner";
import { request, type HoomaTransport } from "../http";

export interface PageBannerPublicVariant {
  readonly variant: string;
  readonly contentUrl: string;
  readonly expiresAt: string;
  readonly contentType: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface PageBannerPublicSlide {
  readonly id: string;
  readonly sortOrder: number;
  readonly isDecorative: boolean;
  readonly altText: string | null;
  readonly destination: {
    readonly kind: "INTERNAL" | "EXTERNAL";
    readonly url: string;
  } | null;
  readonly variants: readonly PageBannerPublicVariant[];
}

export interface PageBannerPublicResponse {
  readonly placementId: PageBannerPlacementId;
  readonly enabled: boolean;
  readonly slides: readonly PageBannerPublicSlide[];
}

export function createPageBannerApi(transport: HoomaTransport) {
  return {
    publicRead: (placementId: PageBannerPlacementId) =>
      request<PageBannerPublicResponse>(
        transport,
        `/api/public/v1/banners/${encodeURIComponent(placementId)}`,
      ),
  };
}
