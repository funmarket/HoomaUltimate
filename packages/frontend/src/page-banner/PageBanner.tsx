import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PageBannerPlacementId } from "@hooma/contracts/page-banner";
import { useHoomaFrontend } from "../context";
import type { PageBannerPublicSlide, PageBannerPublicVariant } from "./api";
import { selectArtworkVariant as mediaVariant, isArtworkFresh } from "./artwork";

const placementLabels: Readonly<Record<PageBannerPlacementId, string>> = {
  HOME_TOP: "Home",
  PLAY_TOP: "Play",
  WATCH_TOP: "Watch",
  HOOMA_TOP: "HOOMA",
  TEAMS_TOP: "Teams",
  PITCH_TOP: "Pitch",
  PLACES_TOP: "Places",
  REQUESTS_TOP: "Requests",
  GEAR_UP_TOP: "Gear Up",
  RIDE_TOP: "Ride",
  ATHLETES_TOP: "Athletes",
};

type PreparedSlide = {
  readonly key: string;
  readonly index: number;
  readonly slide: PageBannerPublicSlide;
  readonly variant: PageBannerPublicVariant;
};

type PublicRead = Awaited<
  ReturnType<ReturnType<typeof useHoomaFrontend>["api"]["pageBanners"]["publicRead"]>
>;

function nextIndex(current: number, length: number, direction: -1 | 1): number {
  return (current + direction + length) % length;
}

function requiredImageWidth() {
  if (typeof window === "undefined") return 720;
  return Math.ceil(window.innerWidth * (window.devicePixelRatio || 1));
}

function expiresSoon(variant: PageBannerPublicVariant) {
  return !isArtworkFresh(variant, Date.now());
}

type PageBannerProps = {
  readonly placementId: PageBannerPlacementId;
  readonly className?: string;
};

