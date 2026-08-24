import type { ReactNode } from "react";
import { HomeGatewayGrid } from "./home/HomeGatewayGrid.js";
import { HomeHero } from "./home/HomeHero.js";

export { HoomaAccountHeader } from "./account/HoomaAccountHeader.js";
export type { HoomaAccountHeaderProps, HoomaAccountUser } from "./account/HoomaAccountHeader.js";
export { HoomaBottomNav, PRIMARY_NAV_ITEMS } from "./navigation/HoomaBottomNav.js";
export type { HoomaBottomNavProps } from "./navigation/HoomaBottomNav.js";
export { AppearanceSettings } from "./settings/AppearanceSettings.js";
export type { AppearanceMode } from "./settings/AppearanceSettings.js";
export { HomeHero } from "./home/HomeHero.js";
export { HomeGatewayCard } from "./home/HomeGatewayCard.js";
export { HomeGatewayGrid } from "./home/HomeGatewayGrid.js";
export { HOME_GATEWAYS } from "./home/home-gateways.js";
export type { HomeGatewayId, HomeGatewayItem } from "./home/home-gateways.js";
export { TeamsHero } from "./teams/TeamsHero.js";
export { TeamDiscoveryCard } from "./teams/TeamDiscoveryCard.js";
export type { TeamDiscoveryCardProps } from "./teams/TeamDiscoveryCard.js";
export { TeamBadge, TeamBanner } from "./teams/TeamMedia.js";
export type { TeamBadgeProps, TeamBannerProps } from "./teams/TeamMedia.js";
export { PlayHero } from "./play/PlayHero.js";
export { PickupMatchCard } from "./play/PickupMatchCard.js";

const HOME_GATEWAY_TYPOGRAPHY = `
.home-gateway-title {
  font-family: Georgia, 'Times New Roman', serif;
  line-height: .94;
  letter-spacing: -.045em;
}
`;

export interface FoundationShellProps { readonly surface: "Web" | "Telegram"; readonly children?: ReactNode; }
export function FoundationShell({ surface, children }: FoundationShellProps) {
  return <main className="foundation-shell"><header><p className="eyebrow">{surface}</p><h1>HOOMA</h1></header><section className="shell-content">{children}</section></main>;
}
export function HomeGateway() {
  return (
    <>
      <style>{HOME_GATEWAY_TYPOGRAPHY}</style>
      <section>
        <HomeHero />
        <p className="eyebrow">YOUR FOOTBALL NEIGHBORHOOD</p>
        <h2 className="home-gateway-title">Find your people. Find the game.</h2>
        <HomeGatewayGrid />
      </section>
    </>
  );
}
