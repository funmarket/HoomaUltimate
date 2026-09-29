import type { PublicPlaceSummary } from "@hooma/contracts/places";

export interface PitchPlaceAccess {
  getPublic(placeId: string): Promise<PublicPlaceSummary>;
  isVerifiedOwner(placeId: string, userId: string): Promise<boolean>;
}
