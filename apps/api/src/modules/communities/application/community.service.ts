import { AppError } from "../../../http/errors/app-error.js";
import { canManageCommunity } from "../domain/community-access.js";
import type { CommunityCreateInput, CommunityRepository } from "./community.repository.js";

export class CommunityService {
  constructor(private readonly repository: CommunityRepository) {}

  listPublic(limit = 30, cursor?: string) {
    return this.repository.listPublic(Math.min(Math.max(limit, 1), 100), cursor);
  }

  async getPublic(id: string) {
    const community = await this.repository.getPublic(id);
    if (!community) throw new AppError(404, "COMMUNITY_NOT_FOUND", "HOOMA community not found");
    return community;
  }

  create(userId: string, input: CommunityCreateInput) {
    return this.repository.create(userId, input);
  }

  async join(userId: string, communityId: string) {
    const membership = await this.repository.join(communityId, userId);
    if (!membership) throw new AppError(404, "COMMUNITY_NOT_FOUND", "HOOMA community not found");
    return { membership };
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
}
