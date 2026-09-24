import { useEffect, useRef, useState } from "react";
import type { HelpRequest } from "@hooma/contracts/requests";
import { ClockIcon, LocationIcon } from "../help/HelpIcons";
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
          {item.taxonomy ? (
            <span>
              {item.taxonomy.sportLabel ?? titleCase(item.taxonomy.requestType)} ·{" "}
              {item.taxonomy.subcategory.label}
            </span>
          ) : item.sport ? (
            <span>{titleCase(item.sport)}</span>
          ) : null}
          {item.quantityNeeded ? <span>Qty {item.quantityNeeded}</span> : null}
        </span>
        <span className="request-card__expand-label">
          <span className="sr-only">{expanded ? "Hide details" : "Show details"}</span>
          <span aria-hidden="true">{expanded ? "⌃" : "›"}</span>
        </span>
      </button>

      {expanded ? (
        <section
          id={detailsId}
          className="request-card__details"
          aria-label={`${item.title} details`}
        >
          <div className="request-detail__facts">
            {item.customNeed ? <span>Need details · {item.customNeed}</span> : null}
            {item.sizeLabel ? <span>Size · {item.sizeLabel}</span> : null}
            {item.conditionPreference ? (
              <span>Condition · {titleCase(item.conditionPreference)}</span>
            ) : null}
            {item.locationNote ? <span>Location note · {item.locationNote}</span> : null}
            {item.expiresAt ? (
              <span>Closes · {new Date(item.expiresAt).toLocaleDateString()}</span>
            ) : null}
          </div>
          <a
            className="help-action help-action--primary"
            href={`/requests/${encodeURIComponent(item.id)}`}
          >
            View full Request
          </a>
        </section>
      ) : null}

      <div className="request-card__requester">
        <RequestRequester requester={item.requester} />
      </div>
    </article>
  );
}
