import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  AthletesCommunityCreateInput,
  AthletesCommunityUpdateInput,
} from "@hooma/contracts/athletes";
import type { AthletesRepository } from "../application/athletes.repository.js";
import { AthletesError } from "../domain/athletes-error.js";

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "athletes"
  );
}

function updateData(
  input: AthletesCommunityUpdateInput,
): Prisma.AthletesCommunityUncheckedUpdateInput {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.sport !== undefined ? { sport: input.sport } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.houma !== undefined ? { houma: input.houma } : {}),
    ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
    ...(input.bannerUrl !== undefined ? { bannerUrl: input.bannerUrl } : {}),
    ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    ...(input.joinPolicy !== undefined ? { joinPolicy: input.joinPolicy } : {}),
  };
}

const publicSelect = {
  id: true,
  slug: true,
  name: true,
  sport: true,
  description: true,
  city: true,
  houma: true,
  logoUrl: true,
  bannerUrl: true,
  visibility: true,
  joinPolicy: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { memberships: { where: { leftAt: null } } } },
} satisfies Prisma.AthletesCommunitySelect;

const joinRequestSelect = {
  id: true,
  athletesCommunityId: true,
  userId: true,
  status: true,
  requestedAt: true,
  resolvedAt: true,
  resolvedByUserId: true,
} satisfies Prisma.AthletesJoinRequestSelect;

type PublicRow = Prisma.AthletesCommunityGetPayload<{ select: typeof publicSelect }>;

function toPublic(row: PublicRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sport: row.sport,
    description: row.description,
    city: row.city,
    houma: row.houma,
    logoUrl: row.logoUrl,
    bannerUrl: row.bannerUrl,
    visibility: row.visibility,
    joinPolicy: row.joinPolicy,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    memberCount: row._count.memberships,
  };
}

async function reactivateMembership(
  tx: Prisma.TransactionClient,
  athletesCommunityId: string,
  userId: string,
  role: "FOUNDER" | "MODERATOR" | "MEMBER",
  joinedAt: Date,
) {
  const active = () =>
    tx.athletesMembership.findFirst({
      where: { athletesCommunityId, userId, leftAt: null },
      orderBy: { joinedAt: "desc" },
    });
  const existingActive = await active();
  if (existingActive) return existingActive;
  const previous = await tx.athletesMembership.findFirst({
    where: { athletesCommunityId, userId, leftAt: { not: null } },
    orderBy: { joinedAt: "desc" },
    select: { id: true },
  });
  try {
    if (previous) {
      return await tx.athletesMembership.update({
        where: { id: previous.id },
        data: { role, leftAt: null, joinedAt },
      });
    }
    return await tx.athletesMembership.create({
      data: { athletesCommunityId, userId, role, joinedAt },
    });
  } catch (error) {
    if (isPrismaUniqueConflict(error)) {
      const current = await active();
      if (current) return current;
    }
    throw error;
  }
}

