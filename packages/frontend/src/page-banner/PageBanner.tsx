import React, { useEffect, useMemo, useState } from "react";
import type { PageBannerPlacementId } from "@hooma/contracts/page-banner";
import { useHoomaFrontend } from "../context";
import type { PageBannerPublicSlide } from "./api";

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

function mediaVariant(slide: PageBannerPublicSlide) {
  return (
    slide.variants.find((variant) => variant.variant === "master") ?? slide.variants[0] ?? null
  );
}

function nextIndex(current: number, length: number, direction: -1 | 1): number {
  return (current + direction + length) % length;
}

type PageBannerProps = {
  readonly placementId: PageBannerPlacementId;
  readonly className?: string;
};

export function PageBanner({ placementId, className }: PageBannerProps) {
  const { api } = useHoomaFrontend();
  const [response, setResponse] = useState<{
    readonly api: typeof api;
    readonly placementId: PageBannerPlacementId;
    readonly status: "loading" | "ready" | "error";
    readonly data?: Awaited<ReturnType<typeof api.pageBanners.publicRead>>;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [decodedKey, setDecodedKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setResponse({ api, placementId, status: "loading" });
    setActiveIndex(0);
    setDecodedKey(null);
    void api.pageBanners
      .publicRead(placementId)
      .then((data) => {
        if (active) setResponse({ api, placementId, status: "ready", data });
      })
      .catch(() => {
        if (active) setResponse({ api, placementId, status: "error" });
      });
    return () => {
      active = false;
    };
  }, [api, placementId]);

  const currentResponse =
    response?.api === api && response.placementId === placementId ? response : null;
  const slides = useMemo(
    () =>
      currentResponse?.status === "ready" && currentResponse.data?.enabled
        ? currentResponse.data.slides.filter((slide) => mediaVariant(slide))
        : [],
    [currentResponse],
  );
  const slide = slides.length ? slides[Math.min(activeIndex, slides.length - 1)]! : null;
  const variant = slide ? mediaVariant(slide) : null;
  const imageKey = slide && variant ? `${placementId}:${slide.id}:${variant.contentUrl}` : null;

  useEffect(() => {
    let active = true;
    setDecodedKey(null);
    if (!variant || !imageKey || !variant.contentUrl.trim()) return;
    const image = new Image();
    const ready = () => {
      if (!active || !image.naturalWidth || !image.naturalHeight) return;
      const decoding = typeof image.decode === "function" ? image.decode() : Promise.resolve();
      void decoding
        .then(() => {
          if (active) setDecodedKey(imageKey);
        })
        .catch(() => {
          if (active) setDecodedKey(null);
        });
    };
    image.onload = ready;
    image.onerror = () => {
      if (active) setDecodedKey(null);
    };
    image.src = variant.contentUrl;
    if (image.complete && image.naturalWidth > 0) ready();
    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [imageKey, variant?.contentUrl]);

  if (!slide || !variant || !imageKey || decodedKey !== imageKey) return null;

  const image = (
    <img
      className="page-banner__image"
      src={variant.contentUrl}
      width={variant.widthPx}
      height={variant.heightPx}
      alt={slide.isDecorative ? "" : (slide.altText ?? "")}
      loading="eager"
      decoding="async"
      onError={() => setDecodedKey(null)}
    />
  );
  return (
    <section
      className={`page-banner${className ? ` ${className}` : ""}`}
      data-page-banner
      data-placement={placementId}
      data-state="ready"
      aria-label={`${placementLabels[placementId]} banner`}
    >
      <div className="page-banner__frame">
        {slide.destination ? (
          <a
            className="page-banner__link"
            href={slide.destination.url}
            {...(slide.destination.kind === "EXTERNAL"
              ? { rel: "noreferrer noopener", target: "_blank" }
              : {})}
          >
            {image}
          </a>
        ) : (
          image
        )}
      </div>
      {slides.length > 1 ? (
        <div className="page-banner__controls">
          <button
            className="page-banner__control"
            type="button"
            aria-label="Previous banner"
            onClick={() => setActiveIndex((current) => nextIndex(current, slides.length, -1))}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <span
            className="page-banner__position"
            aria-label={`${activeIndex + 1} of ${slides.length}`}
          >
            {activeIndex + 1} of {slides.length}
          </span>
          <button
            className="page-banner__control"
            type="button"
            aria-label="Next banner"
            onClick={() => setActiveIndex((current) => nextIndex(current, slides.length, 1))}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
