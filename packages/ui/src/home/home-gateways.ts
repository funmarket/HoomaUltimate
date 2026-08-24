export type HomeGatewayId =
  "hooma" | "teams" | "ultras" | "gamers" | "places" | "requests" | "ride" | "fundme";

export interface HomeGatewayItem {
  readonly id: HomeGatewayId;
  readonly label: string;
  readonly href: string;
  readonly artwork: string;
}

export const HOME_GATEWAYS: readonly HomeGatewayItem[] = [
  { id: "hooma", label: "HOOMA", href: "/hooma", artwork: "/home-gateways/hooma.png" },
  { id: "teams", label: "Teams", href: "/teams", artwork: "/home-gateways/teams.png" },
  { id: "ultras", label: "Ultras", href: "/ultras", artwork: "/home-gateways/ultras.png" },
  { id: "gamers", label: "Gamers", href: "/gamers", artwork: "/home-gateways/gamers.png" },
  { id: "places", label: "Places", href: "/places", artwork: "/home-gateways/places.png" },
  { id: "requests", label: "Requests", href: "/requests", artwork: "/home-gateways/requests.png" },
  { id: "ride", label: "Ride", href: "/rides", artwork: "/home-gateways/ride.png" },
  { id: "fundme", label: "FundMe", href: "/fundme", artwork: "/home-gateways/fundme.png" },
] as const;
