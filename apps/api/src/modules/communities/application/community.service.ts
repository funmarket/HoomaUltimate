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

  async appointCoach(founderUserId: string, communityId: string, targetUserId: string) {
    await this.requireFounder(communityId, founderUserId);
    if (founderUserId === targetUserId) throw new AppError(409, "COMMUNITY_COACH_SELF", "Founder already has Coach authority");
    await this.repository.appointCoach(communityId, targetUserId);
    return { ok: true };
  }

  async revokeCoach(founderUserId: string, communityId: string, targetUserId: string) {
    await this.requireFounder(communityId, founderUserId);
    await this.repository.revokeCoach(communityId, targetUserId);
    return { ok: true };
  }

  async requireFounder(communityId: string, userId: string): Promise<void> {
    const role = await this.repository.managerRole(communityId, userId);
    if (role !== "FOUNDER") throw new AppError(403, "COMMUNITY_FOUNDER_REQUIRED", "Founder access required");
  }

  async requireCoach(communityId: string, userId: string): Promise<void> {
    const role = await this.repository.managerRole(communityId, userId);
    if (!canManageCommunity(role)) throw new AppError(403, "COMMUNITY_COACH_REQUIRED", "Founder or Coach access required");
  }
}
