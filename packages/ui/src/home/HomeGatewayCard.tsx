import type { HomeGatewayItem } from "./home-gateways.js";

export interface HomeGatewayCardProps {
  readonly item: HomeGatewayItem;
}

export function HomeGatewayCard({ item }: HomeGatewayCardProps) {
  return (
    <a className="home-gateway-card" href={item.href} aria-label={item.label} data-gateway={item.id}>
      <span className="home-gateway-card__artwork" aria-hidden="true">
        <img src={item.artwork} alt="" loading="eager" decoding="async" />
      </span>
      <span className="home-gateway-card__divider" aria-hidden="true"><span>✦</span></span>
      <span className="home-gateway-card__label">{item.label}</span>
    </a>
  );
}
