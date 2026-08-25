import type {
  CommunityCreateInput,
  CommunityJoinRequest,
  CommunityJoinRequestForFounder,
  CommunityUpdateInput,
} from "@hooma/contracts/communities";
import { AppError } from "../../../http/errors/app-error.js";
import type { PlatformAdminAuthorizer } from "../../platform-admin/application/platform-admin.authorizer.js";
import { canManageCommunity } from "../domain/community-access.js";
import type {
  CommunityJoinRequestForFounderRecord,
  CommunityJoinRequestRecord,
  CommunityRepository,
} from "./community.repository.js";

function joinPolicyForVisibility(visibility: "PUBLIC" | "PRIVATE") {
  return visibility === "PRIVATE" ? ("APPROVAL_REQUIRED" as const) : ("OPEN" as const);
}

function serializeJoinRequest(record: CommunityJoinRequestRecord): CommunityJoinRequest {
  return {
    ...record,
    requestedAt: record.requestedAt.toISOString(),
    resolvedAt: record.resolvedAt?.toISOString() ?? null,
  };
}

function serializeJoinRequestForFounder(
  record: CommunityJoinRequestForFounderRecord,
): CommunityJoinRequestForFounder {
  return {
    ...serializeJoinRequest(record),
    presentation: record.presentation,
  };
}

export class CommunityService {
  constructor(
    private readonly repository: CommunityRepository,
    private readonly platformAdmin?: PlatformAdminAuthorizer,
  ) {}

  listPublic(limit = 30, cursor?: string) {
    return this.repository.listPublic(Math.min(Math.max(limit, 1), 100), cursor);
  }

  async getPublic(id: string) {
    const community = await this.repository.getPublic(id);
    if (!community) throw new AppError(404, "COMMUNITY_NOT_FOUND", "HOOMA community not found");
    return community;
  }

  async canViewActivity(communityId: string, userId?: string | null): Promise<boolean> {
    const policy = await this.repository.membershipPolicy(communityId);
    if (!policy || policy.status !== "ACTIVE") return false;
    if (policy.visibility === "PUBLIC") return true;
    if (!userId) return false;
    return Boolean(await this.repository.managerRole(communityId, userId));
  }

  create(userId: string, input: CommunityCreateInput) {
    return this.repository.create(userId, {
      ...input,
      joinPolicy: joinPolicyForVisibility(input.visibility),
    });
  }

  async update(userId: string, communityId: string, input: CommunityUpdateInput) {
    await this.requireOwnerOrAdmin(communityId, userId);
    return this.repository.update(communityId, {
      ...input,
      ...(input.visibility !== undefined
        ? { joinPolicy: joinPolicyForVisibility(input.visibility) }
        : {}),
    });
  }

  async archive(userId: string, communityId: string) {
    const lifecycle = await this.requireOwnerOrAdmin(communityId, userId);
    if (lifecycle.status === "ARCHIVED") return { ok: true };
    if (lifecycle.hasActiveTeam || lifecycle.hasPublishedEvent) {
      throw new AppError(
        409,
        "COMMUNITY_ARCHIVE_HAS_ACTIVE_DEPENDENCIES",
        "Delete active Teams and finish or cancel published Events before deleting this HOOMA",
      );
    }
    await this.repository.archive(communityId);
    return { ok: true };
  }

  async join(userId: string, communityId: string) {
    const activeRole = await this.repository.managerRole(communityId, userId);
    if (activeRole) return { status: "JOINED" as const, membership: { role: activeRole } };

    const policy = await this.repository.membershipPolicy(communityId);
    if (!policy || policy.status !== "ACTIVE")
      throw new AppError(404, "COMMUNITY_NOT_FOUND", "HOOMA community not found");

    if (policy.joinPolicy === "OPEN") {
      const membership = await this.repository.joinOpen(communityId, userId);
      if (!membership)
        throw new AppError(404, "COMMUNITY_NOT_FOUND", "HOOMA community not found");
      return { status: "JOINED" as const, membership };
    }

    const outcome = await this.repository.requestJoin(communityId, userId);
    if (!outcome) throw new AppError(404, "COMMUNITY_NOT_FOUND", "HOOMA community not found");
    if (outcome.kind === "MEMBERSHIP") {
      return { status: "JOINED" as const, membership: { role: outcome.role } };
    }
    return { status: "PENDING" as const, request: serializeJoinRequest(outcome.request) };
  }

  async myJoinRequest(userId: string, communityId: string) {
    const request = await this.repository.getJoinRequest(communityId, userId);
    return { request: request ? serializeJoinRequest(request) : null };
  }

  async joinRequests(founderUserId: string, communityId: string) {
    await this.requireFounder(communityId, founderUserId);
    const requests = await this.repository.listJoinRequests(communityId);
    return { requests: requests.map(serializeJoinRequestForFounder) };
  }

  async approveJoinRequest(founderUserId: string, communityId: string, targetUserId: string) {
    await this.requireFounder(communityId, founderUserId);
    const changed = await this.repository.resolveJoinRequest(
      communityId,
      targetUserId,
      founderUserId,
      "APPROVE",
    );
    if (!changed)
      throw new AppError(409, "COMMUNITY_JOIN_REQUEST_NOT_PENDING", "Join request is not pending");
    return { ok: true };
  }

