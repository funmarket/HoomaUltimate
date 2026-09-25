import type { GearUpProductCreateInput, GearUpProductUpdateInput } from "@hooma/contracts/gear-up";
import type { PlatformAdminAccessPort } from "../../../application/platform-admin-access.port.js";
import type { PlaceRepository } from "../../places/application/place.repository.js";
import { GearUpError } from "../domain/gear-up-error.js";
import type { GearUpProductRepository } from "./gear-up-product.repository.js";

export class GearUpProductService {
  constructor(
    private readonly repository: GearUpProductRepository,
    private readonly places: PlaceRepository,
    private readonly platformAdmin: PlatformAdminAccessPort,
  ) {}

  listPublicByShop(placeId: string) {
    return this.repository.listPublicByShop(placeId);
  }

  async getPublic(productId: string) {
    const product = await this.repository.getPublic(productId);
    if (!product) {
      throw new GearUpError("GEAR_UP_PRODUCT_NOT_FOUND", "Gear Up product not found");
    }
    return product;
  }

  async listManagedByShop(userId: string, placeId: string) {
    await this.requireProductManager(placeId, userId);
    return this.repository.listManagedByShop(placeId);
  }

  async create(userId: string, placeId: string, input: GearUpProductCreateInput) {
    await this.requireProductManager(placeId, userId);
    return this.repository.create(placeId, input);
  }

  async update(
    userId: string,
    placeId: string,
    productId: string,
    input: GearUpProductUpdateInput,
  ) {
    await this.requireProductManager(placeId, userId);
    await this.requireProductBelongsToShop(placeId, productId);
    return this.repository.update(productId, input);
  }

  async feature(userId: string, placeId: string, productId: string) {
    await this.requireProductManager(placeId, userId);
    await this.requireProductBelongsToShop(placeId, productId);
    return this.repository.feature(productId);
  }

  async unfeature(userId: string, placeId: string, productId: string) {
    await this.requireProductManager(placeId, userId);
    await this.requireProductBelongsToShop(placeId, productId);
    return this.repository.unfeature(productId);
  }

  async archive(userId: string, placeId: string, productId: string) {
    await this.requireProductManager(placeId, userId);
    await this.requireProductBelongsToShop(placeId, productId);
    return this.repository.archive(productId);
  }

  async restore(userId: string, placeId: string, productId: string) {
    await this.requireProductManager(placeId, userId);
    await this.requireProductBelongsToShop(placeId, productId);
    return this.repository.restore(productId);
  }

  private async requireProductManager(placeId: string, userId: string): Promise<void> {
    if (await this.places.hasVerifiedOwnership(placeId, userId)) return;
    if (await this.platformAdmin.isPlatformAdmin(userId)) return;
    throw new GearUpError(
      "GEAR_UP_PRODUCT_MANAGE_FORBIDDEN",
      "Verified Place owner or App Admin access required",
    );
  }

  private async requireProductBelongsToShop(placeId: string, productId: string): Promise<void> {
    const product = await this.repository.getManaged(productId);
    if (!product || product.shopPlaceId !== placeId) {
      throw new GearUpError("GEAR_UP_PRODUCT_NOT_FOUND", "Gear Up product not found");
    }
  }
}
