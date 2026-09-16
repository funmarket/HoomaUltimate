import type { AdminUserDetail, AdminUserSearchItem } from "@hooma/contracts/platform-admin";
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
}

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
}
