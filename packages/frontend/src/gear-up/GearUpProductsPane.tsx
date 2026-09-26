import { useEffect, useMemo, useState } from "react";
import type { PublicGearUpProductListing } from "@hooma/contracts/gear-up";
import { useHoomaFrontend } from "../context";
import { createGearUpApi } from "./api";
import {
  GearUpProductFilters,
  type GearUpProductDiscoveryFilters,
} from "./GearUpProductFilters";
import { GearUpProductPreviewCard } from "./GearUpProductPreviewCard";

const INITIAL_FILTERS: GearUpProductDiscoveryFilters = {
  query: "",
  offer: null,
  sport: null,
  category: null,
  city: "",
  houma: "",
  featured: false,
};

const PAGE_SIZE = 24;

export function GearUpProductsPane({
  cities,
  houmas,
}: {
  readonly cities: readonly string[];
  readonly houmas: readonly string[];
}) {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createGearUpApi(transport), [transport]);
  const [filters, setFilters] = useState<GearUpProductDiscoveryFilters>(INITIAL_FILTERS);
  const [items, setItems] = useState<PublicGearUpProductListing[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const visibleHoumas = useMemo(() => houmas, [houmas]);

  async function hydrateImages(products: readonly PublicGearUpProductListing[]) {
    const entries = await Promise.all(
      products.map(async (product) => {
        if (!product.coverImageId) return [product.id, ""] as const;
        try {
          const image = await api.productImageDelivery(product.id, product.coverImageId);
          return [product.id, image.contentUrl] as const;
        } catch {
          return [product.id, ""] as const;
        }
      }),
    );
    setImageUrls((current) => ({
      ...current,
      ...Object.fromEntries(entries.filter((entry) => Boolean(entry[1]))),
    }));
  }

  function query(cursor?: string) {
    return {
      ...(filters.query.trim() ? { q: filters.query.trim() } : {}),
      ...(filters.offer ? { offer: filters.offer } : {}),
      ...(filters.sport ? { sport: filters.sport } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.city ? { city: filters.city } : {}),
      ...(filters.houma ? { houma: filters.houma } : {}),
      ...(filters.featured ? { featured: true } : {}),
      ...(cursor ? { cursor } : {}),
      limit: PAGE_SIZE,
    };
  }

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void api
        .listProducts(query())
        .then((page) => {
          if (!active) return;
          setItems([...page.items]);
          setNextCursor(page.nextCursor);
          setImageUrls({});
          void hydrateImages(page.items);
        })
        .catch((reason) => {
          if (!active) return;
          setItems([]);
          setNextCursor(null);
          setError(reason instanceof Error ? reason.message : "Unable to load Gear Up products");
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

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const page = await api.listProducts(query(nextCursor));
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      await hydrateImages(page.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load more products");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="gear-up-products-pane">
      <GearUpProductFilters
        value={filters}
        cities={cities}
        houmas={visibleHoumas}
        onChange={setFilters}
      />

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="status">Loading products…</p> : null}

      {!loading && !error && items.length ? (
        <section className="gear-up-results" aria-label="Gear Up products">
          <div className="gear-up-results__heading">
            <h2>Products</h2>
            <span>{items.length} shown</span>
          </div>
          <div className="gear-up-product-grid">
            {items.map((product) => (
              <GearUpProductPreviewCard
                key={product.id}
                product={product}
                imageUrl={imageUrls[product.id] ?? null}
                shop={product.shop}
                productHref={`/gear-up/products/${product.id}`}
                shopHref={`/gear-up/shops/${product.shop.placeId}`}
              />
            ))}
          </div>
          {nextCursor ? (
            <button
              type="button"
              className="gear-up-products-pane__load-more"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Loading…" : "Load more products"}
            </button>
          ) : null}
        </section>
      ) : null}

      {!loading && !error && !items.length ? (
        <section className="gear-up-empty-state">
          <div className="gear-up-empty-state__mark" aria-hidden="true">
            GU
          </div>
          <h2>No products match these filters yet.</h2>
          <p>Try adjusting your search, sport, category or location filters.</p>
          <div className="gear-up-empty-state__actions">
            <button type="button" onClick={() => setFilters(INITIAL_FILTERS)}>
              Clear filters
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