function isPrismaUniqueConflict(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export class PrismaAthletesRepository implements AthletesRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPublic(input: Parameters<AthletesRepository["listPublic"]>[0]) {
    const rows = await this.db.athletesCommunity.findMany({
      where: { status: "ACTIVE", ...(input.sport ? { sport: input.sport } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: publicSelect,
    });
    return {
      items: rows.slice(0, input.limit).map(toPublic),
      nextCursor: rows.length > input.limit ? (rows[input.limit - 1]?.id ?? null) : null,
    };
  }

  async getPublic(id: string) {
    const row = await this.db.athletesCommunity.findFirst({
      where: { id, status: "ACTIVE" },
      select: publicSelect,
    });
    return row ? toPublic(row) : null;
  }

  async createWithFounder(userId: string, input: AthletesCommunityCreateInput) {
    const base = slugify(input.name);
    for (let suffix = 0; suffix < 10; suffix += 1) {
      const slug = suffix === 0 ? base : `${base}-${suffix}`;
      try {
        return await this.db.$transaction(async (tx) => {
          const community = await tx.athletesCommunity.create({
            data: {
              slug,
              name: input.name,
              sport: input.sport,
              visibility: input.visibility,
              joinPolicy: input.joinPolicy,
              createdByUserId: userId,
              ...(input.description !== undefined ? { description: input.description } : {}),
              ...(input.city !== undefined ? { city: input.city } : {}),
              ...(input.houma !== undefined ? { houma: input.houma } : {}),
              ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
              ...(input.bannerUrl !== undefined ? { bannerUrl: input.bannerUrl } : {}),
            },
          });
          await tx.athletesMembership.create({
            data: { athletesCommunityId: community.id, userId, role: "FOUNDER" },
          });
          return community;
        });
      } catch (error) {
        if (!isPrismaUniqueConflict(error)) throw error;
      }
    }
    throw new AthletesError("ATHLETES_CONFLICT", "Athletes community slug is already taken");
  }

  update(id: string, input: AthletesCommunityUpdateInput) {
    return this.db.athletesCommunity.update({ where: { id }, data: updateData(input) });
  }

  async archive(id: string) {
    const changed = await this.db.athletesCommunity.updateMany({
      where: { id, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });
    return changed.count > 0;
  }

  lifecycle(id: string) {
    return this.db.athletesCommunity.findUnique({ where: { id } });
  }

  async managerRole(id: string, userId: string) {
    const membership = await this.db.athletesMembership.findFirst({
      where: {
        athletesCommunityId: id,
        userId,
        leftAt: null,
        athletesCommunity: { status: "ACTIVE" },
      },
      select: { role: true },
    });
    return membership?.role ?? null;
  }

  activeRole(id: string, userId: string) {
    return this.managerRole(id, userId);
  }

  async joinOpen(id: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      const now = new Date();
      const membership = await reactivateMembership(tx, id, userId, "MEMBER", now);
      await tx.athletesJoinRequest.updateMany({
        where: { athletesCommunityId: id, userId, status: "PENDING" },
        data: { status: "APPROVED", resolvedAt: now, resolvedByUserId: userId },
      });
      return membership;
    });
  }

  async requestJoin(id: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.athletesMembership.findFirst({
        where: { athletesCommunityId: id, userId, leftAt: null },
        select: { role: true },
      });
      if (existing) return { kind: "MEMBERSHIP" as const, role: existing.role };
      const existingRequest = await tx.athletesJoinRequest.findFirst({
        where: { athletesCommunityId: id, userId, status: "PENDING" },
        select: joinRequestSelect,
      });
      if (existingRequest) return { kind: "REQUEST" as const, request: existingRequest };
      try {
        const request = await tx.athletesJoinRequest.create({
          data: { athletesCommunityId: id, userId },
          select: joinRequestSelect,
        });
        return { kind: "REQUEST" as const, request };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          isPrismaUniqueConflict(error)
        ) {
          const request = await tx.athletesJoinRequest.findFirst({
            where: { athletesCommunityId: id, userId, status: "PENDING" },
            select: joinRequestSelect,
          });
          if (request) return { kind: "REQUEST" as const, request };
        }
        throw error;
      }
    });
  }

  getJoinRequest(id: string, userId: string) {
    return this.db.athletesJoinRequest.findFirst({
      where: { athletesCommunityId: id, userId, status: "PENDING" },
      select: joinRequestSelect,
    });
  }

  async cancelJoinRequest(id: string, userId: string) {
    const changed = await this.db.athletesJoinRequest.updateMany({
      where: { athletesCommunityId: id, userId, status: "PENDING" },
      data: { status: "CANCELLED", resolvedAt: new Date(), resolvedByUserId: null },
    });
    return changed.count > 0;
  }

  async listJoinRequests(id: string) {
    const rows = await this.db.athletesJoinRequest.findMany({
      where: { athletesCommunityId: id, status: "PENDING" },
      orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
      select: {
        ...joinRequestSelect,
        requester: {
          select: {
            presentation: { select: { displayName: true, username: true, photoUrl: true } },
          },
        },
      },
    });
    return rows;
  }

  async resolveJoinRequest(
    id: string,
    targetUserId: string,
    resolverUserId: string,
    decision: "APPROVE" | "DECLINE",
  ) {
    return this.db.$transaction(async (tx) => {
      const now = new Date();
      const changed = await tx.athletesJoinRequest.updateMany({
        where: { athletesCommunityId: id, userId: targetUserId, status: "PENDING" },
        data: {
          status: decision === "APPROVE" ? "APPROVED" : "DECLINED",
          resolvedAt: now,
          resolvedByUserId: resolverUserId,
        },
      });
      if (!changed.count) return false;
      if (decision === "APPROVE") await reactivateMembership(tx, id, targetUserId, "MEMBER", now);
      return true;
    });
  }

  async listMembers(id: string) {
    const rows = await this.db.athletesMembership.findMany({
      where: { athletesCommunityId: id, leftAt: null, athletesCommunity: { status: "ACTIVE" } },
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
    });
    return rows.map((row) => ({
      userId: row.userId,
      role: row.role,
      joinedAt: row.joinedAt,
      presentation: row.user.presentation,
    }));
  }

  async addMemberByUsername(id: string, username: string, resolverUserId: string) {
    return this.db.$transaction(async (tx) => {
      const community = await tx.athletesCommunity.findFirst({
        where: { id, status: "ACTIVE" },
        select: { id: true },
      });
      if (!community) return null;
      const presentation = await tx.userPresentation.findUnique({
        where: { username },
        select: { userId: true, username: true },
      });
      if (!presentation) return null;
      const now = new Date();
      await reactivateMembership(tx, id, presentation.userId, "MEMBER", now);
      await tx.athletesJoinRequest.updateMany({
        where: { athletesCommunityId: id, userId: presentation.userId, status: "PENDING" },
        data: { status: "APPROVED", resolvedAt: now, resolvedByUserId: resolverUserId },
      });
      return presentation;
    });
  }

  async removeMember(id: string, targetUserId: string) {
    const changed = await this.db.athletesMembership.updateMany({
      where: { athletesCommunityId: id, userId: targetUserId, leftAt: null },
      data: { leftAt: new Date() },
    });
    return changed.count > 0;
  }

  async setRole(id: string, targetUserId: string, role: "MODERATOR" | "MEMBER") {
    const changed = await this.db.athletesMembership.updateMany({
      where: {
        athletesCommunityId: id,
        userId: targetUserId,
        leftAt: null,
        role: { not: "FOUNDER" },
      },
      data: { role },
    });
    return changed.count > 0;
  }
}
