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
  min-width: 0;
  aspect-ratio: 3 / 4.45;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto;
  align-items: center;
  justify-items: center;
  gap: clamp(5px, 1vw, 10px);
  padding: clamp(8px, 1.4vw, 16px) clamp(5px, 1.1vw, 12px) clamp(10px, 1.4vw, 16px);
  border: 2px solid transparent;
  border-radius: clamp(12px, 2vw, 20px);
  background:
    linear-gradient(160deg, #090909 0%, #11110f 52%, #070707 100%) padding-box,
    linear-gradient(135deg, #fff2c7 0%, #b86f25 9%, #f2c36d 18%, #7a4218 31%, #f7d58e 48%, #8a4b1d 63%, #e7a64d 78%, #fff0bd 91%, #9a5b23 100%) border-box;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.13),
    inset 0 0 24px rgba(255, 255, 255, 0.025),
    0 8px 22px rgba(0, 0, 0, 0.28);
  color: #f5e5c0;
  text-decoration: none;
  overflow: hidden;
  isolation: isolate;
  -webkit-tap-highlight-color: transparent;
  transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;
}
.home-gateway-card::after {
  content: "";
  position: absolute;
  inset: 5px;
  z-index: -1;
  border: 1px solid rgba(230, 224, 210, 0.22);
  border-radius: calc(clamp(12px, 2vw, 20px) - 5px);
  pointer-events: none;
}
.home-gateway-card:hover {
  transform: translateY(-2px);
  filter: brightness(1.04);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.16),
    inset 0 0 26px rgba(255, 255, 255, 0.035),
    0 11px 28px rgba(0, 0, 0, 0.34);
}
.home-gateway-card:active { transform: translateY(0); }
.home-gateway-card:focus-visible {
  outline: 3px solid #f3ddad;
  outline-offset: 3px;
}
.home-gateway-card__artwork {
  width: 100%;
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.home-gateway-card__artwork img {
  display: block;
  width: min(92%, 180px);
  max-height: 100%;
  object-fit: contain;
  object-position: center;
  mix-blend-mode: screen;
}
.home-gateway-card__divider {
  width: 82%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: clamp(4px, .7vw, 8px);
  color: #f1c46e;
  font-size: 17px;
  line-height: 1;
}
.home-gateway-card__divider::before,
.home-gateway-card__divider::after {
  content: "";
  height: 1px;
  background: linear-gradient(90deg, transparent, #8e541f 18%, #f6d17f 78%, #7c4317);
}
.home-gateway-card__divider::after { transform: scaleX(-1); }
.home-gateway-card__label {
  max-width: 100%;
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(17px, 1.9vw, 22px);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.012em;
  text-align: center;
  color: #f6e4bd;
  text-shadow: 0 1px 0 #4c2a0d, 0 0 12px rgba(229, 169, 75, 0.08);
}
@media (max-width: 480px) {
  .home-gateway-grid { gap: 6px; }
  .home-gateway-card {
    border-width: 1.5px;
    padding: 7px 4px 9px;
    gap: 5px;
  }
  .home-gateway-card::after { inset: 3px; }
  .home-gateway-card__artwork img { width: 96%; }
  .home-gateway-card__divider { width: 86%; gap: 3px; }
  .home-gateway-card__label { font-size: 17px; }
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
        {HOME_GATEWAYS.map((item) => <HomeGatewayCard item={item} key={item.id} />)}
      </div>
    </>
  );
}
