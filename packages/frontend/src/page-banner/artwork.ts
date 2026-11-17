import type {
  PageBannerPublicResponse,
  PageBannerPublicSlide,
  PageBannerPublicVariant,
} from "./api";
import type { PageBannerPlacementId } from "@hooma/contracts/page-banner";

export const SIGNED_ARTWORK_MARGIN_MS = 60_000;

export function selectArtworkVariant(slide: PageBannerPublicSlide, requiredWidth: number) {
  const variants = slide.variants
    .filter((variant) => variant.contentUrl.trim() && variant.widthPx > 0 && variant.heightPx > 0)
    .slice()
    .sort((left, right) => left.widthPx - right.widthPx);
  return variants.find((variant) => variant.widthPx >= requiredWidth) ?? variants.at(-1) ?? null;
}

export function isArtworkFresh(variant: PageBannerPublicVariant, now: number) {
  return (
    Boolean(variant.contentUrl.trim()) &&
    (variant.delivery === "IMMUTABLE"
      ? variant.expiresAt === null
      : typeof variant.expiresAt === "string" &&
        Date.parse(variant.expiresAt) > now + SIGNED_ARTWORK_MARGIN_MS)
  );
}

/** Retain URLs, never metadata authority or a signature's newer expiry. */
export function reuseArtworkUrls(
  previous: PageBannerPublicResponse | undefined,
  current: PageBannerPublicResponse,
  now: number,
): PageBannerPublicResponse {
  if (!previous?.enabled || !current.enabled || previous.placementId !== current.placementId)
    return current;
  return {
    ...current,
    slides: current.slides.map((slide) => {
      if (!slide.artworkVersion?.trim()) return slide;
      const prior = previous.slides.find(
        (item) => item.id === slide.id && item.artworkVersion === slide.artworkVersion,
      );
      if (!prior) return slide;
      return {
        ...slide,
        variants: slide.variants.map((variant) => {
          if (variant.delivery === "IMMUTABLE") return variant;
          const reusable = prior.variants.find(
            (item) =>
              item.delivery !== "IMMUTABLE" &&
              item.variant === variant.variant &&
              item.widthPx === variant.widthPx &&
              item.heightPx === variant.heightPx &&
              item.contentType === variant.contentType &&
              isArtworkFresh(item, now),
          );
          return reusable
            ? { ...variant, contentUrl: reusable.contentUrl, expiresAt: reusable.expiresAt }
            : variant;
        }),
      };
    }),
  };
}

export type ArtworkPriority = "active" | "background";
type Preparation = {
  readonly placementId: PageBannerPlacementId;
  readonly url: string;
  readonly variant: PageBannerPublicVariant;
  readonly image: HTMLImageElement;
  readonly promise: Promise<void>;
  priority: ArtworkPriority;
  started: boolean;
  settled: boolean;
  cancel: () => void;
  start: () => void;
};

export function requiredArtworkWidth() {
  return typeof window === "undefined"
    ? 720
    : Math.ceil(window.innerWidth * (window.devicePixelRatio || 1));
}

