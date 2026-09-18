import type {
  AdminAuditQueryInput,
  PlatformManagerCapability,
} from "@hooma/contracts/platform-admin";
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

  async audit(userId: string, input: AdminAuditQueryInput = {}) {
    await this.requireCapability(userId, "VIEW_AUDIT");
    const actor = this.optionalAuditText(input.actor);
    const action = this.optionalAuditText(input.action);
    const entityType = this.optionalAuditText(input.entityType);
    const from = this.optionalAuditDate(input.from, "from");
    const to = this.optionalAuditDate(input.to, "to");
    return this.repository.auditEntries({
      ...(actor ? { actor } : {}),
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      limit: Math.min(Math.max(input.limit ?? 100, 1), 100),
      cursor: this.optionalAuditText(input.cursor) ?? null,
    });
  }

  private optionalAuditText(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private optionalAuditDate(value: string | undefined, boundary: "from" | "to"): Date | undefined {
    const normalized = value?.trim();
    if (!normalized) return undefined;
    const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? `${normalized}T${boundary === "from" ? "00:00:00.000" : "23:59:59.999"}Z`
      : normalized;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      throw new AppError(400, "AUDIT_FILTER_INVALID", "Audit date filters must be valid dates");
    }
    return date;
  }

  async issues(userId: string, limit = 25) {
    await this.requireAnyCapability(userId, ["VIEW_AUDIT", "MANAGE_ADMIN_ISSUES"]);
    return this.repository.adminIssues(Math.min(Math.max(limit, 1), 100));
  }

  async resolveIssue(userId: string, issueId: string, note?: string | null) {
    await this.requireCapability(userId, "MANAGE_ADMIN_ISSUES");
    const reason = this.requireAdminIssueReason(note);
    const updated = await this.repository.setAdminIssueDisposition(
      userId,
      issueId,
      "RESOLVED",
      reason,
    );
    if (!updated) throw new AppError(404, "ADMIN_ISSUE_NOT_FOUND", "Admin issue not found");
    return { ok: true };
  }

  async dismissIssue(userId: string, issueId: string, note?: string | null) {
    await this.requireCapability(userId, "MANAGE_ADMIN_ISSUES");
    const reason = this.requireAdminIssueReason(note);
    const updated = await this.repository.setAdminIssueDisposition(
      userId,
      issueId,
      "DISMISSED",
      reason,
    );
    if (!updated) throw new AppError(404, "ADMIN_ISSUE_NOT_FOUND", "Admin issue not found");
    return { ok: true };
  }

  private requireAdminIssueReason(note?: string | null): string {
    const reason = note?.trim();
    if (!reason) {
      throw new AppError(
        400,
        "ADMIN_ISSUE_REASON_REQUIRED",
        "Resolving or dismissing an admin issue requires a reason",
      );
    }
    return reason;
  }

  private async requireAnyCapability(
    userId: string,
    capabilities: readonly PlatformManagerCapability[],
  ): Promise<void> {
    for (const capability of capabilities) {
      if (await this.can(userId, capability)) return;
    }
    throw new AppError(
      403,
      "APP_MANAGER_CAPABILITY_REQUIRED",
      `${capabilities.join(" or ")} access required`,
    );
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
