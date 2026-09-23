import type { HelpRequest } from "@hooma/contracts/requests";
import { ClockIcon, LocationIcon } from "../help/HelpIcons";

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function RequestCard({ item }: { readonly item: HelpRequest }) {
  const place = [item.houma, item.city].filter(Boolean).join(", ");

  return (
    <a className="request-card" href={`/requests/${encodeURIComponent(item.id)}`}>
      <div className="request-card__topline">
        <span className="request-chip">{item.taxonomy?.need.label ?? titleCase(item.category)}</span>
        <span className={`request-status request-status--${item.status.toLowerCase()}`}>
          <span className="request-status__dot" aria-hidden="true" />
          {titleCase(item.status)}
        </span>
      </div>
      <div className="request-card__body">
        <h2>{item.title}</h2>
        <p>{item.description}</p>
      </div>
      <div className="request-card__meta">
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
        {item.customNeed ? <span>{item.customNeed}</span> : null}
        {item.quantityNeeded ? <span>Qty {item.quantityNeeded}</span> : null}
      </div>
    </a>
  );
}