/** One retained first-frame resource per placement; active work never waits on the background slot. */
export function createArtworkPreparation(
  options: {
    readonly createImage?: () => HTMLImageElement | null;
    readonly timeoutMs?: number;
    readonly canStartBackground?: () => boolean;
  } = {},
) {
  const records = new Map<PageBannerPlacementId, Preparation>();
  const queue: Preparation[] = [];
  let backgroundBusy = false;

  function pump() {
    if (backgroundBusy || options.canStartBackground?.() === false) return;
    while (queue.length) {
      const record = queue.shift()!;
      if (record.settled || record.started || records.get(record.placementId) !== record) continue;
      record.start();
      return;
    }
  }

  function invalidate(placementId: PageBannerPlacementId) {
    const record = records.get(placementId);
    records.delete(placementId);
    if (record) record.cancel();
  }

  function prepare(
    data: PageBannerPublicResponse,
    width: number,
    priority: ArtworkPriority,
  ): Promise<void> {
    const slide = data.enabled ? data.slides[0] : undefined;
    const variant = slide ? selectArtworkVariant(slide, width) : null;
    if (!variant || !isArtworkFresh(variant, Date.now())) {
      invalidate(data.placementId);
      return Promise.resolve();
    }
    const existing = records.get(data.placementId);
    if (existing?.url === variant.contentUrl && isArtworkFresh(existing.variant, Date.now())) {
      if (priority === "active") {
        existing.priority = "active";
        existing.image.fetchPriority = "high";
        if (!existing.started) existing.start();
      }
      return existing.promise;
    }
    invalidate(data.placementId);
    const image = options.createImage
      ? options.createImage()
      : typeof Image === "undefined"
        ? null
        : new Image();
    if (!image) return Promise.resolve();
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((ok, fail) => {
      resolve = ok;
      reject = fail;
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ownsBackgroundSlot = false;
    const record: Preparation = {
      placementId: data.placementId,
      url: variant.contentUrl,
      variant,
      image,
      promise,
      priority,
      started: false,
      settled: false,
      cancel: () => finish(),
      start: () => {
        if (record.started || record.settled) return;
        if (!isArtworkFresh(variant, Date.now())) {
          finish();
          return;
        }
        record.started = true;
        ownsBackgroundSlot = record.priority === "background";
        if (ownsBackgroundSlot) backgroundBusy = true;
        image.decoding = "async";
        image.loading = "eager";
        image.fetchPriority = record.priority === "active" ? "high" : "low";
        image.onload = () => {
          const decoded = typeof image.decode === "function" ? image.decode() : Promise.resolve();
          void decoded.then(
            () => finish(undefined, true),
            () => finish(new Error("PageBanner artwork decode failed")),
          );
        };
        image.onerror = () => finish(new Error("PageBanner artwork load failed"));
        timer = setTimeout(
          () => finish(new Error("PageBanner artwork preparation timed out")),
          options.timeoutMs ?? 30_000,
        );
        image.src = record.url;
        if (image.complete && image.naturalWidth > 0) image.onload(new Event("load"));
      },
    };
    function finish(error?: Error, loaded = false) {
      if (record.settled) return;
      record.settled = true;
      clearTimeout(timer);
      record.image.onload = null;
      record.image.onerror = null;
      if (!loaded) {
        record.image.removeAttribute("src");
        if (records.get(record.placementId) === record) records.delete(record.placementId);
      }
      const index = queue.indexOf(record);
      if (index >= 0) queue.splice(index, 1);
      if (ownsBackgroundSlot) backgroundBusy = false;
      if (error) reject(error);
      else resolve();
      pump();
    }
    records.set(data.placementId, record);
    while (records.size > 11) {
      const oldest = records.keys().next().value;
      if (oldest === undefined) break;
      invalidate(oldest);
    }
    if (priority === "active") record.start();
    else {
      queue.push(record);
      pump();
    }
    return promise;
  }

  return {
    prepare,
    invalidate,
    isDecoded(placementId: PageBannerPlacementId, url: string) {
      const record = records.get(placementId);
      return Boolean(
        record &&
        record.url === url &&
        record.settled &&
        record.image.complete &&
        record.image.naturalWidth > 0 &&
        isArtworkFresh(record.variant, Date.now()),
      );
    },
    resumeBackground: pump,
    reconcile(data: PageBannerPublicResponse, width: number) {
      const existing = records.get(data.placementId);
      const variant =
        data.enabled && data.slides[0] ? selectArtworkVariant(data.slides[0], width) : null;
      if (
        existing &&
        (!variant || existing.url !== variant.contentUrl || !isArtworkFresh(variant, Date.now()))
      )
        invalidate(data.placementId);
    },
    clear() {
      const pending = [...records.values()];
      records.clear();
      queue.length = 0;
      for (const record of pending) record.cancel();
    },
  };
}
