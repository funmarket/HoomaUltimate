import { useEffect, useMemo, useState } from "react";
import {
  GEAR_UP_PRODUCT_CATEGORY_LABELS,
  type GearUpProduct,
  type PublicGearUpShop,
} from "@hooma/contracts/gear-up";
import { useHoomaFrontend } from "../context";
import { createGearUpApi } from "./api";
import { GEAR_UP_SPORT_LABELS } from "./presentation";

function priceLabel(product: GearUpProduct): string {
  if (product.price == null) return "Ask shop for current price";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: product.currency,
    maximumFractionDigits: 2,
  }).format(product.price);
}

export function GearUpProductDetailPage({
  productId,
}: {
  readonly productId: string;
}) {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createGearUpApi(transport), [transport]);
  const [product, setProduct] = useState<GearUpProduct | null>(null);
  const [shop, setShop] = useState<PublicGearUpShop | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setActiveImage(0);

    void api
      .getProduct(productId)
      .then(async (productResult) => {
        const [shopResult, images] = await Promise.all([
          api.getShop(productResult.shopPlaceId),
          api.listProductImages(productResult.id),
        ]);
        const deliveries = await Promise.all(
          images.map(async (image) => {
            try {
              return (await api.productImageDelivery(productResult.id, image.id)).contentUrl;
            } catch {
              return "";
            }
          }),
        );
        if (!active) return;
        setProduct(productResult);
        setShop(shopResult);
        setImageUrls(deliveries.filter(Boolean));
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unable to load Gear Up product");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [api, productId]);

  if (loading) return <p className="status">Loading product…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!product || !shop) return <p className="error">Gear Up product not found.</p>;

  const location = [shop.place.houma, shop.place.city].filter(Boolean).join(" · ");

  return (
    <section className="gear-up-product-detail">
      <a className="gear-up-shop-detail__back" href="/gear-up">
        ← Back to Products
      </a>

      <div className="gear-up-product-detail__layout">
        <section className="gear-up-product-detail__media" aria-label={`${product.title} photos`}>
          <div className="gear-up-product-detail__image">
            {imageUrls[activeImage] ? (
              <img src={imageUrls[activeImage]} alt={product.title} />
            ) : (
              <span>HOOMA</span>
            )}
            {product.featuredAt ? <strong>Featured</strong> : null}
          </div>
          {imageUrls.length > 1 ? (
            <div className="gear-up-product-detail__thumbs">
              {imageUrls.map((url, index) => (
                <button
                  type="button"
                  key={url}
                  className={index === activeImage ? "is-active" : ""}
                  aria-label={`Show product photo ${index + 1}`}
                  onClick={() => setActiveImage(index)}
                >
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="gear-up-product-detail__info">
          <div className="gear-up-product-detail__shop">
            <strong>{shop.place.name}</strong>
            <span>{location || shop.place.address}</span>
          </div>

          {product.brand ? <p className="gear-up-product-detail__brand">{product.brand}</p> : null}
          <h1>{product.title}</h1>
          <strong className="gear-up-product-detail__price">{priceLabel(product)}</strong>

          <div className="gear-up-product-detail__tags">
            {product.sports.map((sport) => (
              <span key={sport}>{GEAR_UP_SPORT_LABELS[sport]}</span>
            ))}
            <span>{GEAR_UP_PRODUCT_CATEGORY_LABELS[product.category]}</span>
          </div>

          <p className="gear-up-product-detail__description">{product.description}</p>

          <div className="gear-up-product-detail__actions">
            <a href={`/gear-up/shops/${shop.place.id}`}>View Shop</a>
            {shop.place.phone ? <a href={`tel:${shop.place.phone}`}>Call Shop</a> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
