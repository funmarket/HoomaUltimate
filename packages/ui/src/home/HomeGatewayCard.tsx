import type { MouseEvent } from "react";
import type { HomeGatewayItem } from "./home-gateways.js";

export interface HomeGatewayCardProps {
  readonly item: HomeGatewayItem;
  readonly onNavigate?: (href: string) => void;
}

function GatewayContent({ item }: HomeGatewayCardProps) {
  return (
    <>
      <img
        className="home-gateway-card__image"
        src={item.artwork}
        alt=""
        width={500}
        height={650}
        loading="lazy"
        decoding="async"
      />
      <span className="home-gateway-card__title">{item.label}</span>
      <span className="home-gateway-card__subtitle">{item.subtitle}</span>
    </>
  );
}

export function HomeGatewayCard({ item, onNavigate }: HomeGatewayCardProps) {
  if (item.availability === "coming-soon" || !item.href) {
    return (
      <button
        className="home-gateway-card home-gateway-card--disabled"
        type="button"
        disabled
        aria-label={`${item.label}: ${item.subtitle}`}
        data-gateway={item.id}
      >
        <GatewayContent item={item} />
      </button>
    );
  }

  return (
    <a
      className="home-gateway-card"
      href={item.href}
      aria-label={item.label}
      data-gateway={item.id}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (
          !onNavigate ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (event.currentTarget.target && event.currentTarget.target !== "_self")
        )
          return;
        event.preventDefault();
        onNavigate(item.href!);
      }}
    >
      <GatewayContent item={item} />
    </a>
  );
}
