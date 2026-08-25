export type HomeGatewayId =
  "hooma" | "teams" | "ultras" | "gamers" | "places" | "requests" | "ride" | "fundme";

export type HomeGatewayAvailability = "available" | "coming-soon";

export interface HomeGatewayItem {
  readonly id: HomeGatewayId;
  readonly label: string;
  readonly subtitle: string;
  readonly href: string | null;
  readonly artwork: string;
  readonly availability: HomeGatewayAvailability;
}

export const HOME_GATEWAYS: readonly HomeGatewayItem[] = [
  {
    id: "hooma",
    label: "HOOMA",
    subtitle: "Community",
    href: "/hooma",
    artwork: "/home-gateways/hooma.png",
    availability: "available",
  },
  {
    id: "teams",
    label: "Teams",
    subtitle: "Manage squads",
    href: "/teams",
    artwork: "/home-gateways/teams.png",
    availability: "available",
  },
  {
    id: "ultras",
    label: "Ultras",
    subtitle: "Coming soon",
    href: null,
    artwork: "/home-gateways/ultras.png",
    availability: "coming-soon",
  },
  {
    id: "gamers",
    label: "Gamers",
    subtitle: "Find opponents",
    href: "/gamers",
    artwork: "/home-gateways/gamers.png",
    availability: "available",
  },
  {
    id: "places",
    label: "Places",
    subtitle: "Watch + Pitch",
    href: "/places",
    artwork: "/home-gateways/places.png",
    availability: "available",
  },
  {
    id: "requests",
    label: "Requests",
    subtitle: "Coming soon",
    href: null,
    artwork: "/home-gateways/requests.png",
    availability: "coming-soon",
  },
  {
    id: "ride",
    label: "Ride",
    subtitle: "Coming soon",
    href: null,
    artwork: "/home-gateways/ride.png",
    availability: "coming-soon",
  },
  {
    id: "fundme",
    label: "FundMe",
    subtitle: "Coming soon",
    href: null,
    artwork: "/home-gateways/fundme.png",
    availability: "coming-soon",
  },
] as const;
