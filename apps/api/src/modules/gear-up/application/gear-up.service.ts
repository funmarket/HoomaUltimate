import type { GearUpShopSuggestionInput, GearUpShopUpdateInput } from "@hooma/contracts/gear-up";
import type { PlatformAdminAccessPort } from "../../../application/platform-admin-access.port.js";
import {
  resolvePlaceImageFields,
  type ExternalPlaceImageResolver,
} from "../../places/application/external-place-image-resolver.js";
import type { PlaceRepository } from "../../places/application/place.repository.js";
import { GearUpError } from "../domain/gear-up-error.js";
import type { GearUpModerationDecision, GearUpRepository } from "./gear-up.repository.js";

export class GearUpService {
  constructor(
    private readonly repository: GearUpRepository,
    private readonly places: PlaceRepository,
    private readonly platformAdmin: PlatformAdminAccessPort,
    private readonly imageResolver: ExternalPlaceImageResolver,
  ) {}

  listPublic(input: Readonly<Record<string, unknown>> = {}) {
    return this.repository.listPublic(input);
  }

  async getPublic(placeId: string) {
    const shop = await this.repository.getPublic(placeId);
    if (!shop) throw new GearUpError("GEAR_UP_SHOP_NOT_FOUND", "Gear Up shop not found");
    return shop;
  }

  async suggest(userId: string, input: GearUpShopSuggestionInput) {
    const place = await resolvePlaceImageFields(input.place, this.imageResolver);
    return this.repository.suggest(userId, { ...input, place });
  }

  async getManaged(userId: string, placeId: string) {
    await this.requireManage(userId, placeId);
    const shop = await this.repository.getManaged(placeId);
    if (!shop) throw new AppError(404, "GEAR_UP_SHOP_NOT_FOUND", "Gear Up shop not found");
    return shop;
  }

  async updateShop(userId: string, placeId: string, input: GearUpShopUpdateInput) {
    await this.requireManage(userId, placeId);
    const shop = await this.repository.getManaged(placeId);
    if (!shop) throw new AppError(404, "GEAR_UP_SHOP_NOT_FOUND", "Gear Up shop not found");
    return this.repository.updateShop(placeId, input);
  }

  async pending(userId: string) {
    await this.platformAdmin.requirePlatformAdmin(userId);
    return this.repository.pending();
  }

  async review(userId: string, placeId: string, input: GearUpModerationDecision) {
    await this.platformAdmin.requirePlatformAdmin(userId);
    if (!(await this.repository.review(userId, placeId, input))) {
      throw new GearUpError(
        "GEAR_UP_REVIEW_NOT_PENDING",
        "This Gear Up review is no longer pending",
      );
    }
    return { ok: true };
  }

  private async requireManage(userId: string, placeId: string): Promise<void> {
    if (await this.places.canManage(placeId, userId)) return;
    if (await this.platformAdmin.isPlatformAdmin(userId)) return;
    throw new GearUpError("GEAR_UP_MANAGE_FORBIDDEN", "Place manager or App Admin access required");
  }
}
