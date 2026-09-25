import { useEffect, useMemo, useState } from "react";
import type { PublicGearUpShop } from "@hooma/contracts/gear-up";
import { useHoomaFrontend } from "../context";
import { WatchSectionNavigation } from "../watch/WatchSectionNavigation";
import { createGearUpApi } from "./api";
import { GearUpFilters, type GearUpDiscoveryFilters } from "./GearUpFilters";
import { GearUpShopCard } from "./GearUpShopCard";

const INITIAL_FILTERS: GearUpDiscoveryFilters = {
  query: "",
  source: "OWNER",
  offer: "SPORTSWEAR",
  sport: null,
  category: null,
  city: "",
  houma: "",
};

const CLEARED_FILTERS: GearUpDiscoveryFilters = {
  query: "",
  source: null,
  offer: null,
  sport: null,
  category: null,
  city: "",
  houma: "",
};

export function GearUpPage() {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createGearUpApi(transport), [transport]);
  const [filters, setFilters] = useState<GearUpDiscoveryFilters>(INITIAL_FILTERS);
  const [optionSeed, setOptionSeed] = useState<PublicGearUpShop[]>([]);
  const [shops, setShops] = useState<PublicGearUpShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void api
      .listShops({ limit: 100 })
      .then((items) => {
        if (active) setOptionSeed(items);
      })
      .catch(() => {
        if (active) setOptionSeed([]);
      });
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void api
        .listShops({
          ...(filters.query.trim() ? { q: filters.query.trim() } : {}),
          ...(filters.source ? { source: filters.source } : {}),
          ...(filters.offer ? { offer: filters.offer } : {}),
          ...(filters.sport ? { sport: filters.sport } : {}),
          ...(filters.category ? { category: filters.category } : {}),
          ...(filters.city ? { city: filters.city } : {}),
          ...(filters.houma ? { houma: filters.houma } : {}),
          limit: 100,
        })
        .then((items) => {
          if (active) setShops(items);
        })
        .catch((reason) => {
          if (!active) return;
          setShops([]);
          setError(reason instanceof Error ? reason.message : "Unable to load Gear Up shops");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [api, filters]);

  const cities = useMemo(
    () =>
      [
        ...new Set(
          optionSeed
            .map((shop) => shop.place.city)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [optionSeed],
  );

  const houmas = useMemo(
    () =>
      [
        ...new Set(
          optionSeed
            .filter((shop) => !filters.city || shop.place.city === filters.city)
            .map((shop) => shop.place.houma)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [filters.city, optionSeed],
  );

  return (
    <section className="gear-up-page">
      <header className="gear-up-hero">
        <p className="gear-up-hero__eyebrow">GEAR UP</p>
        <h1 className="gear-up-page__title">Discover sports shops near you.</h1>
        <p className="gear-up-hero__description">
          Find sportswear, gear and more from local shops. Support real places in your community.
        </p>
      </header>

      <WatchSectionNavigation active="gear-up" />

      <GearUpFilters value={filters} cities={cities} houmas={houmas} onChange={setFilters} />

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="status">Loading Gear Up shops…</p> : null}

      {!loading && !error && shops.length ? (
        <section className="gear-up-results" aria-label="Gear Up shops">
          <div className="gear-up-results__heading">
            <h2>Shops</h2>
            <span>{shops.length} found</span>
          </div>
          <div className="gear-up-shop-list">
            {shops.map((shop) => (
              <GearUpShopCard key={shop.place.id} shop={shop} />
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error && !shops.length ? (
        <section className="gear-up-empty-state">
          <div className="gear-up-empty-state__mark" aria-hidden="true">
            GU
          </div>
          <h2>No Gear Up shops match these filters.</h2>
          <p>Try clearing filters to see more sports shops in HOOMA.</p>
          <button type="button" onClick={() => setFilters(CLEARED_FILTERS)}>
            Clear filters
          </button>
        </section>
      ) : null}
    </section>
  );
}
