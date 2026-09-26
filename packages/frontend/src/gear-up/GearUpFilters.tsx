import { ATHLETES_SPORTS, type AthletesSport } from "@hooma/contracts/athletes";
import {
  GEAR_UP_GEAR_CATEGORIES,
  GEAR_UP_PRODUCT_CATEGORIES,
  GEAR_UP_PRODUCT_CATEGORY_LABELS,
  GEAR_UP_SPORTSWEAR_CATEGORIES,
  type GearUpOfferType,
  type GearUpProductCategory,
} from "@hooma/contracts/gear-up";
import type { PlaceSubmissionOrigin } from "@hooma/contracts/places";
import { GEAR_UP_SPORT_LABELS } from "./presentation";

export interface GearUpDiscoveryFilters {
  readonly query: string;
  readonly source: PlaceSubmissionOrigin | null;
  readonly offer: GearUpOfferType | null;
  readonly sport: AthletesSport | null;
  readonly category: GearUpProductCategory | null;
  readonly city: string;
  readonly houma: string;
}

function categoriesForOffer(offer: GearUpOfferType | null): readonly GearUpProductCategory[] {
  if (offer === "SPORTSWEAR") return GEAR_UP_SPORTSWEAR_CATEGORIES;
  if (offer === "GEAR") return GEAR_UP_GEAR_CATEGORIES;
  return GEAR_UP_PRODUCT_CATEGORIES;
}

function offerLabel(offer: GearUpOfferType | null): string {
  if (offer === "SPORTSWEAR") return "Sportswear";
  if (offer === "GEAR") return "Gear";
  return "All";
}

function chipClass(selected: boolean): string {
  return selected ? "gear-up-chip is-active" : "gear-up-chip";
}

export function GearUpFilters({
  value,
  cities,
  houmas,
  onChange,
}: {
  readonly value: GearUpDiscoveryFilters;
  readonly cities: readonly string[];
  readonly houmas: readonly string[];
  readonly onChange: (next: GearUpDiscoveryFilters) => void;
}) {
  const categories = categoriesForOffer(value.offer);

  function setOffer(offer: GearUpOfferType) {
    const nextOffer = value.offer === offer ? null : offer;
    onChange({ ...value, offer: nextOffer, category: null });
  }

  return (
    <section className="gear-up-filters" aria-label="Gear Up filters">
      <div className="gear-up-filter-pair">
        <fieldset className="gear-up-filter-group">
          <legend>What am I looking for?</legend>
          <div className="gear-up-filter-row">
            <button
              type="button"
              className={chipClass(value.offer === "SPORTSWEAR")}
              aria-pressed={value.offer === "SPORTSWEAR"}
              onClick={() => setOffer("SPORTSWEAR")}
            >
              Sportswear
            </button>
            <button
              type="button"
              className={chipClass(value.offer === "GEAR")}
              aria-pressed={value.offer === "GEAR"}
              onClick={() => setOffer("GEAR")}
            >
              Gear
            </button>
          </div>
        </fieldset>

        <fieldset className="gear-up-filter-group">
          <legend>Who added the place?</legend>
          <div className="gear-up-filter-row">
            <button
              type="button"
              className={chipClass(value.source === "OWNER")}
              aria-pressed={value.source === "OWNER"}
              onClick={() =>
                onChange({ ...value, source: value.source === "OWNER" ? null : "OWNER" })
              }
            >
              By Owner
            </button>
            <button
              type="button"
              className={chipClass(value.source === "FANHUB")}
              aria-pressed={value.source === "FANHUB"}
              onClick={() =>
                onChange({ ...value, source: value.source === "FANHUB" ? null : "FANHUB" })
              }
            >
              FanHub
            </button>
          </div>
        </fieldset>
      </div>

      <label className="gear-up-search">
        <span className="gear-up-visually-hidden">Search Gear Up</span>
        <input
          value={value.query}
          onChange={(event) => onChange({ ...value, query: event.target.value })}
          placeholder="Search Gear Up"
        />
      </label>

      <div className="gear-up-location-filters">
        <label>
          <span>City</span>
          <select
            value={value.city}
            onChange={(event) => onChange({ ...value, city: event.target.value, houma: "" })}
          >
            <option value="">All cities</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Houma</span>
          <select
            value={value.houma}
            onChange={(event) => onChange({ ...value, houma: event.target.value })}
          >
            <option value="">All Houmas</option>
            {houmas.map((houma) => (
              <option key={houma} value={houma}>
                {houma}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="gear-up-filter-group">
        <legend>Sport</legend>
        <div className="gear-up-filter-rail">
          {ATHLETES_SPORTS.map((sport) => (
            <button
              type="button"
              key={sport}
              className={chipClass(value.sport === sport)}
              aria-pressed={value.sport === sport}
              onClick={() => onChange({ ...value, sport: value.sport === sport ? null : sport })}
            >
              {GEAR_UP_SPORT_LABELS[sport]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="gear-up-filter-group">
        <legend>Category · {offerLabel(value.offer)}</legend>
        <div className="gear-up-filter-rail">
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              className={chipClass(value.category === category)}
              aria-pressed={value.category === category}
              onClick={() =>
                onChange({
                  ...value,
                  category: value.category === category ? null : category,
                })
              }
            >
              {GEAR_UP_PRODUCT_CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
