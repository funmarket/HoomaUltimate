import type {
  GearUpListQueryInput,
  GearUpProduct,
  GearUpProductDiscoveryPage,
  GearUpProductDiscoveryQueryInput,
  GearUpProductImage,
  GearUpProductImageDelivery,
  PublicGearUpShop,
} from "@hooma/contracts/gear-up";
import { request, type HoomaTransport } from "../http";

export type GearUpPublicListFilters = Partial<GearUpListQueryInput>;
export type GearUpPublicProductFilters = Partial<GearUpProductDiscoveryQueryInput>;

function productQueryString(input: GearUpPublicProductFilters): string {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.offer) params.set("offer", input.offer);
  if (input.sport) params.set("sport", input.sport);
  if (input.category) params.set("category", input.category);
  if (input.city) params.set("city", input.city);
  if (input.houma) params.set("houma", input.houma);
  if (input.featured !== undefined) params.set("featured", String(input.featured));
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.limit !== undefined) params.set("limit", String(input.limit));
  const value = params.toString();
  return value ? `?${value}` : "";
}

function queryString(input: GearUpPublicListFilters): string {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.source) params.set("source", input.source);
  if (input.offer) params.set("offer", input.offer);
  if (input.sport) params.set("sport", input.sport);
  if (input.category) params.set("category", input.category);
  if (input.city) params.set("city", input.city);
  if (input.houma) params.set("houma", input.houma);
  if (input.limit !== undefined) params.set("limit", String(input.limit));
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function createGearUpApi(transport: HoomaTransport) {
  return {
    listShops: (input: GearUpPublicListFilters = {}) =>
      request<PublicGearUpShop[]>(transport, `/api/public/v1/gear-up${queryString(input)}`),
    getShop: (placeId: string) =>
      request<PublicGearUpShop>(
        transport,
        `/api/public/v1/gear-up/shops/${encodeURIComponent(placeId)}`,
      ),
    listShopProducts: (placeId: string) =>
      request<GearUpProduct[]>(
        transport,
        `/api/public/v1/gear-up/shops/${encodeURIComponent(placeId)}/products`,
      ),
    listProducts: (input: GearUpPublicProductFilters = {}) =>
      request<GearUpProductDiscoveryPage>(
        transport,
        `/api/public/v1/gear-up/products${productQueryString(input)}`,
      ),
    getProduct: (productId: string) =>
      request<GearUpProduct>(
        transport,
        `/api/public/v1/gear-up/products/${encodeURIComponent(productId)}`,
      ),
    listProductImages: (productId: string) =>
      request<GearUpProductImage[]>(
        transport,
        `/api/public/v1/gear-up/products/${encodeURIComponent(productId)}/images`,
      ),
    productImageDelivery: (productId: string, imageId: string) =>
      request<GearUpProductImageDelivery>(
        transport,
        `/api/public/v1/gear-up/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}/delivery`,
      ),
  };
}
