import {
  gearUpSettingsUpdateSchema,
  type GearUpSettings,
  type GearUpSettingsUpdateInput,
} from "@hooma/contracts/gear-up";
import type { PlatformAdminAccessPort } from "../../../application/platform-admin-access.port.js";
import type { GearUpProductMediaRepository } from "./gear-up-product-media.repository.js";

export class GearUpSettingsService {
  constructor(
    private readonly repository: GearUpProductMediaRepository,
    private readonly platformAdmin: PlatformAdminAccessPort,
  ) {}

  async get(): Promise<GearUpSettings> {
    return this.repository.getSettings();
  }

  async update(userId: string, input: GearUpSettingsUpdateInput): Promise<GearUpSettings> {
    await this.platformAdmin.requirePlatformAdmin(userId);
    return this.repository.updateSettings(userId, gearUpSettingsUpdateSchema.parse(input));
  }
}
