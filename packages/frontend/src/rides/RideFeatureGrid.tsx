import { RideHistoryIcon, RideMapPinPlusIcon, RideRouteIcon, RideStadiumIcon } from "./RideIcons";

const features = [
  {
    className: "ride-feature-card--matchday",
    href: "/rides/matchday",
    icon: <RideStadiumIcon />,
    title: "MATCHDAY RIDE",
    copy: "Head to the match together.",
  },
  {
    className: "ride-feature-card--anywhere",
    href: "/rides/anywhere",
    icon: <RideRouteIcon />,
    title: "ANYWHERE RIDE",
    copy: "Airport, work, home or another city.",
  },
  {
    className: "ride-feature-card--request",
    href: "/rides/request",
    icon: <RideMapPinPlusIcon />,
    title: "REQUEST A RIDE",
    copy: "Need a lift? Post your trip.",
  },
  {
    className: "ride-feature-card--mine",
    href: "/rides/mine",
    icon: <RideHistoryIcon />,
    title: "MY RIDES",
    copy: "Your offers, requests and Ride status.",
  },
] as const;

export function RideFeatureGrid() {
  return (
    <section className="ride-feature-grid" aria-label="Ride shortcuts">
      {features.map((feature) => (
        <a
          className={`ride-feature-card ${feature.className}`}
          href={feature.href}
          key={feature.title}
        >
          <span className="ride-feature-card__icon" aria-hidden="true">
            {feature.icon}
          </span>
          <span className="ride-feature-card__title">{feature.title}</span>
          <span className="ride-feature-card__copy">{feature.copy}</span>
        </a>
      ))}
    </section>
  );
}
