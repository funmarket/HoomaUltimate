import {
  PAGE_BANNER_PLACEMENT_IDS,
  type PageBannerPlacementId,
} from "@hooma/contracts/page-banner";
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
  readonly priority?: "active" | "background";
}

const SIGNED_URL_SAFETY_MARGIN_MS = 60_000;
const ENABLED_METADATA_FRESH_MS = 4 * 60_000;
const EMPTY_METADATA_FRESH_MS = 15_000;
const MAX_CACHED_PLACEMENTS = 11;
const MAX_METADATA_CONCURRENCY = 3;
const MAX_BACKGROUND_IMAGE_CONCURRENCY = 1;
const MAX_PREPARED_IMAGES = 11;

type CachedRead = {
  readonly data: PageBannerPublicResponse;
  readonly freshUntil: number;
};

export interface PageBannerApiOptions {
  readonly createImage?: () => HTMLImageElement | null;
  readonly requiredImageWidth?: () => number;
}

type ReadTask = {
  readonly placementId: PageBannerPlacementId;
  priority: 0 | 1;
  readonly sequence: number;
  readonly run: () => void;
};

type InFlightRead = {
  readonly promise: Promise<PageBannerPublicResponse>;
  readonly forced: boolean;
  task?: ReadTask;
};

type PreparedImage = {
  readonly placementId: PageBannerPlacementId;
  readonly url: string;
  readonly expiresAt: number;
  readonly image: HTMLImageElement;
  readonly promise: Promise<void>;
};

type ImageTask = {
  readonly placementId: PageBannerPlacementId;
  readonly url: string;
  readonly expiresAt: number;
  priority: 0 | 1;
  readonly run: () => void;
};

function selectVariant(slide: PageBannerPublicSlide, requiredWidth: number) {
  const variants = slide.variants
    .filter((variant) => variant.contentUrl.trim() && variant.widthPx > 0 && variant.heightPx > 0)
    .slice()
    .sort((left, right) => left.widthPx - right.widthPx);
  return variants.find((variant) => variant.widthPx >= requiredWidth) ?? variants.at(-1) ?? null;
}

function requiredImageWidth() {
  if (typeof window === "undefined") return 720;
  return Math.ceil(window.innerWidth * (window.devicePixelRatio || 1));
}

function browserImage() {
  return typeof Image === "undefined" ? null : new Image();
}

function isFreshVariant(expiresAt: number, now: number) {
  return Number.isFinite(expiresAt) && expiresAt > now + SIGNED_URL_SAFETY_MARGIN_MS;
}

function metadataFreshUntil(data: PageBannerPublicResponse, now: number) {
  if (!data.enabled || data.slides.length === 0) return now + EMPTY_METADATA_FRESH_MS;
  let freshUntil = now + ENABLED_METADATA_FRESH_MS;
  for (const slide of data.slides) {
    for (const variant of slide.variants) {
      const expiry = Date.parse(variant.expiresAt);
      if (Number.isFinite(expiry)) {
        freshUntil = Math.min(freshUntil, expiry - SIGNED_URL_SAFETY_MARGIN_MS);
      }
    }
  }
  return freshUntil;
}

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

