import {
  PAGE_BANNER_PLACEMENT_IDS,
  type PageBannerPlacementId,
} from "@hooma/contracts/page-banner";
import { request, type HoomaTransport } from "../http";
import {
  createArtworkPreparation,
  requiredArtworkWidth,
  reuseArtworkUrls,
  selectArtworkVariant,
  isArtworkFresh,
} from "./artwork";

export interface PageBannerPublicVariant {
  readonly variant: string;
  readonly contentUrl: string;
  readonly expiresAt: string | null;
  readonly delivery?: "SIGNED" | "IMMUTABLE";
  readonly contentType: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface PageBannerPublicSlide {
  readonly id: string;
  readonly artworkVersion?: string;
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

type CachedRead = {
  readonly data: PageBannerPublicResponse;
  readonly freshUntil: number;
};

function hasUsableArtwork(data: PageBannerPublicResponse, now: number): boolean {
  return data.slides.every((slide) =>
    slide.variants.every((variant) => isArtworkFresh(variant, now)),
  );
}

export function createPageBannerApi(
  transport: HoomaTransport,
  artworkOptions: Parameters<typeof createArtworkPreparation>[0] = {},
) {
  const cache = new Map<string, CachedRead>();
  const artworkReads = new Map<string, PageBannerPublicResponse>();
  const inFlight = new Map<
    string,
    { readonly promise: Promise<PageBannerPublicResponse>; readonly forced: boolean }
  >();
  const generations = new Map<string, number>();
  let activeOwner: { placementId: PageBannerPlacementId; settled: boolean } | null = null;
  let backgroundAllowed = false;
  const backgroundWaiters = new Set<() => void>();
  const artwork = createArtworkPreparation({
    ...artworkOptions,
    canStartBackground: () => backgroundAllowed,
  });

  function beginActive(placementId: PageBannerPlacementId) {
    const owner = { placementId, settled: false };
    activeOwner = owner;
    backgroundAllowed = false;
    return {
      settle() {
        if (activeOwner !== owner || owner.settled) return;
        owner.settled = true;
        backgroundAllowed = true;
        const waiters = [...backgroundWaiters];
        backgroundWaiters.clear();
        for (const resume of waiters) resume();
        artwork.resumeBackground();
      },
      release() {
        if (activeOwner !== owner) return;
        activeOwner = null;
        backgroundAllowed = false;
      },
    };
  }

  async function waitForBackground() {
    while (!backgroundAllowed) await new Promise<void>((resolve) => backgroundWaiters.add(resolve));
  }
  const requestedPlacements = new Set<PageBannerPlacementId>();
  let sessionPreparation: Promise<void> | null = null;

  function invalidate(placementId: PageBannerPlacementId) {
    cache.delete(placementId);
    artworkReads.delete(placementId);
    artwork.invalidate(placementId);
    generations.set(placementId, (generations.get(placementId) ?? 0) + 1);
    inFlight.delete(placementId);
  }

  function publicRead(
    placementId: PageBannerPlacementId,
    options: PageBannerPublicReadOptions = {},
  ): Promise<PageBannerPublicResponse> {
    requestedPlacements.add(placementId);
    const forced = options.forceFresh === true;
    const now = Date.now();
    const cached = cache.get(placementId);
    if (!forced && cached) {
      if (cached.freshUntil > now && hasUsableArtwork(cached.data, now)) {
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
      { headers: { "X-Hooma-PageBanner-Delivery": "immutable" } },
    )
      .then(async (data): Promise<PageBannerPublicResponse> => {
        if (generations.get(placementId) !== generation) {
          const newerRequest = inFlight.get(placementId)?.promise;
          if (newerRequest) return newerRequest;
          const newerCachedRead = cache.get(placementId);
          if (
            newerCachedRead &&
            newerCachedRead.freshUntil > Date.now() &&
            hasUsableArtwork(newerCachedRead.data, Date.now())
          ) {
            return newerCachedRead.data;
          }
          throw new Error("PageBanner read was superseded before completion");
        }
        // Public routes are same-origin in the app, and honor explicit API origins in other transports.
        if (transport.baseUrl)
          data = {
            ...data,
            slides: data.slides.map((slide) => ({
              ...slide,
              variants: slide.variants.map((variant) => ({
                ...variant,
                contentUrl:
                  variant.delivery === "IMMUTABLE"
                    ? new URL(variant.contentUrl, transport.baseUrl).href
                    : variant.contentUrl,
              })),
            })),
          };
        const artworkIsUsable = hasUsableArtwork(data, Date.now());
        if (forced && !artworkIsUsable) {
          throw new Error(
            "PageBanner response did not contain a fresh signed URL or valid immutable artwork",
          );
        }
        const current =
          !forced && artworkIsUsable
            ? reuseArtworkUrls(artworkReads.get(placementId), data, Date.now())
            : data;
        artworkReads.delete(placementId);
        if (artworkIsUsable && current.enabled) artworkReads.set(placementId, current);
        while (artworkReads.size > MAX_CACHED_PLACEMENTS) {
          const oldest = artworkReads.keys().next().value;
          if (oldest === undefined) break;
          artworkReads.delete(oldest);
          artwork.invalidate(oldest as PageBannerPlacementId);
        }
        if (forced) artwork.invalidate(placementId);
        else artwork.reconcile(current, requiredArtworkWidth());
        if (generations.get(placementId) === generation && artworkIsUsable) {
          cache.set(placementId, { data: current, freshUntil: Date.now() + PUBLIC_READ_FRESH_MS });
          while (cache.size > MAX_CACHED_PLACEMENTS) {
            const oldest = cache.keys().next().value as string | undefined;
            if (oldest === undefined) break;
            cache.delete(oldest);
          }
        }
        return current;
      })
      .finally(() => {
        if (inFlight.get(placementId)?.promise === promise) inFlight.delete(placementId);
      });
    inFlight.set(placementId, { promise, forced });
    return promise;
  }

  function prefetch(placementId: PageBannerPlacementId) {
    // Navigation hints pause new unrelated work before a lazy route mounts.
    if (activeOwner?.placementId !== placementId) beginActive(placementId);
    const read = publicRead(placementId);
    const generation = generations.get(placementId);
    void read
      .then((data) => {
        if (generations.get(placementId) === generation) return prepareArtwork(data, "active");
      })
      .catch(() => undefined);
    return read;
  }

  function prepareArtwork(data: PageBannerPublicResponse, priority: "active" | "background") {
    const slide = data.slides[0];
    const variant = slide ? selectArtworkVariant(slide, requiredArtworkWidth()) : null;
    return artwork.prepare(data, requiredArtworkWidth(), priority).catch(() => {
      const current = artworkReads.get(data.placementId);
      if (
        variant &&
        current?.slides.some(
          (item) =>
            item.id === slide?.id &&
            item.artworkVersion === slide?.artworkVersion &&
            item.variants.some((image) => image.contentUrl === variant.contentUrl),
        )
      )
        invalidate(data.placementId);
    });
  }

  function prepareSession(): Promise<void> {
    if (sessionPreparation) return sessionPreparation;
    sessionPreparation = (async () => {
      for (const placementId of PAGE_BANNER_PLACEMENT_IDS) {
        while (!backgroundAllowed) await waitForBackground();
        if (requestedPlacements.has(placementId)) continue;
        try {
          const read = publicRead(placementId);
          const generation = generations.get(placementId);
          const data = await read;
          while (!backgroundAllowed) await waitForBackground();
          if (generations.get(placementId) === generation) void prepareArtwork(data, "background");
        } catch {
          // Preparation is optional and never restarts a failed active request.
        }
      }
    })();
    return sessionPreparation;
  }

  return {
    publicRead,
    beginActive,
    prefetch,
    prepareSession,
    invalidate,
  };
}
