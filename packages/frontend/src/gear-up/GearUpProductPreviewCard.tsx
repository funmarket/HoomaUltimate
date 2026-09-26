import {
  GEAR_UP_PRODUCT_CATEGORY_LABELS,
  type GearUpProduct,
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
}: {
  readonly product: GearUpProduct;
  readonly imageUrl: string | null;
}) {
  return (
    <article className="gear-up-product-preview">
      <div className="gear-up-product-preview__media">
        {imageUrl ? <img src={imageUrl} alt="" /> : <span>HOOMA</span>}
        {product.featuredAt ? <strong className="gear-up-product-preview__featured">Featured</strong> : null}
      </div>
      <div className="gear-up-product-preview__body">
        {product.brand ? <p className="gear-up-product-preview__brand">{product.brand}</p> : null}
        <h3>{product.title}</h3>
        <div className="gear-up-product-preview__meta">
          {product.sports.slice(0, 2).map((sport) => (
            <span key={sport}>{GEAR_UP_SPORT_LABELS[sport]}</span>
          ))}
          <span>{GEAR_UP_PRODUCT_CATEGORY_LABELS[product.category]}</span>
        </div>
        <strong className="gear-up-product-preview__price">{priceLabel(product)}</strong>
      </div>
    </article>
  );
}
