import type { ReactNode } from "react";

export const PRIMARY_NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Play", href: "/play" },
  { label: "Watch", href: "/watch" },
  { label: "HOOMA", href: "/hooma" },
  { label: "Pitch", href: "/pitch" }
] as const;

export const HOME_GATEWAYS = [
  { label: "HOOMA", href: "/hooma" },
  { label: "Teams", href: "/teams" },
  { label: "Ultras", href: "/ultras" },
  { label: "Gamers", href: "/gamers" },
  { label: "Places", href: "/places" },
  { label: "Requests", href: "/requests" },
  { label: "Ride", href: "/rides" },
  { label: "FundMe", href: "/fundme" }
] as const;

export interface FoundationShellProps { readonly surface: "Web" | "Telegram"; readonly children?: ReactNode; }
export function FoundationShell({ surface, children }: FoundationShellProps) {
  return <main className="foundation-shell"><header><p className="eyebrow">{surface}</p><h1>HOOMA</h1></header><section className="shell-content">{children}</section><nav aria-label="Primary">{PRIMARY_NAV_ITEMS.map((item) => <a key={item.label} href={item.href}>{item.label}</a>)}</nav></main>;
}
export function HomeGateway() {
  return <section><p className="eyebrow">YOUR FOOTBALL NEIGHBORHOOD</p><h2>Find your people. Find the game.</h2><div className="home-gateway" aria-label="HOOMA features">{HOME_GATEWAYS.map((item) => <a className="gateway-card" href={item.href} key={item.label}>{item.label}</a>)}</div></section>;
}
