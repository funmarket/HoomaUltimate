export interface GearUpPlaceAccess {
  canManage(placeId: string, userId: string): Promise<boolean>;
  isVerifiedOwner(placeId: string, userId: string): Promise<boolean>;
}