  async declineJoinRequest(founderUserId: string, communityId: string, targetUserId: string) {
    await this.requireFounder(communityId, founderUserId);
    const changed = await this.repository.resolveJoinRequest(
      communityId,
      targetUserId,
      founderUserId,
      "DECLINE",
    );
    if (!changed)
      throw new AppError(409, "COMMUNITY_JOIN_REQUEST_NOT_PENDING", "Join request is not pending");
    return { ok: true };
  }

  async cancelJoinRequest(userId: string, communityId: string) {
    const changed = await this.repository.cancelJoinRequest(communityId, userId);
    if (!changed)
      throw new AppError(409, "COMMUNITY_JOIN_REQUEST_NOT_PENDING", "Join request is not pending");
    return { ok: true };
  }

  async addMember(founderUserId: string, communityId: string, username: string) {
    await this.requireFounder(communityId, founderUserId);
    const member = await this.repository.addMemberByUsername(
      communityId,
      username,
      founderUserId,
    );
    if (!member)
      throw new AppError(404, "COMMUNITY_MEMBER_TARGET_NOT_FOUND", "HOOMA user not found");
    return { member };
  }

  async leave(userId: string, communityId: string) {
    const role = await this.repository.managerRole(communityId, userId);
    if (!role)
      throw new AppError(
        404,
        "COMMUNITY_MEMBERSHIP_NOT_FOUND",
        "Active HOOMA membership not found",
      );
    if (role === "FOUNDER")
      throw new AppError(409, "COMMUNITY_FOUNDER_CANNOT_LEAVE", "Founder cannot leave their HOOMA");
    await this.repository.leave(communityId, userId);
    return { ok: true };
  }

  async members(userId: string, communityId: string) {
    await this.requireMember(communityId, userId);
    return this.repository.listMembers(communityId);
  }

  async removeMember(actorUserId: string, communityId: string, targetUserId: string) {
    if (actorUserId === targetUserId)
      throw new AppError(409, "COMMUNITY_REMOVE_SELF", "Use Leave HOOMA to remove yourself");
    const actorRole = await this.repository.managerRole(communityId, actorUserId);
    if (!canManageCommunity(actorRole))
      throw new AppError(403, "COMMUNITY_COACH_REQUIRED", "Founder or Coach access required");
    const targetRole = await this.repository.managerRole(communityId, targetUserId);
    if (!targetRole)
      throw new AppError(404, "COMMUNITY_MEMBER_NOT_FOUND", "Active HOOMA member not found");
    if (targetRole === "FOUNDER")
      throw new AppError(403, "COMMUNITY_FOUNDER_PROTECTED", "Founder cannot be removed");
    if (actorRole === "COACH" && targetRole !== "MEMBER")
      throw new AppError(403, "COMMUNITY_COACH_SCOPE", "Coach can remove Members only");
    await this.repository.removeMember(communityId, targetUserId);
    return { ok: true };
  }

  async appointCoach(founderUserId: string, communityId: string, targetUserId: string) {
    await this.requireFounder(communityId, founderUserId);
    if (founderUserId === targetUserId)
      throw new AppError(409, "COMMUNITY_COACH_SELF", "Founder already has Coach authority");
    const targetRole = await this.repository.managerRole(communityId, targetUserId);
    if (!targetRole)
      throw new AppError(
        404,
        "COMMUNITY_MEMBER_NOT_FOUND",
        "Coach must already be an active HOOMA member",
      );
    if (targetRole === "FOUNDER")
      throw new AppError(409, "COMMUNITY_COACH_FOUNDER", "Founder already has community authority");
    if (targetRole === "COACH") return { ok: true };
    await this.repository.appointCoach(communityId, targetUserId);
    return { ok: true };
  }

  async revokeCoach(founderUserId: string, communityId: string, targetUserId: string) {
    await this.requireFounder(communityId, founderUserId);
    const targetRole = await this.repository.managerRole(communityId, targetUserId);
    if (targetRole !== "COACH")
      throw new AppError(404, "COMMUNITY_COACH_NOT_FOUND", "Active Coach not found");
    await this.repository.revokeCoach(communityId, targetUserId);
    return { ok: true };
  }

  async requireMember(communityId: string, userId: string): Promise<void> {
    const role = await this.repository.managerRole(communityId, userId);
    if (!role) throw new AppError(403, "COMMUNITY_MEMBER_REQUIRED", "HOOMA membership required");
  }

  async requireFounder(communityId: string, userId: string): Promise<void> {
    const role = await this.repository.managerRole(communityId, userId);
    if (role !== "FOUNDER")
      throw new AppError(403, "COMMUNITY_FOUNDER_REQUIRED", "Founder access required");
  }

  async requireCoach(communityId: string, userId: string): Promise<void> {
    const role = await this.repository.managerRole(communityId, userId);
    if (!canManageCommunity(role))
      throw new AppError(403, "COMMUNITY_COACH_REQUIRED", "Founder or Coach access required");
  }

  private async requireOwnerOrAdmin(communityId: string, userId: string) {
    const lifecycle = await this.repository.lifecycle(communityId);
    if (!lifecycle) throw new AppError(404, "COMMUNITY_NOT_FOUND", "HOOMA community not found");
    if (
      lifecycle.createdByUserId !== userId &&
      !(await this.platformAdmin?.isPlatformAdmin(userId))
    ) {
      throw new AppError(
        403,
        "COMMUNITY_OWNER_OR_ADMIN_REQUIRED",
        "HOOMA creator or App Admin access required",
      );
    }
    return lifecycle;
  }
}
