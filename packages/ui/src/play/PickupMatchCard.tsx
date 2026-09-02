type PickupMatchCardProps = {
  readonly title: string;
  readonly dateLabel: string;
  readonly venueName?: string | null;
  readonly communityName: string;
  readonly goingCount: number;
  readonly capacity?: number | null;
  readonly format?: string | null;
  readonly href: string;
};

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M7.5 3.5v4M16.5 3.5v4M4 9h16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6.3-5.3 6.3-11A6.3 6.3 0 1 0 5.7 10C5.7 15.7 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.65" />
      <circle cx="16.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.45" />
      <path
        d="M3.8 19c.45-4 2.2-6 5.2-6s4.75 2 5.2 6M14.1 14.2c2.65.1 4.3 1.7 4.8 4.8"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PickupMatchCard(props: PickupMatchCardProps) {
  return (
    <a className="play-game-card" href={props.href}>
      <div className="play-game-card__top">
        <span className="play-game-card__format">
          {props.format?.replaceAll("_", " ") || "Pickup"}
        </span>
        <strong className="play-game-card__title">{props.title}</strong>
        <small className="play-game-card__community">{props.communityName}</small>
      </div>
      <div className="play-game-card__meta">
        <span className="play-game-card__meta-item">
          <i className="play-game-card__icon" aria-hidden="true">
            <CalendarIcon />
          </i>
          <span>{props.dateLabel}</span>
        </span>
        {props.venueName ? (
          <span className="play-game-card__meta-item">
            <i className="play-game-card__icon" aria-hidden="true">
              <PinIcon />
            </i>
            <span>{props.venueName}</span>
          </span>
        ) : null}
        <span className="play-game-card__meta-item play-game-card__meta-item--attendance">
          <i className="play-game-card__icon" aria-hidden="true">
            <UsersIcon />
          </i>
          <span>
            {props.goingCount}
            {props.capacity ? ` / ${props.capacity}` : ""} going
          </span>
        </span>
      </div>
      <div className="play-game-card__cta" hidden>
        View match
      </div>
    </a>
  );
}
