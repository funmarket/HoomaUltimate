import type { Prisma, PrismaClient } from "@hooma/database";
import type {
  CommunityCreateInput,
  CommunityRepository,
  CommunityUpdateInput
} from "../application/community.repository.js";

function slugify(value: string): string {
  return value.trim().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "hooma";
}

function communityUpdateData(input: CommunityUpdateInput): Prisma.CommunityUncheckedUpdateInput {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.houma !== undefined ? { houma: input.houma } : {}),
    ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
    ...(input.bannerUrl !== undefined ? { bannerUrl: input.bannerUrl } : {})
  };
}

export class PrismaCommunityRepository implements CommunityRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPublic(limit: number, cursor?: string) {
    const rows = await this.db.community.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, slug: true, name: true, description: true, city: true, houma: true, logoUrl: true, bannerUrl: true, createdAt: true }
    });
    return { items: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1]?.id ?? null : null };
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
        _count: { select: { teams: { where: { status: "ACTIVE" } }, memberships: { where: { leftAt: null } } } }
      }
    });
  }

  async create(userId: string, input: CommunityCreateInput) {
    const base = slugify(input.name);
    let slug = base;
    let suffix = 1;
    while (await this.db.community.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${suffix++}`;
    return this.db.$transaction(async (tx) => {
      const community = await tx.community.create({ data: { ...input, slug, createdByUserId: userId } });
      await tx.communityMembership.create({ data: { communityId: community.id, userId, role: "FOUNDER" } });
      return community;
    });
  }

  async lifecycle(communityId: string) {
    const community = await this.db.community.findUnique({
      where: { id: communityId },
      select: {
        createdByUserId: true,
        status: true,
        teams: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
        events: { where: { status: "PUBLISHED" }, select: { id: true }, take: 1 }
      }
    });
    if (!community) return null;
    return {
      createdByUserId: community.createdByUserId,
      status: community.status,
      hasActiveTeam: community.teams.length > 0,
      hasPublishedEvent: community.events.length > 0
    };
  }

  update(communityId: string, input: CommunityUpdateInput) {
    return this.db.community.update({
      where: { id: communityId },
      data: communityUpdateData(input)
    });
  }

  async archive(communityId: string): Promise<void> {
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      await tx.community.update({ where: { id: communityId }, data: { status: "ARCHIVED" } });
      await tx.communityMembership.updateMany({
        where: { communityId, leftAt: null },
        data: { leftAt: now }
      });
    });
  }

  async join(communityId: string, userId: string) {
    const community = await this.db.community.findFirst({ where: { id: communityId, status: "ACTIVE" }, select: { id: true } });
    if (!community) return null;
    const existing = await this.db.communityMembership.findUnique({
      where: { communityId_userId: { communityId, userId } },
      select: { role: true, leftAt: true }
    });
    if (existing && !existing.leftAt) return { role: existing.role };
    const membership = await this.db.communityMembership.upsert({
      where: { communityId_userId: { communityId, userId } },
      create: { communityId, userId, role: "MEMBER" },
      update: { role: "MEMBER", leftAt: null, joinedAt: new Date() },
      select: { role: true }
    });
    return membership;
  }

  async leave(communityId: string, userId: string): Promise<void> {
    await this.db.communityMembership.updateMany({
      where: { communityId, userId, leftAt: null, community: { status: "ACTIVE" } },
      data: { leftAt: new Date() }
    });
  }

  listMembers(communityId: string) {
    return this.db.communityMembership.findMany({
      where: { communityId, leftAt: null, community: { status: "ACTIVE" } },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      select: {
        userId: true,
        role: true,
        joinedAt: true,
        user: {
          select: {
            presentation: { select: { displayName: true, username: true, photoUrl: true } }
          }
        }
      }
    }).then((rows) => rows.map((row) => ({
      userId: row.userId,
      role: row.role,
      joinedAt: row.joinedAt,
      presentation: row.user.presentation
    })));
  }

  async removeMember(communityId: string, targetUserId: string): Promise<void> {
    await this.db.communityMembership.updateMany({
      where: { communityId, userId: targetUserId, leftAt: null, community: { status: "ACTIVE" } },
      data: { leftAt: new Date() }
    });
  }

  async appointCoach(communityId: string, targetUserId: string): Promise<void> {
    await this.db.communityMembership.updateMany({
      where: { communityId, userId: targetUserId, role: "MEMBER", leftAt: null, community: { status: "ACTIVE" } },
      data: { role: "COACH" }
    });
  }

  async revokeCoach(communityId: string, targetUserId: string): Promise<void> {
    await this.db.communityMembership.updateMany({
      where: { communityId, userId: targetUserId, role: "COACH", leftAt: null, community: { status: "ACTIVE" } },
      data: { role: "MEMBER" }
    });
  }

  async managerRole(communityId: string, userId: string) {
    const membership = await this.db.communityMembership.findFirst({
      where: { communityId, userId, leftAt: null, community: { status: "ACTIVE" } },
      select: { role: true }
    });
    return membership?.role ?? null;
  }
}
