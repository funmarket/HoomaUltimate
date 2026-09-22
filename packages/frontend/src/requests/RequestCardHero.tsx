import { useEffect, useState } from "react";
import type { HelpRequest } from "@hooma/contracts/requests";
import { LocationIcon } from "../help/HelpIcons";
import { requestImageUrl } from "./RequestCard";

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Poster hero: the Request photo when one exists, otherwise a taxonomy-driven
 * gradient panel. The location pill, the request-type badge and the lifecycle
 * status overlay the image; the status text keeps the shared `.request-status`
 * markup so the card and the detail page stay visually consistent.
 */
export function RequestCardHero({
  item,
  memberView,
}: {
  readonly item: HelpRequest;
  readonly memberView: boolean;
}) {
  const imageUrl = requestImageUrl(item, memberView);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);

  const place = [item.houma, item.city].filter(Boolean).join(", ");
  const communityRequest =
    item.taxonomy?.requestType === "COMMUNITY" || item.requestType === "COMMUNITY";
  // The reference badge names the sport (FOOTBALL), so a sport Request shows its
  // sport and a community Request shows the community root instead of a sport.
  const typeLabel = communityRequest
    ? "Community"
    : (item.taxonomy?.sportLabel ?? (item.sport ? titleCase(item.sport) : null));

  return (
    <div className={`request-card__hero${imageUrl && !failed ? " has-image" : " is-fallback"}`}>
      {imageUrl && !failed ? (
        <img
          className="request-card__hero-image"
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : null}
      <span className="request-card__hero-scrim" aria-hidden="true" />
      {typeLabel ? <span className="request-card__type">{typeLabel}</span> : null}
      <span className={`request-status request-status--${item.status.toLowerCase()}`}>
        <span className="request-status__dot" aria-hidden="true" />
        {titleCase(item.status)}
      </span>
      {place ? (
        <span className="request-card__location">
          <LocationIcon />
          {place}
        </span>
      ) : null}
    </div>
  );
}
