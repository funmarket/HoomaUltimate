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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(7px, 1.8vw, 14px);
  width: 100%;
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
  border-radius: clamp(10px, 2vw, 18px);
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
  font-size: clamp(12px, 3.2vw, 19px);
  font-weight: 800;
  line-height: 1.05;
  text-shadow: 0 2px 8px rgba(0, 0, 0, .8);
}
.home-gateway-card__subtitle {
  top: 80.5%;
  color: var(--hooma-accent, #c8e63a);
  font-size: clamp(9px, 2.45vw, 15px);
  font-weight: 700;
  line-height: 1.1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, .85);
}
@media (max-width: 430px) {
  .home-gateway-grid { gap: 6px; }
  .home-gateway-card__title { width: calc(100% - 8px); }
  .home-gateway-card__subtitle { width: calc(100% - 8px); }
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
