export interface EventPlaceAccess {
  getPublic(placeId: string): Promise<unknown>;
  isVerifiedOwner(placeId: string, userId: string): Promise<boolean>;
}
