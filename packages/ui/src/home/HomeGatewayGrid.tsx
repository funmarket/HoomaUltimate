import { HomeGatewayCard } from "./HomeGatewayCard.js";
import { HOME_GATEWAYS } from "./home-gateways.js";

const HOME_GATEWAY_STYLES = `
.home-gateway-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(6px, 1.2vw, 12px);
  margin-top: 24px;
}
.home-gateway-card {
  position: relative;
  display: block;
  min-width: 0;
  aspect-ratio: 10 / 13;
  padding: 0;
  border: 0;
  border-radius: clamp(10px, 1.6vw, 18px);
  background: #0b0b09;
  color: inherit;
  text-decoration: none;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
  transition: transform 140ms ease, filter 140ms ease;
}
.home-gateway-card:hover {
  transform: translateY(-2px);
  filter: brightness(1.04);
}
.home-gateway-card:active { transform: translateY(0); }
.home-gateway-card:focus-visible {
  outline: 2px solid #f3cf7a;
  outline-offset: 3px;
}
.home-gateway-card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.home-gateway-card__sr-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 480px) {
  .home-gateway-grid { gap: 5px; }
}
@media (prefers-reduced-motion: reduce) {
  .home-gateway-card { transition: none; }
}
`;

export function HomeGatewayGrid() {
  return (
    <>
      <style>{HOME_GATEWAY_STYLES}</style>
      <div className="home-gateway-grid" aria-label="HOOMA features">
        {HOME_GATEWAYS.map((item) => (
          <HomeGatewayCard item={item} key={item.id} />
        ))}
      </div>
    </>
  );
}
