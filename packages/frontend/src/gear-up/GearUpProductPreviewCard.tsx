import {
  GEAR_UP_PRODUCT_CATEGORY_LABELS,
  type GearUpProduct,
  type GearUpProductShopContext,
} from "@hooma/contracts/gear-up";
import { GEAR_UP_SPORT_LABELS } from "./presentation";

function priceLabel(product: GearUpProduct): string {
  if (product.price == null) return "Ask shop for current price";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: product.currency,
    maximumFractionDigits: 2,
  }).format(product.price);
}

export function GearUpProductPreviewCard({
  product,
  imageUrl,
  shop,
  productHref,
  shopHref,
}: {
  readonly product: GearUpProduct;
  readonly imageUrl: string | null;
  readonly shop?: GearUpProductShopContext;
  readonly productHref?: string;
  readonly shopHref?: string;
}) {
  return (
    <article className="gear-up-product-preview">
      <div className="gear-up-product-preview__media">
        {imageUrl ? <img src={imageUrl} alt="" /> : <span>HOOMA</span>}
        {product.featuredAt ? (
          <strong className="gear-up-product-preview__featured">Featured</strong>
        ) : null}
      </div>
      <div className="gear-up-product-preview__body">
        {shop ? (
          <div className="gear-up-product-preview__shop">
            <strong>{shop.name}</strong>
            <span>{[shop.houma, shop.city].filter(Boolean).join(" · ") || shop.address}</span>
          </div>
        ) : null}
        {product.brand ? <p className="gear-up-product-preview__brand">{product.brand}</p> : null}
        <h3>{product.title}</h3>
        <div className="gear-up-product-preview__meta">
          {product.sports.slice(0, 2).map((sport) => (
            <span key={sport}>{GEAR_UP_SPORT_LABELS[sport]}</span>
          ))}
          <span>{GEAR_UP_PRODUCT_CATEGORY_LABELS[product.category]}</span>
        </div>
        <strong className="gear-up-product-preview__price">{priceLabel(product)}</strong>
        {productHref || shopHref ? (
          <div className="gear-up-product-preview__actions">
            {productHref ? <a href={productHref}>View Product</a> : null}
            {shopHref ? <a href={shopHref}>View Shop</a> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
