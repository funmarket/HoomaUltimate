import type { PublicPlaceSummary } from "@hooma/contracts/places";

export interface EventPlaceAccess {
  getPublic(placeId: string): Promise<PublicPlaceSummary>;
  isVerifiedOwner(placeId: string, userId: string): Promise<boolean>;
}
