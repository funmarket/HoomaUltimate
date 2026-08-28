import type { PlatformManagerCapability } from "@hooma/contracts/platform-admin";

export interface PlatformAdminAccessPort {
  isPlatformAdmin(userId: string): Promise<boolean>;
  requirePlatformAdmin(userId: string): Promise<void>;
  can(userId: string, capability: PlatformManagerCapability): Promise<boolean>;
  requireCapability(userId: string, capability: PlatformManagerCapability): Promise<void>;
}
