import React, { useEffect, useMemo, useState, type ReactNode } from "react";
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
    readonly status: "loading" | "ready" | "error";
    readonly data?: Awaited<ReturnType<typeof api.pageBanners.publicRead>>;
  }>({ status: "loading" });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let active = true;
    setResponse({ status: "loading" });
    setActiveIndex(0);
    void api.pageBanners
      .publicRead(placementId)
      .then((data) => {
        if (active) setResponse({ status: "ready", data });
      })
      .catch(() => {
        if (active) setResponse({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [api, placementId]);

  const slides = useMemo(
    () =>
      response.status === "ready" && response.data?.enabled
        ? response.data.slides.filter((slide) => mediaVariant(slide))
        : [],
    [response],
  );

  const slide = slides.length ? slides[Math.min(activeIndex, slides.length - 1)]! : null;
  const variant = slide ? mediaVariant(slide) : null;

  if (response.status === "loading") {
    return (
      <section
        className="page-banner page-banner--loading"
        data-page-banner
        data-state="loading"
        aria-label={`${placementLabels[placementId]} banner`}
        aria-busy="true"
      />
    );
  }

  if (response.status === "error") return null;

  if (!variant) return null;

  let managedContent: ReactNode = null;
  if (slide && variant) {
    const image = React.createElement("img", {
      className: "page-banner__image",
      src: variant.contentUrl,
      width: variant.widthPx,
      height: variant.heightPx,
      alt: slide.isDecorative ? "" : (slide.altText ?? ""),
      loading: "eager",
      decoding: "async",
    });
    managedContent = slide.destination ? (
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
    );
  }

  return (
    <section
      className={`page-banner${className ? ` ${className}` : ""}`}
      data-page-banner
      data-placement={placementId}
      data-state="ready"
      aria-label={`${placementLabels[placementId]} banner`}
    >
      <div className="page-banner__frame">{managedContent}</div>
      {variant && slides.length > 1 ? (
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
