import type { Prisma, PrismaClient } from "@hooma/database";
import type {
  CommunityCreateRecordInput,
  CommunityJoinRequestRecord,
  CommunityRepository,
  CommunityUpdateRecordInput,
} from "../application/community.repository.js";

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "hooma"
  );
}

function communityUpdateData(
  input: CommunityUpdateRecordInput,
): Prisma.CommunityUncheckedUpdateInput {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.houma !== undefined ? { houma: input.houma } : {}),
    ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
    ...(input.bannerUrl !== undefined ? { bannerUrl: input.bannerUrl } : {}),
    ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    ...(input.joinPolicy !== undefined ? { joinPolicy: input.joinPolicy } : {}),
  };
}

const joinRequestSelect = {
  id: true,
  communityId: true,
  userId: true,
  status: true,
  requestedAt: true,
  resolvedAt: true,
} satisfies Prisma.CommunityJoinRequestSelect;

export class PrismaCommunityRepository implements CommunityRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPublic(limit: number, cursor?: string) {
    const rows = await this.db.community.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        city: true,
        houma: true,
        logoUrl: true,
        bannerUrl: true,
        visibility: true,
        createdAt: true,
      },
    });
    return {
      items: rows.slice(0, limit),
      nextCursor: rows.length > limit ? (rows[limit - 1]?.id ?? null) : null,
    };
  }

  getPublic(id: string) {
    return this.db.community.findFirst({
      where: { id, status: "ACTIVE" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        city: true,
        houma: true,
        logoUrl: true,
        bannerUrl: true,
        visibility: true,
        _count: {
          select: {
            teams: { where: { status: "ACTIVE" } },
            memberships: { where: { leftAt: null } },
          },
        },
      },
    });
  }

  async create(userId: string, input: CommunityCreateRecordInput) {
    const base = slugify(input.name);
    let slug = base;
    let suffix = 1;
    while (await this.db.community.findUnique({ where: { slug }, select: { id: true } }))
      slug = `${base}-${suffix++}`;
    return this.db.$transaction(async (tx) => {
      const community = await tx.community.create({
        data: { ...input, slug, createdByUserId: userId },
      });
      await tx.communityMembership.create({
        data: { communityId: community.id, userId, role: "FOUNDER" },
      });
      return community;
    });
  }

  async lifecycle(communityId: string) {
    const community = await this.db.community.findUnique({
      where: { id: communityId },
      select: {
        createdByUserId: true,
        status: true,
        visibility: true,
        joinPolicy: true,
        teams: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
        events: { where: { status: "PUBLISHED" }, select: { id: true }, take: 1 },
      },
    });
    if (!community) return null;
    return {
      createdByUserId: community.createdByUserId,
      status: community.status,
      visibility: community.visibility,
      joinPolicy: community.joinPolicy,
      hasActiveTeam: community.teams.length > 0,
      hasPublishedEvent: community.events.length > 0,
    };
  }

  membershipPolicy(communityId: string) {
    return this.db.community.findUnique({
      where: { id: communityId },
      select: { status: true, visibility: true, joinPolicy: true },
    });
  }

  update(communityId: string, input: CommunityUpdateRecordInput) {
    return this.db.community.update({
      where: { id: communityId },
      data: communityUpdateData(input),
    });
  }

  async archive(communityId: string): Promise<void> {
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      await tx.community.update({ where: { id: communityId }, data: { status: "ARCHIVED" } });
      await tx.communityMembership.updateMany({
        where: { communityId, leftAt: null },
        data: { leftAt: now },
      });
      await tx.communityJoinRequest.updateMany({
        where: { communityId, status: "PENDING" },
        data: { status: "CANCELLED", resolvedAt: now },
      });
    });
  }

  async joinOpen(communityId: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      const community = await tx.community.findFirst({
        where: { id: communityId, status: "ACTIVE", joinPolicy: "OPEN" },
        select: { id: true },
      });
      if (!community) return null;
      const existing = await tx.communityMembership.findUnique({
        where: { communityId_userId: { communityId, userId } },
        select: { role: true, leftAt: true },
      });
      let role = existing?.role ?? "MEMBER";
      if (!existing) {
        await tx.communityMembership.create({ data: { communityId, userId, role: "MEMBER" } });
        role = "MEMBER";
      } else if (existing.leftAt) {
        await tx.communityMembership.update({
          where: { communityId_userId: { communityId, userId } },
          data: { role: "MEMBER", leftAt: null, joinedAt: new Date() },
        });
        role = "MEMBER";
      }
      await tx.communityJoinRequest.updateMany({
        where: { communityId, userId, status: "PENDING" },
        data: { status: "APPROVED", resolvedAt: new Date(), resolvedByUserId: null },
      });
      return { role };
    });
  }

  async requestJoin(communityId: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      const community = await tx.community.findFirst({
        where: { id: communityId, status: "ACTIVE", joinPolicy: "APPROVAL_REQUIRED" },
        select: { id: true },
      });
      if (!community) return null;

      const membership = await tx.communityMembership.findUnique({
        where: { communityId_userId: { communityId, userId } },
        select: { role: true, leftAt: true },
      });
      if (membership && !membership.leftAt) {
        return { kind: "MEMBERSHIP" as const, role: membership.role };
      }

      const existing = await tx.communityJoinRequest.findUnique({
        where: { communityId_userId: { communityId, userId } },
        select: joinRequestSelect,
      });
      if (existing?.status === "PENDING") {
        return { kind: "REQUEST" as const, request: existing };
      }

      const requestedAt = new Date();
      const request = await tx.communityJoinRequest.upsert({
        where: { communityId_userId: { communityId, userId } },
        create: { communityId, userId, requestedAt },
        update: {
          status: "PENDING",
          requestedAt,
          resolvedAt: null,
          resolvedByUserId: null,
        },
        select: joinRequestSelect,
      });
      return { kind: "REQUEST" as const, request };
    });
  }

  getJoinRequest(communityId: string, userId: string) {
    return this.db.communityJoinRequest.findUnique({
      where: { communityId_userId: { communityId, userId } },
      select: joinRequestSelect,
    });
  }

  listJoinRequests(communityId: string) {
    return this.db.communityJoinRequest
      .findMany({
        where: { communityId, status: "PENDING", community: { status: "ACTIVE" } },
        orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
        select: {
          ...joinRequestSelect,
          requester: {
            select: {
              presentation: { select: { displayName: true, username: true, photoUrl: true } },
            },
          },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          communityId: row.communityId,
          userId: row.userId,
          status: row.status,
          requestedAt: row.requestedAt,
          resolvedAt: row.resolvedAt,
          presentation: row.requester.presentation,
        })),
      );
  }

  async resolveJoinRequest(
    communityId: string,
    targetUserId: string,
    resolverUserId: string,
    decision: "APPROVE" | "DECLINE",
  ): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const now = new Date();
      const changed = await tx.communityJoinRequest.updateMany({
        where: { communityId, userId: targetUserId, status: "PENDING" },
        data: {
          status: decision === "APPROVE" ? "APPROVED" : "DECLINED",
          resolvedAt: now,
          resolvedByUserId: resolverUserId,
        },
      });
      if (!changed.count) return false;
      if (decision === "APPROVE") {
        await reactivateMembership(tx, communityId, targetUserId, now);
      }
      return true;
    });
  }

  async cancelJoinRequest(communityId: string, userId: string): Promise<boolean> {
    const changed = await this.db.communityJoinRequest.updateMany({
      where: { communityId, userId, status: "PENDING" },
      data: { status: "CANCELLED", resolvedAt: new Date(), resolvedByUserId: null },
    });
    return changed.count > 0;
  }

  async addMemberByUsername(communityId: string, username: string, resolverUserId: string) {
    return this.db.$transaction(async (tx) => {
      const community = await tx.community.findFirst({
        where: { id: communityId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!community) return null;
      const presentation = await tx.userPresentation.findUnique({
        where: { username },
        select: { userId: true, username: true },
      });
      if (!presentation) return null;
      const now = new Date();
      await reactivateMembership(tx, communityId, presentation.userId, now);
      await tx.communityJoinRequest.updateMany({
        where: { communityId, userId: presentation.userId, status: "PENDING" },
        data: { status: "APPROVED", resolvedAt: now, resolvedByUserId: resolverUserId },
      });
      return presentation;
    });
  }

  async leave(communityId: string, userId: string): Promise<void> {
    await this.db.communityMembership.updateMany({
      where: { communityId, userId, leftAt: null, community: { status: "ACTIVE" } },
      data: { leftAt: new Date() },
    });
  }

  listMembers(communityId: string) {
    return this.db.communityMembership
      .findMany({
        where: { communityId, leftAt: null, community: { status: "ACTIVE" } },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        select: {
          userId: true,
          role: true,
          joinedAt: true,
          user: {
            select: {
              presentation: { select: { displayName: true, username: true, photoUrl: true } },
            },
          },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          userId: row.userId,
          role: row.role,
          joinedAt: row.joinedAt,
          presentation: row.user.presentation,
        })),
      );
  }

  async removeMember(communityId: string, targetUserId: string): Promise<void> {
    await this.db.communityMembership.updateMany({
      where: {
        communityId,
        userId: targetUserId,
        leftAt: null,
        community: { status: "ACTIVE" },
      },
      data: { leftAt: new Date() },
    });
  }

  async appointCoach(communityId: string, targetUserId: string): Promise<void> {
    await this.db.communityMembership.updateMany({
      where: {
        communityId,
        userId: targetUserId,
        role: "MEMBER",
        leftAt: null,
        community: { status: "ACTIVE" },
      },
      data: { role: "COACH" },
    });
  }

  async revokeCoach(communityId: string, targetUserId: string): Promise<void> {
    await this.db.communityMembership.updateMany({
      where: {
        communityId,
        userId: targetUserId,
        role: "COACH",
        leftAt: null,
        community: { status: "ACTIVE" },
      },
      data: { role: "MEMBER" },
    });
  }

  async managerRole(communityId: string, userId: string) {
    const membership = await this.db.communityMembership.findFirst({
      where: { communityId, userId, leftAt: null, community: { status: "ACTIVE" } },
      select: { role: true },
    });
    return membership?.role ?? null;
  }
}

async function reactivateMembership(
  tx: Prisma.TransactionClient,
  communityId: string,
  userId: string,
  joinedAt: Date,
): Promise<void> {
  const existing = await tx.communityMembership.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { leftAt: true },
  });
  if (!existing) {
    await tx.communityMembership.create({ data: { communityId, userId, role: "MEMBER", joinedAt } });
    return;
  }
  if (existing.leftAt) {
    await tx.communityMembership.update({
      where: { communityId_userId: { communityId, userId } },
      data: { role: "MEMBER", leftAt: null, joinedAt },
    });
  }
}
