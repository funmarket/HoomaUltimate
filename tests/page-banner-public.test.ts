import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PageBannerPlacementId } from "@hooma/contracts/page-banner";
import { useHoomaFrontend } from "../context";
import type { PageBannerPublicSlide, PageBannerPublicVariant } from "./api";

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

function mediaVariant(slide: PageBannerPublicSlide, requiredWidth: number) {
  const available = slide.variants
    .filter((variant) => variant.contentUrl.trim() && variant.widthPx > 0 && variant.heightPx > 0)
    .slice()
    .sort((a, b) => a.widthPx - b.widthPx);
  return available.find((variant) => variant.widthPx >= requiredWidth) ?? available.at(-1) ?? null;
}

function nextIndex(current: number, length: number, direction: -1 | 1): number {
  return (current + direction + length) % length;
}

function requiredImageWidth() {
  if (typeof window === "undefined") return 720;
  return Math.ceil(window.innerWidth * (window.devicePixelRatio || 1));
}

function expiresSoon(variant: PageBannerPublicVariant) {
  const expiry = Date.parse(variant.expiresAt);
  return !Number.isFinite(expiry) || expiry <= Date.now() + 60_000;
}

type PageBannerProps = {
  readonly placementId: PageBannerPlacementId;
  readonly className?: string;
};

export function PageBanner({ placementId, className }: PageBannerProps) {
  const { api } = useHoomaFrontend();
  const refreshSequence = useRef(0);
  const [read, setRead] = useState<{
    readonly api: typeof api;
    readonly placementId: PageBannerPlacementId;
    readonly status: "loading" | "ready" | "error";
    readonly data?: PublicRead;
  } | null>(null);
  const [requestedIndex, setRequestedIndex] = useState(0);
  const [displayed, setDisplayed] = useState<PreparedSlide | null>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [failedKeys, setFailedKeys] = useState<readonly string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pixelWidth, setPixelWidth] = useState(requiredImageWidth);

  useEffect(() => {
    const onResize = () => setPixelWidth(requiredImageWidth());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let active = true;
    refreshSequence.current += 1;
    setRead({ api, placementId, status: "loading" });
    setRequestedIndex(0);
    setDisplayed(null);
    setReadyKey(null);
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
      refreshSequence.current += 1;
    };
  }, [api, placementId]);

  const currentRead = read?.api === api && read.placementId === placementId ? read : null;
  const slides = useMemo(
    () =>
      currentRead?.status === "ready" && currentRead.data?.enabled
        ? currentRead.data.slides.filter((slide) =>
            slide.variants.some((variant) => variant.contentUrl),
          )
        : [],
    [currentRead],
  );
  const selectedIndex = Math.min(requestedIndex, Math.max(slides.length - 1, 0));
  const candidate = useMemo(() => {
    if (!slides.length || refreshing) return null;
    const slide = slides[selectedIndex]!;
    const variant = mediaVariant(slide, pixelWidth);
    if (!variant) return null;
    const key = `${placementId}:${slide.id}:${variant.contentUrl}`;
    return failedKeys.includes(key) ? null : { key, index: selectedIndex, slide, variant };
  }, [slides, selectedIndex, pixelWidth, failedKeys, refreshing, placementId]);

  const validDisplayed =
    currentRead?.status === "ready" &&
    currentRead.data?.enabled &&
    displayed &&
    slides.some((slide) => slide.id === displayed.slide.id)
      ? displayed
      : null;

  useEffect(() => {
    if (candidate && candidate.key === readyKey) setDisplayed(candidate);
  }, [candidate, readyKey]);

  function handleFailure(item: PreparedSlide) {
    setFailedKeys((keys) => (keys.includes(item.key) ? keys : [...keys, item.key]));
    setReadyKey(null);
    if (item.key === displayed?.key) setDisplayed(null);
    if (item.key === candidate?.key && slides.length > 1) {
      const next = nextIndex(item.index, slides.length, 1);
      setRequestedIndex(next);
    }
  }

  function handleLoad(item: PreparedSlide, image: HTMLImageElement) {
    const decoding = typeof image.decode === "function" ? image.decode() : Promise.resolve();
    void decoding
      .then(() => {
        if (image.isConnected) setReadyKey(item.key);
      })
      .catch(() => {
        if (image.isConnected) handleFailure(item);
      });
  }

  async function navigate(direction: -1 | 1) {
    if (!validDisplayed || refreshing || slides.length <= 1) return;
    const desiredIndex = nextIndex(validDisplayed.index, slides.length, direction);
    const desiredSlide = slides[desiredIndex]!;
    const desiredVariant = mediaVariant(desiredSlide, pixelWidth);
    if (!desiredVariant) return;
    setFailedKeys([]);
    setReadyKey(null);
    if (!expiresSoon(desiredVariant)) {
      setRequestedIndex(desiredIndex);
      return;
    }

    const sequence = ++refreshSequence.current;
    setRefreshing(true);
    try {
      const data = await api.pageBanners.publicRead(placementId);
      if (sequence !== refreshSequence.current) return;
      const updatedIndex = data.slides.findIndex((slide) => slide.id === desiredSlide.id);
      setRead({ api, placementId, status: "ready", data });
      setRequestedIndex(updatedIndex >= 0 ? updatedIndex : 0);
    } catch {
      // Keep the last decoded image and its controls; the next interaction can retry.
      if (sequence !== refreshSequence.current) return;
      setRequestedIndex(validDisplayed.index);
    } finally {
      if (sequence === refreshSequence.current) setRefreshing(false);
    }
  }

  const pending = candidate?.key === validDisplayed?.key ? null : candidate;
  if (!validDisplayed && !pending) return null;

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
          {pending ? renderArtwork(pending, false) : null}
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
