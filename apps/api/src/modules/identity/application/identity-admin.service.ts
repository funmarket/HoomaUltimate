import type {
  AdminUserDetail,
  AdminUserModerationStatus,
  AdminUserSanctionActionInput,
  AdminUserSanctionClearInput,
  AdminUserSanctionInput,
  AdminUserSearchItem,
} from "@hooma/contracts/platform-admin";
import type { PlatformAdminAuthorizer } from "../../platform-admin/application/platform-admin.authorizer.js";
import { IdentityAdminError } from "../domain/identity-admin-error.js";

export interface IdentityAdminRepository {
  searchAdminUsers(query: string, limit: number): Promise<readonly AdminUserSearchItem[]>;
  findAdminUserDetail(userId: string): Promise<AdminUserDetail | null>;
  revokeActiveUserSessions(
    actorUserId: string,
    targetUserId: string,
    reason: string,
  ): Promise<number>;
  issueUserSanction(input: {
    actorUserId: string;
    targetUserId: string;
    actionType: AdminUserSanctionActionInput | "RED_CARD_BAN";
    reason: string;
    expiresAt: Date | null;
  }): Promise<void>;
  clearUserSanction(input: {
    actorUserId: string;
    targetUserId: string;
    sanctionId: string;
    reason: string;
  }): Promise<boolean>;
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export class IdentityAdminService {
  constructor(
    private readonly repository: IdentityAdminRepository,
    private readonly authorizer: PlatformAdminAuthorizer,
  ) {}

  async searchUsers(
    actorUserId: string,
    query: string,
    limit = 25,
  ): Promise<readonly AdminUserSearchItem[]> {
    await this.authorizer.requireCapability(actorUserId, "MANAGE_USERS");
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      throw new IdentityAdminError(
        "USER_SEARCH_QUERY_REQUIRED",
        "User search requires at least 2 characters",
      );
    }
    return this.repository.searchAdminUsers(normalizedQuery, Math.min(Math.max(limit, 1), 50));
  }

  async userDetail(actorUserId: string, targetUserId: string): Promise<AdminUserDetail> {
    await this.authorizer.requireCapability(actorUserId, "MANAGE_USERS");
    const detail = await this.repository.findAdminUserDetail(targetUserId);
    if (!detail) throw new IdentityAdminError("USER_NOT_FOUND", "HOOMA user not found");
    return detail;
  }

  async revokeUserSessions(
    actorUserId: string,
    targetUserId: string,
    note?: string | null,
  ): Promise<{ readonly ok: true; readonly revokedSessionCount: number }> {
    await this.requireSessionRevocationTargetAllowed(actorUserId, targetUserId);
    const reason = note?.trim();
    if (!reason) {
      throw new IdentityAdminError(
        "USER_SESSION_REVOCATION_REASON_REQUIRED",
        "Revoking user sessions requires a reason",
      );
    }
    const revokedSessionCount = await this.repository.revokeActiveUserSessions(
      actorUserId,
      targetUserId,
      reason,
    );
    return { ok: true, revokedSessionCount };
  }

  async sanctionUser(
    actorUserId: string,
    targetUserId: string,
    input: AdminUserSanctionInput,
  ): Promise<{ readonly ok: true; readonly moderation: AdminUserModerationStatus }> {
    await this.requireTargetAllowed(actorUserId, targetUserId);
    const reason = this.requireReason(input.reason, "User sanctions require a reason");
    const actionType = input.actionType;
    const expiresAt = this.expirationFor(actionType, input.expiresAt ?? null);

    await this.repository.issueUserSanction({
      actorUserId,
      targetUserId,
      actionType,
      reason,
      expiresAt,
    });

    const detailAfterAction = await this.userDetail(actorUserId, targetUserId);
    if (actionType === "YELLOW_CARD_WARNING" && detailAfterAction.moderation.yellowCardCount >= 3) {
      await this.repository.issueUserSanction({
        actorUserId,
        targetUserId,
        actionType: "RED_CARD_BAN",
        reason: "Automatic red card after third yellow card warning",
        expiresAt: new Date(Date.now() + ONE_WEEK_MS),
      });
    }

    const finalDetail = await this.userDetail(actorUserId, targetUserId);
    return { ok: true, moderation: finalDetail.moderation };
  }

  async clearUserSanction(
    actorUserId: string,
    targetUserId: string,
    sanctionId: string,
    input: AdminUserSanctionClearInput,
  ): Promise<{ readonly ok: true; readonly moderation: AdminUserModerationStatus }> {
    await this.requireTargetAllowed(actorUserId, targetUserId);
    const reason = this.requireReason(input.reason, "Clearing a user sanction requires a reason");
    const cleared = await this.repository.clearUserSanction({
      actorUserId,
      targetUserId,
      sanctionId,
      reason,
    });
    if (!cleared)
      throw new IdentityAdminError("USER_SANCTION_NOT_FOUND", "Active sanction not found");
    const detail = await this.userDetail(actorUserId, targetUserId);
    return { ok: true, moderation: detail.moderation };
  }

  private async requireSessionRevocationTargetAllowed(
    actorUserId: string,
    targetUserId: string,
  ): Promise<AdminUserDetail> {
    await this.authorizer.requireCapability(actorUserId, "MANAGE_USERS");
    const actorIsPlatformAdmin = await this.authorizer.isPlatformAdmin(actorUserId);
    const target = await this.userDetail(actorUserId, targetUserId);
    if (
      !actorIsPlatformAdmin &&
      (target.access.isPlatformAdmin || target.access.managerCapabilities.length > 0)
    ) {
      throw new IdentityAdminError(
        "USER_SESSION_REVOCATION_TARGET_FORBIDDEN",
        "Only a Platform Admin can revoke sessions for a Platform Admin or App Manager",
      );
    }
    return target;
  }

  private async requireTargetAllowed(
    actorUserId: string,
    targetUserId: string,
  ): Promise<AdminUserDetail> {
    await this.authorizer.requireCapability(actorUserId, "MANAGE_USERS");
    const actorIsPlatformAdmin = await this.authorizer.isPlatformAdmin(actorUserId);
    const target = await this.userDetail(actorUserId, targetUserId);
    if (
      !actorIsPlatformAdmin &&
      (target.access.isPlatformAdmin || target.access.managerCapabilities.length > 0)
    ) {
      throw new IdentityAdminError(
        "USER_SANCTION_TARGET_FORBIDDEN",
        "Only a Platform Admin can moderate a Platform Admin or App Manager",
      );
    }
    return target;
  }

  private requireReason(value: string | null | undefined, message: string): string {
    const reason = value?.trim();
    if (!reason) throw new IdentityAdminError("USER_SANCTION_REASON_REQUIRED", message);
    return reason;
  }

  private expirationFor(
    actionType: AdminUserSanctionActionInput,
    expiresAt: string | null,
  ): Date | null {
    if (actionType === "YELLOW_CARD_WARNING" || actionType === "ACCOUNT_DISABLED") return null;
    if (!expiresAt) {
      throw new IdentityAdminError(
        "USER_SANCTION_DURATION_REQUIRED",
        `${actionType === "TEMPORARY_BAN" ? "Temporary ban" : "Read-only mode"} requires an expiration`,
      );
    }
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) {
      throw new IdentityAdminError(
        "USER_SANCTION_DURATION_REQUIRED",
        "Sanction expiration must be a future timestamp",
      );
    }
    return parsed;
  }
}
