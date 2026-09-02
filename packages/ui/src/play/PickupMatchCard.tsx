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

type IconProps = { readonly color?: string };

function CalendarIcon({ color }: IconProps = {}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={color ? { color } : undefined}
    >
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
function PinIcon({ color }: IconProps = {}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={color ? { color } : undefined}
    >
      <path
        d="M12 21s6.3-5.3 6.3-11A6.3 6.3 0 1 0 5.7 10C5.7 15.7 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function UsersIcon({ color }: IconProps = {}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={color ? { color } : undefined}
    >
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

const playYellow = "#f2c94c";
const goingCurrent = "#d7ff8a";
const goingCapacity = "#22e35a";

export function PickupMatchCard(props: PickupMatchCardProps) {
  return (
    <a className="pickup-match-card-pro" href={props.href}>
      <span className="pickup-match-card-pro__pitch-mark" aria-hidden="true" />
      <div className="pickup-match-card-top">
        <span className="pickup-match-card-format">
          {props.format?.replaceAll("_", " ") || "Pickup"}
        </span>
        <strong>{props.title}</strong>
        <small>{props.communityName}</small>
      </div>
      <div
        className="pickup-match-card-meta"
        aria-label="Match essentials"
        style={{ fontSize: "16px" }}
      >
        <span className="pickup-match-card-meta__date">
          <CalendarIcon color={playYellow} />
          {props.dateLabel}
        </span>
        {props.venueName ? (
          <span className="pickup-match-card-meta__venue">
            <PinIcon color={playYellow} />
            {props.venueName}
          </span>
        ) : null}
        <span
          className="pickup-match-card-meta__going"
          style={{ color: "rgba(246, 243, 232, 0.84)" }}
        >
          <UsersIcon color={playYellow} />
          <strong style={{ color: goingCurrent }}>{props.goingCount}</strong>
          {props.capacity ? (
            <strong style={{ color: goingCapacity }}> / {props.capacity}</strong>
          ) : null}
          {" going"}
        </span>
      </div>
      <div className="pickup-match-card-cta">
        <span>Match page</span>
      </div>
    </a>
  );
}