export function PageBanner({ placementId, className }: PageBannerProps) {
  const { api } = useHoomaFrontend();
  const activePreparation = useRef<ReturnType<typeof api.pageBanners.beginActive> | null>(null);
  const refreshSequence = useRef(0);
  const lastAutomaticRefresh = useRef<string | null>(null);
  const initialRefreshFailed = useRef(false);
  const [read, setRead] = useState<{
    readonly api: typeof api;
    readonly placementId: PageBannerPlacementId;
    readonly status: "loading" | "ready" | "error";
    readonly data?: PublicRead;
  } | null>(() => {
    const data = api.pageBanners.peek(placementId);
    return data ? { api, placementId, status: "ready", data } : null;
  });
  const [requestedIndex, setRequestedIndex] = useState(0);
  const [displayed, setDisplayed] = useState<PreparedSlide | null>(null);
  const [failedKeys, setFailedKeys] = useState<readonly string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pixelWidth, setPixelWidth] = useState(requiredImageWidth);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const onResize = () => setPixelWidth(requiredImageWidth());
    let resolution: MediaQueryList | null = null;
    const onResolutionChange = () => {
      resolution?.removeEventListener("change", onResolutionChange);
      onResize();
      resolution = window.matchMedia?.(`(resolution: ${window.devicePixelRatio}dppx)`) ?? null;
      resolution?.addEventListener("change", onResolutionChange);
    };
    window.addEventListener("resize", onResize);
    if (typeof window.matchMedia === "function") {
      resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      resolution.addEventListener("change", onResolutionChange);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      resolution?.removeEventListener("change", onResolutionChange);
    };
  }, []);

  useEffect(() => {
    const retryOnReturn = () => setRefreshTrigger((previous) => previous + 1);
    const retryOnVisibility = () => {
      if (document.visibilityState === "visible") retryOnReturn();
    };
    window.addEventListener("focus", retryOnReturn);
    document.addEventListener("visibilitychange", retryOnVisibility);
    return () => {
      window.removeEventListener("focus", retryOnReturn);
      document.removeEventListener("visibilitychange", retryOnVisibility);
    };
  }, []);

  useLayoutEffect(() => {
    let active = true;
    const preparation = api.pageBanners.beginActive(placementId);
    activePreparation.current = preparation;
    refreshSequence.current += 1;
    lastAutomaticRefresh.current = null;
    initialRefreshFailed.current = false;
    const cached = api.pageBanners.peek(placementId);
    setRead(
      cached
        ? { api, placementId, status: "ready", data: cached }
        : { api, placementId, status: "loading" },
    );
    setRequestedIndex(0);
    if (!cached) setDisplayed(null);
    setFailedKeys([]);
    setRefreshing(false);
    void api.pageBanners
      .publicRead(placementId)
      .then((data) => {
        if (active) setRead({ api, placementId, status: "ready", data });
      })
      .catch(() => {
        if (active) setRead({ api, placementId, status: "error" });
      });
    return () => {
      active = false;
      preparation.release();
      if (activePreparation.current === preparation) activePreparation.current = null;
      refreshSequence.current += 1;
    };
  }, [api, placementId]);

  const cachedRead = api.pageBanners.peek(placementId);
  const currentRead =
    read?.api === api && read.placementId === placementId
      ? read
      : cachedRead
        ? { api, placementId, status: "ready" as const, data: cachedRead }
        : null;
  const slides = useMemo(
    () =>
      currentRead?.status === "ready" && currentRead.data?.enabled
        ? currentRead.data.slides.filter((slide) =>
            slide.variants.some((variant) => variant.contentUrl),
          )
        : [],
    [currentRead],
  );
  const selectedIndex = Math.min(
    read?.api === api && read.placementId === placementId ? requestedIndex : 0,
    Math.max(slides.length - 1, 0),
  );
  const candidate = useMemo(() => {
    if (!slides.length || refreshing) return null;
    const slide = slides[selectedIndex]!;
    const variant = mediaVariant(slide, pixelWidth);
    if (!variant) return null;
    const key = `${placementId}:${slide.id}:${variant.contentUrl}`;
    return failedKeys.includes(key) ? null : { key, index: selectedIndex, slide, variant };
  }, [slides, selectedIndex, pixelWidth, failedKeys, refreshing, placementId]);

  const displayedForPlacement = displayed?.key.startsWith(`${placementId}:`) ? displayed : null;
  const retainedDisplayed = (() => {
    if (!displayedForPlacement) return null;
    const index = slides.findIndex((slide) => slide.id === displayedForPlacement.slide.id);
    const currentSlide = slides[index];
    if (!currentSlide) return null;
    return { ...displayedForPlacement, index, slide: currentSlide };
  })();
  const preparedDisplayed =
    candidate && api.pageBanners.isDecoded(placementId, candidate.variant.contentUrl)
      ? candidate
      : null;
  const validDisplayed =
    currentRead?.status === "ready" && currentRead.data?.enabled
      ? (retainedDisplayed ?? preparedDisplayed)
      : null;

  function handleFailure(item: PreparedSlide) {
    if (item.key !== displayed?.key && item.key !== candidate?.key) return;
    api.pageBanners.invalidate(placementId);
    setFailedKeys((keys) => (keys.includes(item.key) ? keys : [...keys, item.key]));
    // Preserve the displayed frame and controls until a pending replacement is decoded.
    if (item.key === displayed?.key && !refreshing && (!candidate || candidate.key === item.key)) {
      setDisplayed(null);
    }
    if (item.key === candidate?.key && slides.length > 1) {
      const next = nextIndex(item.index, slides.length, 1);
      setRequestedIndex(next);
    }
  }

  function handleLoad(item: PreparedSlide, image: HTMLImageElement) {
    const decoding = typeof image.decode === "function" ? image.decode() : Promise.resolve();
    void decoding
      .then(() => {
        if (image.isConnected && item.key === candidate?.key) setDisplayed(item);
      })
      .catch(() => {
        if (image.isConnected && (item.key === candidate?.key || item.key === displayed?.key)) {
          handleFailure(item);
        }
      });
  }

  const refreshExpiredSlide = useCallback(
    async (slideId: string, fallbackIndex: number) => {
      const sequence = ++refreshSequence.current;
      initialRefreshFailed.current = false;
      setRefreshing(true);
      try {
        const data = await api.pageBanners.publicRead(placementId, { forceFresh: true });
        if (sequence !== refreshSequence.current) return;
        const updatedIndex = data.slides.findIndex((slide) => slide.id === slideId);
        setRead({ api, placementId, status: "ready", data });
        setRequestedIndex(updatedIndex >= 0 ? updatedIndex : 0);
      } catch {
        // Retain the last decoded image; allow another user action to retry.
        if (sequence !== refreshSequence.current) return;
        initialRefreshFailed.current = true;
        setRequestedIndex(fallbackIndex);
      } finally {
        if (sequence === refreshSequence.current) setRefreshing(false);
      }
    },
    [api, placementId],
  );

  async function navigate(direction: -1 | 1) {
    if (!validDisplayed || refreshing || slides.length <= 1) return;
    const desiredIndex = nextIndex(validDisplayed.index, slides.length, direction);
    const desiredSlide = slides[desiredIndex]!;
    const desiredVariant = mediaVariant(desiredSlide, pixelWidth);
    if (!desiredVariant) return;
    setFailedKeys([]);
    if (expiresSoon(desiredVariant)) {
      await refreshExpiredSlide(desiredSlide.id, validDisplayed.index);
      return;
    }
    setRequestedIndex(desiredIndex);
  }

  const pending = candidate?.key === validDisplayed?.key ? null : candidate;
  const expiredCandidate = pending && expiresSoon(pending.variant) ? pending : null;
  useEffect(() => {
    if (refreshing) return;
    if (!expiredCandidate) {
      lastAutomaticRefresh.current = null;
      return;
    }
    const key = [
      placementId,
      pixelWidth,
      expiredCandidate.slide.id,
      expiredCandidate.variant.variant,
      refreshTrigger,
    ].join(":");
    if (lastAutomaticRefresh.current === key) return;
    lastAutomaticRefresh.current = key;
    void refreshExpiredSlide(
      expiredCandidate.slide.id,
      validDisplayed?.index ?? expiredCandidate.index,
    );
  }, [
    expiredCandidate,
    refreshing,
    placementId,
    pixelWidth,
    refreshTrigger,
    validDisplayed?.index,
    refreshExpiredSlide,
  ]);

  useEffect(() => {
    const preparation = activePreparation.current;
    if (!preparation || !currentRead || refreshing) return;
    if (
      currentRead.status === "error" ||
      (currentRead.status === "ready" &&
        (!slides.length || !candidate || Boolean(expiredCandidate && initialRefreshFailed.current)))
    ) {
      preparation.settle();
      return;
    }
    if (!validDisplayed) return;
    // Detached preload completion is insufficient: let the decoded mounted frame paint first.
    if (typeof window.requestAnimationFrame !== "function") {
      queueMicrotask(() => preparation.settle());
      return;
    }
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => preparation.settle());
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [currentRead, slides.length, candidate, expiredCandidate, validDisplayed, refreshing]);

  const usablePending = expiredCandidate ? null : pending;
  if (!validDisplayed && !usablePending) return null;

  function renderArtwork(item: PreparedSlide, visible: boolean) {
    const image = (
      <img
        className="page-banner__image"
        src={item.variant.contentUrl}
        width={item.variant.widthPx}
        height={item.variant.heightPx}
        alt={item.slide.isDecorative ? "" : (item.slide.altText ?? "")}
        aria-hidden={!visible}
        loading="eager"
        fetchPriority={validDisplayed ? "auto" : "high"}
        decoding="async"
        style={visible ? undefined : { visibility: "hidden", position: "absolute", inset: 0 }}
        onLoad={(event) => handleLoad(item, event.currentTarget)}
        onError={() => handleFailure(item)}
      />
    );
    return item.slide.destination ? (
      <a
        key={item.key}
        className="page-banner__link"
        href={item.slide.destination.url}
        aria-label={item.slide.isDecorative ? `${placementLabels[placementId]} banner` : undefined}
        aria-hidden={!visible}
        tabIndex={visible ? undefined : -1}
        style={
          visible
            ? undefined
            : { pointerEvents: "none", position: "absolute", inset: 0, visibility: "hidden" }
        }
        {...(item.slide.destination.kind === "EXTERNAL"
          ? { rel: "noreferrer noopener", target: "_blank" }
          : {})}
      >
        {image}
      </a>
    ) : (
      <React.Fragment key={item.key}>{image}</React.Fragment>
    );
  }

  return (
    <div className="hooma-lane--media" hidden={!validDisplayed}>
      <section
        className={`page-banner${className ? ` ${className}` : ""}`}
        data-page-banner
        data-placement={placementId}
        data-state={validDisplayed ? "ready" : "loading"}
        aria-label={`${placementLabels[placementId]} banner`}
      >
        <div className="page-banner__frame">
          {validDisplayed ? renderArtwork(validDisplayed, true) : null}
          {usablePending ? renderArtwork(usablePending, false) : null}
        </div>
        {validDisplayed && slides.length > 1 ? (
          <div className="page-banner__controls">
            <button
              className="page-banner__control"
              type="button"
              aria-label="Previous banner"
              onClick={() => void navigate(-1)}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <span
              className="page-banner__position"
              aria-label={`${validDisplayed.index + 1} of ${slides.length}`}
            >
              {validDisplayed.index + 1} of {slides.length}
            </span>
            <button
              className="page-banner__control"
              type="button"
              aria-label="Next banner"
              onClick={() => void navigate(1)}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
