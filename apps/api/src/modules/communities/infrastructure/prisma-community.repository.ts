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
      select: { id: true, slug: true, name: true, description: true, city: true, houma: true, createdAt: true }
    });
    return { items: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1]?.id ?? null : null };
  }

  getPublic(id: string) {
    return this.db.community.findFirst({
      where: { id, status: "ACTIVE" },
      select: { id: true, slug: true, name: true, description: true, city: true, houma: true, _count: { select: { teams: { where: { status: "ACTIVE" } }, memberships: { where: { leftAt: null } } } } }
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

  async appointCoach(communityId: string, targetUserId: string): Promise<void> {
    const existing = await this.db.communityMembership.findUnique({ where: { communityId_userId: { communityId, userId: targetUserId } }, select: { role: true } });
    if (existing?.role === "FOUNDER") return;
    await this.db.communityMembership.upsert({
      where: { communityId_userId: { communityId, userId: targetUserId } },
      create: { communityId, userId: targetUserId, role: "COACH" },
      update: { role: "COACH", leftAt: null, joinedAt: new Date() }
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
