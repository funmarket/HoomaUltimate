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

export interface PageBannerPublicReadOptions {
  readonly forceFresh?: boolean;
}

const PUBLIC_READ_FRESH_MS = 15_000;
const MAX_CACHED_PLACEMENTS = 11;
const SIGNED_URL_SAFETY_MARGIN_MS = 60_000;

type CachedRead = {
  readonly data: PageBannerPublicResponse;
  readonly freshUntil: number;
};

function hasFreshSignedUrls(data: PageBannerPublicResponse, now: number): boolean {
  return data.slides.every((slide) =>
    slide.variants.every((variant) => {
      const expiry = Date.parse(variant.expiresAt);
      return (
        Boolean(variant.contentUrl.trim()) &&
        Number.isFinite(expiry) &&
        expiry > now + SIGNED_URL_SAFETY_MARGIN_MS
      );
    }),
  );
}

export function createPageBannerApi(transport: HoomaTransport) {
  const cache = new Map<string, CachedRead>();
  const inFlight = new Map<
    string,
    { readonly promise: Promise<PageBannerPublicResponse>; readonly forced: boolean }
  >();
  const generations = new Map<string, number>();

  function invalidate(placementId: PageBannerPlacementId) {
    cache.delete(placementId);
    generations.set(placementId, (generations.get(placementId) ?? 0) + 1);
    inFlight.delete(placementId);
  }

  function publicRead(
    placementId: PageBannerPlacementId,
    options: PageBannerPublicReadOptions = {},
  ): Promise<PageBannerPublicResponse> {
    const forced = options.forceFresh === true;
    const now = Date.now();
    const cached = cache.get(placementId);
    if (!forced && cached) {
      if (cached.freshUntil > now && hasFreshSignedUrls(cached.data, now)) {
        cache.delete(placementId);
        cache.set(placementId, cached);
        return Promise.resolve(cached.data);
      }
      cache.delete(placementId);
    }

    const existing = inFlight.get(placementId);
    if (existing && (!forced || existing.forced)) return existing.promise;

    if (forced) {
      cache.delete(placementId);
      inFlight.delete(placementId);
    }
    const generation = (generations.get(placementId) ?? 0) + 1;
    generations.set(placementId, generation);

    const promise = request<PageBannerPublicResponse>(
      transport,
      `/api/public/v1/banners/${encodeURIComponent(placementId)}`,
    )
      .then((data) => {
        const signedUrlsAreFresh = hasFreshSignedUrls(data, Date.now());
        if (forced && !signedUrlsAreFresh) {
          throw new Error("PageBanner response did not contain a fresh signed URL");
        }
        if (generations.get(placementId) === generation && signedUrlsAreFresh) {
          cache.set(placementId, { data, freshUntil: Date.now() + PUBLIC_READ_FRESH_MS });
          while (cache.size > MAX_CACHED_PLACEMENTS) {
            const oldest = cache.keys().next().value as string | undefined;
            if (oldest === undefined) break;
            cache.delete(oldest);
          }
        }
        return data;
      })
      .finally(() => {
        if (inFlight.get(placementId)?.promise === promise) inFlight.delete(placementId);
      });
    inFlight.set(placementId, { promise, forced });
    return promise;
  }

  return {
    publicRead,
    prefetch: (placementId: PageBannerPlacementId) => publicRead(placementId),
    invalidate,
  };
}
