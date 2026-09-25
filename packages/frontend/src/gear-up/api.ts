import type { GearUpListQueryInput, PublicGearUpShop } from "@hooma/contracts/gear-up";
import { request, type HoomaTransport } from "../http";

export type GearUpPublicListFilters = Partial<GearUpListQueryInput>;

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
      request<PublicGearUpShop[]>(
        transport,
        `/api/public/v1/gear-up${queryString(input)}`,
      ),
  };
}
