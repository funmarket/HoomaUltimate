import { HomeGatewayCard } from "./HomeGatewayCard.js";
import { HOME_GATEWAYS } from "./home-gateways.js";

const HOME_GATEWAY_STYLES = `
.home-gateway-section-label {
  margin: 24px 0 0;
  color: var(--hooma-accent, #c8e63a);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
}
.home-gateway-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(6px, 1.2vw, 12px);
  margin-top: 10px;
}
.home-gateway-card {
  position: relative;
  display: block;
  min-width: 0;
  width: 100%;
  aspect-ratio: 10 / 13;
  padding: 0;
  border: 0;
  border-radius: clamp(10px, 1.6vw, 18px);
  background: #0b0b09;
  color: inherit;
  font: inherit;
  text-decoration: none;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
  transition: transform 140ms ease, filter 140ms ease;
}
.home-gateway-card:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.04);
}
.home-gateway-card:active:not(:disabled) { transform: translateY(0); }
.home-gateway-card:focus-visible {
  outline: 2px solid #f3cf7a;
  outline-offset: 3px;
}
.home-gateway-card--disabled {
  cursor: not-allowed;
  opacity: .78;
}
.home-gateway-card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.home-gateway-card__title,
.home-gateway-card__subtitle {
  position: absolute;
  left: 50%;
  z-index: 1;
  width: calc(100% - 12px);
  margin: 0;
  text-align: center;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.home-gateway-card__title {
  top: 58.5%;
  color: #fff;
  font-size: clamp(12px, 2.2vw, 18px);
  font-weight: 800;
  line-height: 1.05;
  text-shadow: 0 2px 8px rgba(0, 0, 0, .8);
}
.home-gateway-card__subtitle {
  top: 80.5%;
  color: var(--hooma-accent, #c8e63a);
  font-size: clamp(10px, 1.8vw, 15px);
  font-weight: 700;
  line-height: 1.1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, .85);
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
      <p className="home-gateway-section-label">Quick actions</p>
      <div className="home-gateway-grid" aria-label="HOOMA features">
        {HOME_GATEWAYS.map((item) => (
          <HomeGatewayCard item={item} key={item.id} />
        ))}
      </div>
    </>
  );
}
