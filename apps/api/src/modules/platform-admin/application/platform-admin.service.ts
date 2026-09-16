import type { PlatformManagerCapability } from "@hooma/contracts/platform-admin";
import { AppError } from "../../../http/errors/app-error.js";
import type { PlatformAdminAuthorizer } from "./platform-admin.authorizer.js";
import type { PlatformAdminRepository } from "./platform-admin.repository.js";

export class PlatformAdminService implements PlatformAdminAuthorizer {
  constructor(private readonly repository: PlatformAdminRepository) {}

  isPlatformAdmin(userId: string): Promise<boolean> {
    return this.repository.hasPlatformAdminRole(userId);
  }

  async can(userId: string, capability: PlatformManagerCapability): Promise<boolean> {
    if (await this.isPlatformAdmin(userId)) return true;
    return (await this.repository.managerCapabilities(userId)).includes(capability);
  }

  async requirePlatformAdmin(userId: string): Promise<void> {
    if (!(await this.isPlatformAdmin(userId))) {
      throw new AppError(403, "PLATFORM_ADMIN_REQUIRED", "App owner access required");
    }
  }

  async requireCapability(userId: string, capability: PlatformManagerCapability): Promise<void> {
    if (!(await this.can(userId, capability))) {
      throw new AppError(403, "APP_MANAGER_CAPABILITY_REQUIRED", `${capability} access required`);
    }
  }

  async bootstrapConfiguredOwner(configuredTelegramUserId?: string): Promise<{
    status: "disabled" | "pending" | "ready";
  }> {
    if (!configuredTelegramUserId) return { status: "disabled" };
    const userId = await this.repository.findUserByTelegramId(BigInt(configuredTelegramUserId));
    if (!userId) return { status: "pending" };
    await this.repository.reconcilePlatformOwner(userId);
    return { status: "ready" };
  }

  reconcilePlatformOwner(userId: string): Promise<void> {
    return this.repository.reconcilePlatformOwner(userId);
  }

  async access(userId: string) {
    return {
      isPlatformOwner: await this.isPlatformAdmin(userId),
      managerCapabilities: [...(await this.repository.managerCapabilities(userId))],
    };
  }

  async overview(userId: string) {
    await this.requireCapability(userId, "VIEW_AUDIT");
    return this.repository.overview();
  }

  async audit(userId: string, limit = 100) {
    await this.requireCapability(userId, "VIEW_AUDIT");
    return this.repository.auditEntries(Math.min(Math.max(limit, 1), 200));
  }

  async issues(userId: string, limit = 25) {
    await this.requireCapability(userId, "VIEW_AUDIT");
    return this.repository.adminIssues(Math.min(Math.max(limit, 1), 100));
  }

  async resolveIssue(userId: string, issueId: string, note?: string | null) {
    await this.requirePlatformAdmin(userId);
    const updated = await this.repository.setAdminIssueDisposition(
      userId,
      issueId,
      "RESOLVED",
      note,
    );
    if (!updated) throw new AppError(404, "ADMIN_ISSUE_NOT_FOUND", "Admin issue not found");
    return { ok: true };
  }

  async dismissIssue(userId: string, issueId: string, note?: string | null) {
    await this.requirePlatformAdmin(userId);
    const updated = await this.repository.setAdminIssueDisposition(
      userId,
      issueId,
      "DISMISSED",
      note,
    );
    if (!updated) throw new AppError(404, "ADMIN_ISSUE_NOT_FOUND", "Admin issue not found");
    return { ok: true };
  }

  async managers(userId: string) {
    await this.requirePlatformAdmin(userId);
    return this.repository.listManagers();
  }

  async setManagerCapabilities(
    ownerUserId: string,
    username: string,
    capabilities: readonly PlatformManagerCapability[],
  ) {
    await this.requirePlatformAdmin(ownerUserId);
    const targetUserId = await this.repository.findUserByUsername(username.trim().toLowerCase());
    if (!targetUserId) throw new AppError(404, "USER_NOT_FOUND", "HOOMA user not found");
    if (targetUserId === ownerUserId) {
      throw new AppError(
        409,
        "PLATFORM_OWNER_MANAGER_FORBIDDEN",
        "The app owner already has full authority",
      );
    }
    if (await this.isPlatformAdmin(targetUserId)) {
      throw new AppError(
        409,
        "PLATFORM_ADMIN_DELEGATION_FORBIDDEN",
        "Full App Admin authority cannot be delegated; assign App Manager capabilities instead",
      );
    }
    await this.repository.setManagerCapabilities(ownerUserId, targetUserId, capabilities);
    return { ok: true };
  }
}
