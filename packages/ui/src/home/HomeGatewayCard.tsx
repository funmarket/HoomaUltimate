import type { HomeGatewayItem } from "./home-gateways.js";

export interface HomeGatewayCardProps {
  readonly item: HomeGatewayItem;
}

export function HomeGatewayCard({ item }: HomeGatewayCardProps) {
  return (
    <a className="home-gateway-card" href={item.href} aria-label={item.label} data-gateway={item.id}>
      <img
        className="home-gateway-card__image"
        src={item.artwork}
        alt=""
        width={500}
        height={650}
        loading="eager"
        decoding="sync"
      />
      <span className="home-gateway-card__sr-label">{item.label}</span>
    </a>
  );
}
