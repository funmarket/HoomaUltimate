import type {
  AthletesCommunityCreateInput,
  AthletesCommunityUpdateInput,
  AthletesJoinRequest,
  AthletesJoinResult,
} from "@hooma/contracts/athletes";
import { AthletesError } from "../domain/athletes-error.js";
import type {
  AthletesJoinRequestRecord,
  AthletesRepository,
  AthletesRole,
} from "./athletes.repository.js";

function serializeRequest(request: AthletesJoinRequestRecord): AthletesJoinRequest {
  return {
    id: request.id,
    athletesCommunityId: request.athletesCommunityId,
    userId: request.userId,
    status: request.status,
    requestedAt: request.requestedAt.toISOString(),
    resolvedAt: request.resolvedAt?.toISOString() ?? null,
    resolvedByUserId: request.resolvedByUserId,
  };
}

function normalizedCreate(input: AthletesCommunityCreateInput) {
  return {
    ...input,
    description: input.description ?? null,
    city: input.city ?? null,
    houma: input.houma ?? null,
    logoUrl: input.logoUrl ?? null,
    bannerUrl: input.bannerUrl ?? null,
    visibility: input.visibility,
    joinPolicy: input.visibility === "PRIVATE" ? "APPROVAL_REQUIRED" : input.joinPolicy,
  };
}

export class AthletesService {
  constructor(private readonly repository: AthletesRepository) {}

  listPublic(input: Parameters<AthletesRepository["listPublic"]>[0]) {
    return this.repository.listPublic({ ...input, limit: Math.min(Math.max(input.limit, 1), 100) });
  }

  async getPublic(id: string, viewerUserId?: string) {
    const record = await this.repository.getPublic(id);
    if (!record) throw new AthletesError("ATHLETES_NOT_FOUND", "Athletes community not found");
    if (!viewerUserId) return record;
    const [viewerRole, request] = await Promise.all([
      this.repository.activeRole(id, viewerUserId),
      this.repository.getJoinRequest(id, viewerUserId),
    ]);
    return { ...record, viewerRole, viewerJoinRequestStatus: request?.status ?? null };
  }

  create(userId: string, input: AthletesCommunityCreateInput) {
    return this.repository.createWithFounder(userId, normalizedCreate(input));
  }

  async update(userId: string, id: string, input: AthletesCommunityUpdateInput) {
    return this.inCommunity(id, async (scope) => {
      const current = await scope.requireFounder(userId, id);
      const nextVisibility = input.visibility ?? current.visibility;
      return scope.repository.update(id, {
        ...input,
        ...(nextVisibility === "PRIVATE" ? { joinPolicy: "APPROVAL_REQUIRED" as const } : {}),
      });
    });
  }

  async archive(userId: string, id: string) {
    return this.inCommunity(id, async (scope) => {
      await scope.requireFounder(userId, id);
      await scope.repository.archive(id);
      return { ok: true };
    });
  }

  async join(userId: string, id: string): Promise<AthletesJoinResult> {
    return this.inCommunity(id, async (scope) => {
      const community = await scope.requireActive(id);
      const existingRole = await scope.repository.activeRole(id, userId);
      if (existingRole) return { status: "JOINED", membership: { role: existingRole } };
      if (community.joinPolicy === "OPEN") {
        const membership = await scope.repository.joinOpen(id, userId);
        return { status: "JOINED", membership: { role: membership.role } };
      }
      const result = await scope.repository.requestJoin(id, userId);
      if (result.kind === "MEMBERSHIP")
        return { status: "JOINED", membership: { role: result.role } };
      return { status: "PENDING", request: serializeRequest(result.request) };
    });
  }

  async myJoinRequest(userId: string, id: string) {
    await this.requireActive(id);
    const request = await this.repository.getJoinRequest(id, userId);
    return { request: request ? serializeRequest(request) : null };
  }

  async cancelJoinRequest(userId: string, id: string) {
    return this.inCommunity(id, async (scope) => {
      await scope.requireActive(id);
      const cancelled = await scope.repository.cancelJoinRequest(id, userId);
      if (!cancelled)
        throw new AthletesError(
          "ATHLETES_JOIN_REQUEST_NOT_FOUND",
          "Pending join request not found",
        );
      return { ok: true };
    });
  }

  async joinRequests(userId: string, id: string) {
    await this.requireManager(userId, id);
    return { requests: await this.repository.listJoinRequests(id) };
  }

