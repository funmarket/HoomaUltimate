import type { ReactNode } from "react";
import { HomeGatewayGrid } from "./home/HomeGatewayGrid.js";

export { HomeGatewayCard } from "./home/HomeGatewayCard.js";
export { HomeGatewayGrid } from "./home/HomeGatewayGrid.js";
export { HOME_GATEWAYS } from "./home/home-gateways.js";
export type { HomeGatewayId, HomeGatewayItem } from "./home/home-gateways.js";
export { TeamsHero } from "./teams/TeamsHero.js";
export { TeamDiscoveryCard } from "./teams/TeamDiscoveryCard.js";
export type { TeamDiscoveryCardProps } from "./teams/TeamDiscoveryCard.js";

export const PRIMARY_NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Play", href: "/play" },
  { label: "Watch", href: "/watch" },
  { label: "HOOMA", href: "/hooma" },
  { label: "Pitch", href: "/pitch" }
] as const;

export interface FoundationShellProps { readonly surface: "Web" | "Telegram"; readonly children?: ReactNode; }
export function FoundationShell({ surface, children }: FoundationShellProps) {
  return <main className="foundation-shell"><header><p className="eyebrow">{surface}</p><h1>HOOMA</h1></header><section className="shell-content">{children}</section><nav aria-label="Primary">{PRIMARY_NAV_ITEMS.map((item) => <a key={item.label} href={item.href}>{item.label}</a>)}</nav></main>;
}
export function HomeGateway() {
  return <section><p className="eyebrow">YOUR FOOTBALL NEIGHBORHOOD</p><h2>Find your people. Find the game.</h2><HomeGatewayGrid /></section>;
}
