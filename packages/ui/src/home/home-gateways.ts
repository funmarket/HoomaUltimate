export type HomeGatewayId =
  | "hooma"
  | "teams"
  | "ultras"
  | "gamers"
  | "places"
  | "requests"
  | "ride"
  | "fundme";

export interface HomeGatewayItem {
  readonly id: HomeGatewayId;
  readonly label: string;
  readonly href: string;
  readonly artwork: string;
}

export const HOME_GATEWAYS: readonly HomeGatewayItem[] = [
  { id: "hooma", label: "HOOMA", href: "/hooma", artwork: "/home-gateways/hooma.webp" },
  { id: "teams", label: "Teams", href: "/teams", artwork: "/home-gateways/teams.webp" },
  { id: "ultras", label: "Ultras", href: "/ultras", artwork: "/home-gateways/ultras.webp" },
  { id: "gamers", label: "Gamers", href: "/gamers", artwork: "/home-gateways/gamers.webp" },
  { id: "places", label: "Places", href: "/places", artwork: "/home-gateways/places.webp" },
  { id: "requests", label: "Requests", href: "/requests", artwork: "/home-gateways/requests.webp" },
  { id: "ride", label: "Ride", href: "/rides", artwork: "/home-gateways/ride.webp" },
  { id: "fundme", label: "FundMe", href: "/fundme", artwork: "/home-gateways/fundme.webp" }
] as const;
