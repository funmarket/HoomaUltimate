import type { PrismaClient } from "@hooma/database";
import type { CommunityCreateInput, CommunityRepository } from "../application/community.repository.js";

function slugify(value: string): string {
  return value.trim().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "hooma";
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
      where: { communityId, userId, leftAt: null },
      data: { leftAt: new Date() }
    });
  }

  listMembers(communityId: string) {
    return this.db.communityMembership.findMany({
      where: { communityId, leftAt: null },
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
      where: { communityId, userId: targetUserId, leftAt: null },
      data: { leftAt: new Date() }
    });
  }

  async appointCoach(communityId: string, targetUserId: string): Promise<void> {
    await this.db.communityMembership.updateMany({
      where: { communityId, userId: targetUserId, role: "MEMBER", leftAt: null },
      data: { role: "COACH" }
    });
  }

  async revokeCoach(communityId: string, targetUserId: string): Promise<void> {
    await this.db.communityMembership.updateMany({ where: { communityId, userId: targetUserId, role: "COACH", leftAt: null }, data: { role: "MEMBER" } });
  }

  async managerRole(communityId: string, userId: string) {
    const membership = await this.db.communityMembership.findUnique({ where: { communityId_userId: { communityId, userId } }, select: { role: true, leftAt: true } });
    return membership && !membership.leftAt ? membership.role : null;
  }
}