  async approveJoinRequest(userId: string, id: string, targetUserId: string) {
    return this.inCommunity(id, async (scope) => {
      await scope.requireManager(userId, id);
      const changed = await scope.repository.resolveJoinRequest(
        id,
        targetUserId,
        userId,
        "APPROVE",
      );
      if (!changed)
        throw new AthletesError(
          "ATHLETES_JOIN_REQUEST_NOT_FOUND",
          "Pending join request not found",
        );
      return { ok: true };
    });
  }

  async declineJoinRequest(userId: string, id: string, targetUserId: string) {
    return this.inCommunity(id, async (scope) => {
      await scope.requireManager(userId, id);
      const changed = await scope.repository.resolveJoinRequest(
        id,
        targetUserId,
        userId,
        "DECLINE",
      );
      if (!changed)
        throw new AthletesError(
          "ATHLETES_JOIN_REQUEST_NOT_FOUND",
          "Pending join request not found",
        );
      return { ok: true };
    });
  }

  async members(userId: string, id: string) {
    const role = await this.repository.activeRole(id, userId);
    if (!role) throw new AthletesError("ATHLETES_MEMBER_REQUIRED", "Athletes membership required");
    return this.repository.listMembers(id);
  }

  async addMember(userId: string, id: string, username: string) {
    return this.inCommunity(id, async (scope) => {
      await scope.requireManager(userId, id);
      const member = await scope.repository.addMemberByUsername(
        id,
        username.trim().toLowerCase(),
        userId,
      );
      if (!member) throw new AthletesError("ATHLETES_USER_NOT_FOUND", "User not found");
      return { member };
    });
  }

  async removeMember(userId: string, id: string, targetUserId: string) {
    return this.inCommunity(id, async (scope) => {
      const actorRole = await scope.requireManager(userId, id);
      const targetRole = await scope.repository.activeRole(id, targetUserId);
      if (!targetRole)
        throw new AthletesError("ATHLETES_MEMBER_NOT_FOUND", "Athletes member not found");
      if (targetRole === "FOUNDER")
        throw new AthletesError("ATHLETES_FOUNDER_REMOVE_FORBIDDEN", "Founder cannot be removed");
      if (actorRole === "MODERATOR" && targetRole !== "MEMBER")
        throw new AthletesError("ATHLETES_MODERATOR_SCOPE", "Moderator can only remove members");
      await scope.repository.removeMember(id, targetUserId);
      return { ok: true };
    });
  }

  async setRole(userId: string, id: string, targetUserId: string, role: "MODERATOR" | "MEMBER") {
    return this.inCommunity(id, async (scope) => {
      await scope.requireFounder(userId, id);
      const targetRole = await scope.repository.activeRole(id, targetUserId);
      if (!targetRole)
        throw new AthletesError("ATHLETES_MEMBER_NOT_FOUND", "Athletes member not found");
      if (targetRole === "FOUNDER")
        throw new AthletesError(
          "ATHLETES_FOUNDER_ROLE_FORBIDDEN",
          "Founder role cannot be changed here",
        );
      await scope.repository.setRole(id, targetUserId, role);
      return { ok: true };
    });
  }

  async requireFounderContent(userId: string, id: string) {
    await this.requireFounder(userId, id);
  }

  async requireMemberContent(userId: string, id: string) {
    const role = await this.repository.activeRole(id, userId);
    if (!role) throw new AthletesError("ATHLETES_MEMBER_REQUIRED", "Athletes membership required");
  }

  private inCommunity<T>(
    id: string,
    operation: (service: AthletesService) => Promise<T>,
  ): Promise<T> {
    return this.repository.withCommunityLock(id, (repository) =>
      operation(new AthletesService(repository)),
    );
  }

  private async requireActive(id: string) {
    const community = await this.repository.lifecycle(id);
    if (!community || community.status !== "ACTIVE")
      throw new AthletesError("ATHLETES_NOT_FOUND", "Athletes community not found");
    return community;
  }

  private async requireFounder(userId: string, id: string) {
    const community = await this.requireActive(id);
    const role = await this.repository.managerRole(id, userId);
    if (role !== "FOUNDER")
      throw new AthletesError("ATHLETES_FOUNDER_REQUIRED", "Athletes Founder access required");
    return community;
  }

  private async requireManager(userId: string, id: string): Promise<AthletesRole> {
    await this.requireActive(id);
    const role = await this.repository.managerRole(id, userId);
    if (role !== "FOUNDER" && role !== "MODERATOR")
      throw new AthletesError(
        "ATHLETES_MANAGER_REQUIRED",
        "Athletes Founder or Moderator access required",
      );
    return role;
  }
}
