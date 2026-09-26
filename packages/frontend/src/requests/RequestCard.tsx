import { useEffect, useRef, useState } from "react";
import type { HelpRequest } from "@hooma/contracts/requests";
import { ChevronRightIcon, ChevronUpIcon, ClockIcon, LocationIcon } from "../help/HelpIcons";
import { RequestRequester } from "./RequestRequester";

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function RequestCard({
  item,
  loadImage,
}: {
  readonly item: HelpRequest;
  readonly loadImage?: ((requestId: string) => Promise<string>) | undefined;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const place = [item.houma, item.city].filter(Boolean).join(", ");
  const detailsId = `request-card-details-${item.id}`;
  const taxonomySummary = item.taxonomy
    ? `${item.taxonomy.sportLabel ?? titleCase(item.taxonomy.requestType)} · ${item.taxonomy.subcategory.label}`
    : item.sport
      ? titleCase(item.sport)
      : "";
  const hasRequestFacts = Boolean(
    taxonomySummary ||
    item.quantityNeeded ||
    item.customNeed ||
    item.sizeLabel ||
    item.conditionPreference,
  );
  const hasRequestContext = Boolean(
    place || item.neededByAt || item.locationNote || item.expiresAt,
  );

  useEffect(() => {
    if (!item.image || !loadImage) return;
    let active = true;
    let observer: IntersectionObserver | undefined;

    const resolveImage = async () => {
      try {
        const url = await loadImage(item.id);
        if (active) setImageUrl(url);
      } catch {
        // Media is optional; the Request remains usable if delivery fails.
      }
    };

    if (typeof IntersectionObserver === "undefined") {
      void resolveImage();
    } else if (cardRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          void resolveImage();
        },
        { rootMargin: "240px" },
      );
      observer.observe(cardRef.current);
    }

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [item.id, item.image, loadImage]);

  return (
    <article
      ref={cardRef}
      className={`request-card${imageUrl ? " request-card--with-image" : ""}${expanded ? " request-card--expanded" : ""}`}
    >
      {imageUrl ? (
        <img
          className="request-card__image"
          src={imageUrl}
          alt={`${item.title} Request`}
          loading="lazy"
        />
      ) : null}
      <button
        type="button"
        className="request-card__primary"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="request-card__topline">
          <span className="request-chip">
            {item.taxonomy?.need.label ?? titleCase(item.category)}
          </span>
          <span className={`request-status request-status--${item.status.toLowerCase()}`}>
            <span className="request-status__dot" aria-hidden="true" />
            {titleCase(item.status)}
          </span>
        </span>
        <span className="request-card__body">
          <strong>{item.title}</strong>
          <span>{item.description}</span>
        </span>
        {!expanded ? (
          <span className="request-card__meta">
            {place ? (
              <span>
                <LocationIcon />
                {place}
              </span>
            ) : null}
            {item.neededByAt ? (
              <span>
                <ClockIcon />
                Needed {new Date(item.neededByAt).toLocaleDateString()}
              </span>
            ) : null}
            {taxonomySummary ? (
              <span className="request-card__meta-secondary">{taxonomySummary}</span>
            ) : null}
            {item.quantityNeeded ? (
              <span className="request-card__meta-secondary">Qty {item.quantityNeeded}</span>
            ) : null}
          </span>
        ) : null}
        <span className="request-card__expand-label">
          <span className="sr-only">{expanded ? "Hide details" : "Show details"}</span>
          {expanded ? <ChevronUpIcon /> : <ChevronRightIcon />}
        </span>
      </button>
      <div className="request-card__requester">
        <RequestRequester requester={item.requester} />
      </div>
      {expanded ? (
        <section
          id={detailsId}
          className="request-card__details"
          aria-label={`${item.title} details`}
        >
          {hasRequestFacts ? (
            <dl className="request-card-detail__facts" aria-label="Request facts">
              {taxonomySummary ? (
                <div className="request-card-detail__fact">
                  <dt>Category</dt>
                  <dd>{taxonomySummary}</dd>
                </div>
              ) : null}
              {item.quantityNeeded ? (
                <div className="request-card-detail__fact">
                  <dt>Quantity</dt>
                  <dd>{item.quantityNeeded}</dd>
                </div>
              ) : null}
              {item.customNeed ? (
                <div className="request-card-detail__fact">
                  <dt>Specific need</dt>
                  <dd>{item.customNeed}</dd>
                </div>
              ) : null}
              {item.sizeLabel ? (
                <div className="request-card-detail__fact">
                  <dt>Size</dt>
                  <dd>{item.sizeLabel}</dd>
                </div>
              ) : null}
              {item.conditionPreference ? (
                <div className="request-card-detail__fact">
                  <dt>Condition</dt>
                  <dd>{titleCase(item.conditionPreference)}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {hasRequestContext ? (
            <div className="request-card-detail__context" aria-label="Request location and timing">
              {place ? (
                <span>
                  <LocationIcon />
                  <span className="request-card-detail__context-copy">
                    <small>Location</small>
                    <strong>{place}</strong>
                  </span>
                </span>
              ) : null}
              {item.neededByAt ? (
                <span>
                  <ClockIcon />
                  <span className="request-card-detail__context-copy">
                    <small>Needed by</small>
                    <strong>{new Date(item.neededByAt).toLocaleDateString()}</strong>
                  </span>
                </span>
              ) : null}
              {item.locationNote ? (
                <span className="request-card-detail__context-copy">
                  <small>Location note</small>
                  <strong>{item.locationNote}</strong>
                </span>
              ) : null}
              {item.expiresAt ? (
                <span className="request-card-detail__context-copy">
                  <small>Closes</small>
                  <strong>{new Date(item.expiresAt).toLocaleDateString()}</strong>
                </span>
              ) : null}
            </div>
          ) : null}
          <a
            className="help-action help-action--primary"
            href={`/requests/${encodeURIComponent(item.id)}`}
          >
            View full Request
          </a>
        </section>
      ) : null}
    </article>
  );
}
