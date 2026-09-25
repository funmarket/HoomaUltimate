import type {
  GearUpProduct,
  GearUpProductCreateInput,
  GearUpProductUpdateInput,
} from "@hooma/contracts/gear-up";

export interface GearUpProductRepository {
  listPublicByShop(placeId: string): Promise<readonly GearUpProduct[]>;
  getPublic(productId: string): Promise<GearUpProduct | null>;
  listManagedByShop(placeId: string): Promise<readonly GearUpProduct[]>;
  getManaged(productId: string): Promise<GearUpProduct | null>;
  create(placeId: string, input: GearUpProductCreateInput): Promise<GearUpProduct>;
  update(productId: string, input: GearUpProductUpdateInput): Promise<GearUpProduct>;
  feature(productId: string): Promise<GearUpProduct>;
  unfeature(productId: string): Promise<GearUpProduct>;
  archive(productId: string): Promise<GearUpProduct>;
  restore(productId: string): Promise<GearUpProduct>;
}
