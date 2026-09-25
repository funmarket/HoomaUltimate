import type {
  GearUpProductCreateInput,
  GearUpProductUpdateInput,
} from "@hooma/contracts/gear-up";

export interface GearUpProductRecord {
  readonly id: string;
  readonly shopPlaceId: string;
  readonly title: string;
  readonly brand: string | null;
  readonly description: string;
  readonly sports: readonly string[];
  readonly category: string;
  readonly price: number | null;
  readonly currency: string;
  readonly featuredAt: string | null;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface GearUpProductRepository {
  listPublicByShop(placeId: string): Promise<readonly GearUpProductRecord[]>;
  getPublic(productId: string): Promise<GearUpProductRecord | null>;
  listManagedByShop(placeId: string): Promise<readonly GearUpProductRecord[]>;
  getManaged(productId: string): Promise<GearUpProductRecord | null>;
  create(placeId: string, input: GearUpProductCreateInput): Promise<GearUpProductRecord>;
  update(productId: string, input: GearUpProductUpdateInput): Promise<GearUpProductRecord>;
  feature(productId: string): Promise<GearUpProductRecord>;
  unfeature(productId: string): Promise<GearUpProductRecord>;
  archive(productId: string): Promise<GearUpProductRecord>;
  restore(productId: string): Promise<GearUpProductRecord>;
}