export function createPageBannerApi(transport: HoomaTransport, options: PageBannerApiOptions = {}) {
  const cache = new Map<string, CachedRead>();
  const inFlight = new Map<string, InFlightRead>();
  const generations = new Map<string, number>();
  const readQueue: ReadTask[] = [];
  const preparedImages = new Map<string, PreparedImage>();
  const imageQueue: ImageTask[] = [];
  let activeReads = 0;
  let activeImageLoads = 0;
  let backgroundImageLoads = 0;
  let readSequence = 0;
  let sessionPreparationStarted = false;
  let holdBackgroundImagesForActive = false;

  function pumpReads() {
    readQueue.sort(
      (left, right) => left.priority - right.priority || left.sequence - right.sequence,
    );
    while (activeReads < MAX_METADATA_CONCURRENCY && readQueue.length > 0) {
      const task = readQueue.shift()!;
      const record = inFlight.get(task.placementId);
      if (!record || record.task !== task) continue;
      delete record.task;
      activeReads += 1;
      task.run();
    }
  }

  function promoteRead(placementId: PageBannerPlacementId) {
    const task = inFlight.get(placementId)?.task;
    if (task) {
      task.priority = 0;
      pumpReads();
    }
  }

  function pumpImages() {
    imageQueue.sort((left, right) => left.priority - right.priority);
    while (imageQueue.length > 0) {
      const activeIndex = imageQueue.findIndex((task) => task.priority === 0);
      const nextIndex = activeIndex >= 0 ? activeIndex : 0;
      const task = imageQueue[nextIndex]!;
      if (task.priority === 0) {
        if (activeImageLoads >= 1) break;
      } else {
        if (
          holdBackgroundImagesForActive ||
          backgroundImageLoads >= MAX_BACKGROUND_IMAGE_CONCURRENCY
        )
          break;
      }
      imageQueue.splice(nextIndex, 1);
      if (task.priority === 0) activeImageLoads += 1;
      else backgroundImageLoads += 1;
      task.run();
    }
  }

  function clearPreparedImages(placementId: PageBannerPlacementId) {
    for (const [url, image] of preparedImages) {
      if (image.placementId === placementId) preparedImages.delete(url);
    }
    for (let index = imageQueue.length - 1; index >= 0; index -= 1) {
      if (imageQueue[index]?.placementId === placementId) imageQueue.splice(index, 1);
    }
  }

  function invalidate(placementId: PageBannerPlacementId) {
    cache.delete(placementId);
    clearPreparedImages(placementId);
    generations.set(placementId, (generations.get(placementId) ?? 0) + 1);
    const pending = inFlight.get(placementId);
    if (pending?.task) {
      const index = readQueue.indexOf(pending.task);
      if (index >= 0) readQueue.splice(index, 1);
    }
    inFlight.delete(placementId);
    pumpReads();
  }

  function publicRead(
    placementId: PageBannerPlacementId,
    options: PageBannerPublicReadOptions = {},
  ): Promise<PageBannerPublicResponse> {
    const forced = options.forceFresh === true;
    const priority = options.priority === "background" && !forced ? 1 : 0;
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
    if (existing && (!forced || existing.forced)) {
      if (priority === 0) promoteRead(placementId);
      return existing.promise;
    }

    if (forced) {
      cache.delete(placementId);
      inFlight.delete(placementId);
    }
    const generation = (generations.get(placementId) ?? 0) + 1;
    generations.set(placementId, generation);

    let resolveRead!: (data: PageBannerPublicResponse) => void;
    let rejectRead!: (error: unknown) => void;
    const promise = new Promise<PageBannerPublicResponse>((resolve, reject) => {
      resolveRead = resolve;
      rejectRead = reject;
    });
    const record: InFlightRead = { promise, forced };
    inFlight.set(placementId, record);

    const task: ReadTask = {
      placementId,
      priority,
      sequence: readSequence++,
      run: () => {
        let slotReleased = false;
        const releaseReadSlot = () => {
          if (slotReleased) return;
          slotReleased = true;
          activeReads -= 1;
          pumpReads();
        };
        void request<PageBannerPublicResponse>(
          transport,
          `/api/public/v1/banners/${encodeURIComponent(placementId)}`,
        )
          .then(async (data): Promise<PageBannerPublicResponse> => {
            if (generations.get(placementId) !== generation) {
              releaseReadSlot();
              const newerRequest = inFlight.get(placementId)?.promise;
              if (newerRequest) return newerRequest;
              const newerCachedRead = cache.get(placementId);
              if (
                newerCachedRead &&
                newerCachedRead.freshUntil > Date.now() &&
                hasFreshSignedUrls(newerCachedRead.data, Date.now())
              ) {
                return newerCachedRead.data;
              }
              throw new Error("PageBanner read was superseded before completion");
            }
            const signedUrlsAreFresh = hasFreshSignedUrls(data, Date.now());
            if (forced && !signedUrlsAreFresh) {
              throw new Error("PageBanner response did not contain a fresh signed URL");
            }
            if (generations.get(placementId) === generation && signedUrlsAreFresh) {
              cache.set(placementId, { data, freshUntil: metadataFreshUntil(data, Date.now()) });
              while (cache.size > MAX_CACHED_PLACEMENTS) {
                const oldest = cache.keys().next().value as string | undefined;
                if (oldest === undefined) break;
                cache.delete(oldest);
              }
            }
            return data;
          })
          .then(
            (data) => {
              if (inFlight.get(placementId) === record) inFlight.delete(placementId);
              resolveRead(data);
            },
            (error: unknown) => {
              if (inFlight.get(placementId) === record) inFlight.delete(placementId);
              rejectRead(error);
            },
          )
          .finally(() => {
            releaseReadSlot();
          });
      },
    };
    record.task = task;
    readQueue.push(task);
    pumpReads();
    return promise;
  }

  function prepareArtwork(
    placementId: PageBannerPlacementId,
    data: PageBannerPublicResponse,
    imageWidth = options.requiredImageWidth?.() ?? requiredImageWidth(),
    priority: "active" | "background" = "background",
    mayRefresh = true,
  ): Promise<void> {
    if (!data.enabled) return Promise.resolve();
    const firstSlide = data.slides
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)[0];
    if (!firstSlide) return Promise.resolve();
    const variant = selectVariant(firstSlide, imageWidth);
    if (!variant) return Promise.resolve();
    const now = Date.now();
    const expiresAt = Date.parse(variant.expiresAt);
    if (!isFreshVariant(expiresAt, now)) {
      preparedImages.delete(variant.contentUrl);
      if (!mayRefresh || priority === "active") return Promise.resolve();
      return publicRead(placementId, { forceFresh: true })
        .then((fresh) => prepareArtwork(placementId, fresh, imageWidth, priority, false))
        .catch(() => undefined);
    }

    const queuedIndex = imageQueue.findIndex((task) => task.url === variant.contentUrl);
    if (queuedIndex >= 0) {
      const queued = imageQueue[queuedIndex]!;
      if (priority === "active" && queued.priority === 1) {
        queued.priority = 0;
        pumpImages();
      }
    }
    const existing = preparedImages.get(variant.contentUrl);
    if (
      existing &&
      existing.placementId === placementId &&
      isFreshVariant(existing.expiresAt, now)
    ) {
      preparedImages.delete(variant.contentUrl);
      preparedImages.set(variant.contentUrl, existing);
      return existing.promise;
    }

    const image = options.createImage ? options.createImage() : browserImage();
    if (!image) return Promise.resolve();
    const url = variant.contentUrl;
    let resolvePrepared!: () => void;
    let rejectPrepared!: (error: Error) => void;
    const preparedPromise = new Promise<void>((resolve, reject) => {
      resolvePrepared = resolve;
      rejectPrepared = reject;
    });
    const prepared: PreparedImage = {
      placementId,
      url,
      expiresAt,
      image,
      promise: preparedPromise,
    };
    preparedImages.set(url, prepared);
    while (preparedImages.size > MAX_PREPARED_IMAGES) {
      const oldest = preparedImages.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      preparedImages.delete(oldest);
    }

    const task: ImageTask = {
      placementId,
      url,
      expiresAt,
      priority: priority === "active" ? (0 as const) : (1 as const),
      run: () => {
        const loadPriority = task.priority;
        if (!isFreshVariant(expiresAt, Date.now())) {
          if (preparedImages.get(url) === prepared) preparedImages.delete(url);
          if (loadPriority === 0) activeImageLoads -= 1;
          else backgroundImageLoads -= 1;
          if (loadPriority === 1 && mayRefresh) {
            void publicRead(placementId, { forceFresh: true })
              .then((fresh) => prepareArtwork(placementId, fresh, imageWidth, "background", false))
              .then(resolvePrepared, rejectPrepared)
              .finally(pumpImages);
          } else {
            rejectPrepared(new Error("PageBanner signed URL expired before image preparation"));
            pumpImages();
          }
          pumpImages();
          return;
        }
        image.fetchPriority = loadPriority === 0 ? "high" : "low";
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          image.onload = null;
          image.onerror = null;
          if (error) {
            if (preparedImages.get(url) === prepared) preparedImages.delete(url);
            rejectPrepared(error);
          } else {
            resolvePrepared();
          }
          if (loadPriority === 0) activeImageLoads -= 1;
          else backgroundImageLoads -= 1;
          pumpImages();
        };
        image.onload = () => {
          const decode = typeof image.decode === "function" ? image.decode() : Promise.resolve();
          void decode.then(
            () => finish(),
            (error: unknown) =>
              finish(error instanceof Error ? error : new Error("PageBanner image decode failed")),
          );
        };
        image.onerror = () => finish(new Error("PageBanner image preload failed"));
        image.src = url;
        if (image.complete && image.naturalWidth > 0) image.onload?.(new Event("load"));
      },
    };
    imageQueue.push(task);
    pumpImages();
    return preparedPromise;
  }

  function prepareSession(activePlacementId: PageBannerPlacementId, imageWidth?: number) {
    const activeRead = publicRead(activePlacementId);
    if (!sessionPreparationStarted) {
      sessionPreparationStarted = true;
      holdBackgroundImagesForActive = true;
      const width = imageWidth ?? options.requiredImageWidth?.() ?? requiredImageWidth();
      void activeRead
        .then((data) => prepareArtwork(activePlacementId, data, width, "active"))
        .catch(() => undefined)
        .finally(() => {
          holdBackgroundImagesForActive = false;
          pumpImages();
        });
      for (const placementId of PAGE_BANNER_PLACEMENT_IDS) {
        if (placementId === activePlacementId) continue;
        void publicRead(placementId, { priority: "background" })
          .then((data) => prepareArtwork(placementId, data, width, "background"))
          .catch(() => undefined);
      }
    } else {
      const width = imageWidth ?? options.requiredImageWidth?.() ?? requiredImageWidth();
      void activeRead
        .then((data) => prepareArtwork(activePlacementId, data, width, "active"))
        .catch(() => undefined);
    }
    return activeRead;
  }

  return {
    publicRead,
    prefetch: (placementId: PageBannerPlacementId) => publicRead(placementId),
    prepareSession,
    prepareArtwork,
    invalidate,
  };
}
