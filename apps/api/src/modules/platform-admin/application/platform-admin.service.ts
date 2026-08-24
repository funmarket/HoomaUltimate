import { AppError } from "../../../http/errors/app-error.js";
import type { PlatformAdminAuthorizer } from "./platform-admin.authorizer.js";
import type { PlatformAdminRepository } from "./platform-admin.repository.js";

export class PlatformAdminService implements PlatformAdminAuthorizer {
  constructor(private readonly repository: PlatformAdminRepository) {}

  isPlatformAdmin(userId: string): Promise<boolean> {
    return this.repository.hasPlatformAdminRole(userId);
  }

  async requirePlatformAdmin(userId: string): Promise<void> {
    if (!(await this.isPlatformAdmin(userId))) {
      throw new AppError(403, "PLATFORM_ADMIN_REQUIRED", "App Admin access required");
    }
  }

  async overview(userId: string) {
    await this.requirePlatformAdmin(userId);
    return this.repository.overview();
  }

  async audit(userId: string, limit = 100) {
    await this.requirePlatformAdmin(userId);
    return this.repository.auditEntries(Math.min(Math.max(limit, 1), 200));
  }
}
