export type HomeGatewayId = "hooma" | "teams" | "spots" | "pitch" | "ride" | "requests";

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
    id: "spots",
    label: "Spots",
    subtitle: "Cafés & lounges",
    href: "/places",
    artwork: "/home-gateways/places.png",
    availability: "available",
  },
  {
    id: "pitch",
    label: "Pitch",
    subtitle: "Find a pitch",
    href: "/pitch",
    artwork: "/home-gateways/pitch.webp",
    availability: "available",
  },
  {
    id: "ride",
    label: "Ride",
    subtitle: "To the match",
    href: "/rides",
    artwork: "/home-gateways/ride.png",
    availability: "available",
  },
  {
    id: "requests",
    label: "Requests",
    subtitle: "Gear and support",
    href: "/requests",
    artwork: "/home-gateways/requests.png",
    availability: "available",
  },
] as const;
