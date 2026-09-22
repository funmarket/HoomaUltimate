import type { HelpRequest } from "@hooma/contracts/requests";
import { RequestCardChips } from "./RequestCardChips";
import { RequestCardHero } from "./RequestCardHero";
import { RequestCardIdentity } from "./RequestCardIdentity";
import { RequestCardMeta } from "./RequestCardMeta";

/**
 * The one image URL a Request card renders. An uploaded photo is served by the
 * canonical Request image route that matches the feed the viewer is on; a
 * requester-supplied URL is rendered as-is. Both paths produce one string, so
 * the card never needs two image branches.
 */
export function requestImageUrl(item: HelpRequest, memberView: boolean): string | null {
  if (item.hasUploadedImage) {
    const base = memberView ? "/api/v1/requests" : "/api/public/v1/requests";
    return `${base}/${encodeURIComponent(item.id)}/image`;
  }
  return item.imageUrl ?? null;
}

const AUDIENCE_LABELS: Record<string, string> = {
  PUBLIC: "Everyone",
  HOOMA_COMMUNITY: "HOOMA community",
  ATHLETES_COMMUNITY: "Athletes community",
};

/**
 * The canonical Request card. The locked reference design is a poster card:
 * hero first, then an eyebrow row with the requester identity right-aligned,
 * a two-weight headline, the taxonomy chips, one hairline, the description and
 * the icon metadata row. The reference's Whistle composer is deliberately not
 * rendered: the canonical Whistle domain has no Request context, so a composer
 * here would be an affordance that cannot work.
 */
export function RequestCard({
  item,
  memberView = false,
}: {
  readonly item: HelpRequest;
  /** True inside the authenticated member feed, where scoped Requests follow member visibility. */
  readonly memberView?: boolean;
}) {
  const detailHref = `/requests/${encodeURIComponent(item.id)}`;
  const communityRequest =
    item.taxonomy?.requestType === "COMMUNITY" || item.requestType === "COMMUNITY";
  const [firstWord, ...remainingWords] = item.title.trim().split(/\s+/);
  const audienceLabel = AUDIENCE_LABELS[item.audienceScope] ?? "Everyone";

  return (
    <article className={`request-card${communityRequest ? " request-card--community" : ""}`}>
      <a className="request-card__link" href={detailHref}>
        <RequestCardHero item={item} memberView={memberView} />
        <div className="request-card__content">
          <span className="request-card__eyebrow">
            <span className="request-card__eyebrow-bar" aria-hidden="true" />
            {audienceLabel}
          </span>
          <h2 className="request-card__title">
            <span className="request-card__title-accent">{firstWord}</span>{" "}
            {remainingWords.length > 0 ? (
              <span className="request-card__title-rest">{remainingWords.join(" ")}</span>
            ) : null}
          </h2>
          <RequestCardIdentity requester={item.requester} />
          <RequestCardChips item={item} />
          <span className="request-card__divider" aria-hidden="true" />
          <p className="request-card__description">{item.description}</p>
          <RequestCardMeta item={item} />
        </div>
      </a>
    </article>
  );
}
