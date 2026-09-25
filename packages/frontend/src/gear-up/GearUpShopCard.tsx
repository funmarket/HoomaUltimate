import type { AthletesSport } from "@hooma/contracts/athletes";
import { GEAR_UP_PRODUCT_CATEGORY_LABELS, type PublicGearUpShop } from "@hooma/contracts/gear-up";
import { PinIcon } from "../ui/HoomaIcons";

const SPORT_LABELS: Readonly<Record<AthletesSport, string>> = {
  CYCLING: "Cycling",
  RUNNING: "Running",
  SWIMMING: "Swimming",
  FOOTBALL: "Football",
  BASKETBALL: "Basketball",
  TENNIS: "Tennis",
  PADEL: "Padel",
  GYM_FITNESS: "Gym & Fitness",
  OTHER: "Other",
};

function locationLabel(shop: PublicGearUpShop): string {
  return [shop.place.houma, shop.place.city].filter(Boolean).join(" · ") || shop.place.address;
}

function sourceLabel(shop: PublicGearUpShop): string {
  return shop.place.submissionOrigin === "OWNER"
    ? "By Owner"
    : "FanHub — Added by the HOOMA community";
}

export function GearUpShopCard({ shop }: { readonly shop: PublicGearUpShop }) {
  const tags = [
    ...shop.sports.map((sport) => SPORT_LABELS[sport]),
    ...shop.categories.map((category) => GEAR_UP_PRODUCT_CATEGORY_LABELS[category]),
  ].slice(0, 4);

  return (
    <article className="gear-up-shop-card">
      <div className="gear-up-shop-card__media">
        {shop.place.imageUrl ? (
          <img src={shop.place.imageUrl} alt="" />
        ) : (
          <span className="gear-up-shop-card__placeholder">HOOMA</span>
        )}
        {shop.verifiedOwner ? (
          <span className="gear-up-shop-card__verified">Verified Owner</span>
        ) : null}
      </div>

      <div className="gear-up-shop-card__body">
        <div className="gear-up-shop-card__heading">
          <div>
            <p className="gear-up-shop-card__eyebrow">SPORT SHOP</p>
            <h2>{shop.place.name}</h2>
          </div>
          <p className="gear-up-shop-card__location">
            <PinIcon size={18} />
            <span>{locationLabel(shop)}</span>
          </p>
        </div>

        {tags.length ? (
          <div className="gear-up-shop-card__tags" aria-label="Sports and categories">
            {tags.map((tag, index) => (
              <span key={`${tag}:${index}`}>{tag}</span>
            ))}
          </div>
        ) : null}

        {shop.place.description ? (
          <p className="gear-up-shop-card__description">{shop.place.description}</p>
        ) : null}

        <div className="gear-up-shop-card__source">
          <span>{sourceLabel(shop)}</span>
        </div>
      </div>
    </article>
  );
}
