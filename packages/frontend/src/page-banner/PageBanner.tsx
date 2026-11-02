import React, { useEffect, useState, type ReactNode } from "react";
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

export type PageBannerArtwork = {
  readonly slide: PageBannerPublicSlide;
  readonly variant: PageBannerPublicVariant;
};
export type PageBannerRenderState = {
  readonly artwork: PageBannerArtwork | null;
  readonly slideCount: number;
  readonly status: "loading" | "ready" | "error";
  readonly activeIndex: number;
};

function mediaVariant(slide: PageBannerPublicSlide): PageBannerPublicVariant | null {
  return (
    slide.variants.find((variant) => variant.variant === "master") ?? slide.variants[0] ?? null
  );
}
function nextIndex(current: number, length: number, direction: -1 | 1): number {
  return (current + direction + length) % length;
}

export function usePageBanner(placementId: PageBannerPlacementId): PageBannerRenderState & {
  readonly previous: () => void;
  readonly next: () => void;
} {
  const { api } = useHoomaFrontend();
  const [status, setStatus] = useState<PageBannerRenderState["status"]>("loading");
  const [slides, setSlides] = useState<readonly PageBannerPublicSlide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setSlides([]);
    setActiveIndex(0);
    void api.pageBanners
      .publicRead(placementId)
      .then((response) => {
        if (!active) return;
        setSlides(response.enabled ? response.slides.filter((slide) => mediaVariant(slide)) : []);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [api, placementId]);

  const safeIndex = slides.length ? Math.min(activeIndex, slides.length - 1) : 0;
  const slide = slides[safeIndex] ?? null;
  const variant = slide ? mediaVariant(slide) : null;

  return {
    artwork: slide && variant ? { slide, variant } : null,
    slideCount: slides.length,
    status,
    activeIndex: safeIndex,
    previous: () =>
      setActiveIndex((current) =>
        slides.length ? nextIndex(current, slides.length, -1) : current,
      ),
    next: () =>
      setActiveIndex((current) => (slides.length ? nextIndex(current, slides.length, 1) : current)),
  };
}

export function PageBannerArtwork({
  artwork,
  className = "page-banner__image",
}: {
  readonly artwork: PageBannerArtwork;
  readonly className?: string;
}) {
  const { slide, variant } = artwork;
  const image = (
    <img
      className={className}
      src={variant.contentUrl}
      width={variant.widthPx}
      height={variant.heightPx}
      alt={slide.isDecorative ? "" : (slide.altText ?? "")}
      loading="eager"
      decoding="async"
    />
  );
  if (!slide.destination) return image;
  return (
    <a
      className="page-banner__link"
      href={slide.destination.url}
      {...(slide.destination.kind === "EXTERNAL"
        ? { rel: "noreferrer noopener", target: "_blank" }
        : {})}
    >
      {image}
    </a>
  );
}

export function PageBanner({
  placementId,
  children,
}: {
  readonly placementId: PageBannerPlacementId;
  readonly children: (state: PageBannerRenderState) => ReactNode;
}) {
  const state = usePageBanner(placementId);
  return (
    <div
      className="page-banner"
      data-page-banner
      data-state={state.status}
      data-placement={placementId}
      aria-label={`${placementLabels[placementId]} page banner`}
      aria-busy={state.status === "loading"}
    >
      {state.artwork ? <PageBannerArtwork artwork={state.artwork} /> : children(state)}
      {state.slideCount > 1 ? (
        <div className="page-banner__controls" aria-label="Page banner controls">
          <button
            className="page-banner__control"
            type="button"
            aria-label="Previous banner"
            onClick={state.previous}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <span className="page-banner__position" aria-live="polite">
            {state.activeIndex + 1} of {state.slideCount}
          </span>
          <button
            className="page-banner__control"
            type="button"
            aria-label="Next banner"
            onClick={state.next}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
