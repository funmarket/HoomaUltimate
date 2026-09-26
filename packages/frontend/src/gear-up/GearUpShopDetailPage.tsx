import { useEffect, useMemo, useState } from "react";
import {
  GEAR_UP_PRODUCT_CATEGORY_LABELS,
  type GearUpPaymentMethod,
  type GearUpProduct,
  type PublicGearUpShop,
} from "@hooma/contracts/gear-up";
import { useHoomaFrontend } from "../context";
import { PlaceGallery } from "../places/PlaceGallery";
import { PhoneIcon, PinIcon } from "../ui/HoomaIcons";
import { createGearUpApi } from "./api";
import { GearUpProductPreviewCard } from "./GearUpProductPreviewCard";
import { GEAR_UP_SPORT_LABELS } from "./presentation";

const PAYMENT_LABELS: Record<GearUpPaymentMethod, string> = {
  CASH: "Cash",
  CRYPTO: "Crypto",
  CARD_BY_PHONE: "Card by phone",
};

function mapHref(shop: PublicGearUpShop): string {
  const place = shop.place;
  const query =
    place.latitude != null && place.longitude != null
      ? `${place.latitude},${place.longitude}`
      : [place.address, place.houma, place.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function provenanceLabel(shop: PublicGearUpShop): string {
  return shop.place.submissionOrigin === "OWNER" ? "By Owner" : "FanHub";
}

export function GearUpShopDetailPage({ placeId }: { readonly placeId: string }) {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createGearUpApi(transport), [transport]);
  const [shop, setShop] = useState<PublicGearUpShop | null>(null);
  const [products, setProducts] = useState<GearUpProduct[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([api.getShop(placeId), api.listShopProducts(placeId)])
      .then(async ([shopResult, productResult]) => {
        if (!active) return;
        setShop(shopResult);
        setProducts(productResult);

        const delivered = await Promise.all(
          productResult.map(async (product) => {
            if (!product.coverImageId) return [product.id, ""] as const;
            try {
              const image = await api.productImageDelivery(product.id, product.coverImageId);
              return [product.id, image.contentUrl] as const;
            } catch {
              return [product.id, ""] as const;
            }
          }),
        );
        if (active) {
          setImageUrls(
            Object.fromEntries(delivered.filter((entry) => Boolean(entry[1]))) as Record<
              string,
              string
            >,
          );
        }
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Unable to load Gear Up shop");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, placeId]);

  if (loading) return <p className="status">Loading Gear Up shop…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!shop) return <p className="error">Gear Up shop not found.</p>;

  const featuredProducts = products.filter((product) => product.featuredAt);
  const visibleProducts = featuredProducts.length ? featuredProducts : products;
  const location = [shop.place.houma, shop.place.city].filter(Boolean).join(" · ");
  const hasGallery = shop.place.images.length > 0 || Boolean(shop.place.imageUrl);

  return (
    <section className="gear-up-shop-detail">
      <a className="gear-up-shop-detail__back" href="/athletes/gear-up">
        ← Back to Gear Up
      </a>

      {hasGallery ? <PlaceGallery place={shop.place} /> : null}

      <header className="gear-up-shop-detail__hero">
        <div className="gear-up-shop-detail__heading">
          <p className="gear-up-shop-detail__eyebrow">{shop.offerTypes.join(" · ")}</p>
          <div className="gear-up-shop-detail__title-row">
            <h1>{shop.place.name}</h1>
            {shop.verifiedOwner ? <span>Verified Owner</span> : null}
          </div>
          <p className="gear-up-shop-detail__location">
            <PinIcon size={18} />
            {location || shop.place.address}
          </p>
          <div className="gear-up-shop-detail__tags">
            {shop.sports.map((sport) => (
              <span key={sport}>{GEAR_UP_SPORT_LABELS[sport]}</span>
            ))}
          </div>
          <p className="gear-up-shop-detail__source">{provenanceLabel(shop)}</p>
        </div>

        <div className="gear-up-shop-detail__actions">
          {shop.place.phone ? (
            <a href={`tel:${shop.place.phone}`}>
              <PhoneIcon size={18} />
              Call Shop
            </a>
          ) : null}
          <a href={mapHref(shop)} target="_blank" rel="noreferrer">
            Directions
          </a>
          {shop.place.websiteUrl ? (
            <a href={shop.place.websiteUrl} target="_blank" rel="noreferrer">
              Website
            </a>
          ) : null}
        </div>
      </header>

      {shop.paymentMethods.length ? (
        <section className="gear-up-shop-detail__section">
          <h2>Payment accepted</h2>
          <div className="gear-up-shop-detail__payment-list">
            {shop.paymentMethods.map((method) => (
              <span key={method}>{PAYMENT_LABELS[method]}</span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="gear-up-shop-detail__section">
        <h2>What you’ll find</h2>
        <div className="gear-up-shop-detail__tags">
          {shop.categories.map((category) => (
            <span key={category}>{GEAR_UP_PRODUCT_CATEGORY_LABELS[category]}</span>
          ))}
        </div>
      </section>

      <section className="gear-up-shop-detail__section">
        <div className="gear-up-shop-detail__section-heading">
          <h2>{featuredProducts.length ? "Featured Products" : "Products"}</h2>
        </div>

        {visibleProducts.length ? (
          <div className="gear-up-product-preview-rail">
            {visibleProducts.map((product) => (
              <GearUpProductPreviewCard
                key={product.id}
                product={product}
                imageUrl={imageUrls[product.id] ?? null}
              />
            ))}
          </div>
        ) : (
          <div className="gear-up-shop-detail__empty-products">
            <h3>This shop hasn’t added products yet.</h3>
            <p>
              Check back later for gear and sportswear, or contact the shop directly for more
              information.
            </p>
            <div>
              {shop.place.phone ? <a href={`tel:${shop.place.phone}`}>Call Shop</a> : null}
              <a href={mapHref(shop)} target="_blank" rel="noreferrer">
                Directions
              </a>
            </div>
          </div>
        )}
      </section>

      <section className="gear-up-shop-detail__section">
        <h2>About This Shop</h2>
        <p className="gear-up-shop-detail__description">
          {shop.place.description || "This Gear Up shop has not added a description yet."}
        </p>
        <p className="gear-up-shop-detail__address">{shop.place.address}</p>
      </section>
    </section>
  );
}
