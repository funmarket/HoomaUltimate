import type { EventCreateInput, EventFormationInput, EventUpdateInput } from "@hooma/contracts";
import type { Prisma, PrismaClient } from "@hooma/database";
import { eventChatWindow } from "../domain/event-policy.js";
import type { EventAccessRecord, EventPublicListInput, EventRepository } from "../application/event.repository.js";

export class PrismaEventRepository implements EventRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPublic(input: EventPublicListInput) {
    const rows = await this.db.event.findMany({
      where: {
        status: "PUBLISHED",
        startsAt: { gte: input.from },
        ...(input.type ? { type: input.type } : {}),
        ...(input.communityId ? { communityId: input.communityId } : {})
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        communityId: true,
        type: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        venueName: true,
        address: true,
        capacity: true,
        waitlistEnabled: true,
        entryFeeMinor: true,
        currency: true,
        community: { select: { id: true, name: true, slug: true } },
        playDetails: true,
        _count: { select: { rsvps: { where: { status: { in: ["CONFIRMED", "ATTENDED"] } } } } }
      }
    });
    return {
      items: rows.slice(0, input.limit).map(serializeEvent),
      nextCursor: rows.length > input.limit ? rows[input.limit - 1]?.id ?? null : null
    };
  }

  async getPublic(eventId: string) {
    const row = await this.db.event.findFirst({
      where: { id: eventId, status: { in: ["PUBLISHED", "COMPLETED"] } },
      select: {
        id: true,
        communityId: true,
        createdByUserId: true,
        type: true,
        status: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        venueName: true,
        address: true,
        capacity: true,
        waitlistEnabled: true,
        entryFeeMinor: true,
        currency: true,
        community: { select: { id: true, name: true, slug: true } },
        playDetails: true,
        _count: {
          select: {
            rsvps: { where: { status: { in: ["CONFIRMED", "ATTENDED"] } } },
            checkIns: true
          }
        }
      }
    });
    return row ? serializeEvent(row) : null;
  }

  access(eventId: string): Promise<EventAccessRecord | null> {
    return this.db.event.findUnique({
      where: { id: eventId },
      select: { communityId: true, createdByUserId: true, status: true, entryFeeMinor: true }
    });
  }

  async create(userId: string, input: EventCreateInput) {
    const startsAt = new Date(input.startsAt);
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    const chatWindow = eventChatWindow(startsAt, endsAt);
    return this.db.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          communityId: input.communityId,
          createdByUserId: userId,
          type: input.type,
          title: input.title,
          description: input.description ?? null,
          startsAt,
          endsAt,
          timezone: input.timezone,
          venueName: input.venueName ?? null,
          address: input.address ?? null,
          capacity: input.capacity ?? null,
          waitlistEnabled: input.waitlistEnabled,
          entryFeeMinor: BigInt(input.entryFeeMinor),
          currency: input.currency.toUpperCase()
        }
      });
      if (input.type === "PLAY" && input.play) {
        await tx.playEventDetails.create({
          data: {
            eventId: event.id,
            pitchType: input.play.pitchType,
            skillLevel: input.play.skillLevel,
            format: input.play.format
          }
        });
      }
      await tx.eventChatRoom.create({ data: { eventId: event.id, ...chatWindow } });
      return serializeEvent(event);
    });
  }

  async update(eventId: string, input: EventUpdateInput) {
    return this.db.$transaction(async (tx) => {
      const current = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
      const startsAt = input.startsAt ? new Date(input.startsAt) : current.startsAt;
      const endsAt = input.endsAt === undefined ? current.endsAt : input.endsAt ? new Date(input.endsAt) : null;
      if (endsAt && endsAt <= startsAt) throw new Error("EVENT_TIME_INVALID");
      const event = await tx.event.update({
        where: { id: eventId },
        data: {
          ...input,
          ...(input.startsAt !== undefined ? { startsAt } : {}),
          ...(input.endsAt !== undefined ? { endsAt } : {})
        }
      });
      await tx.eventChatRoom.update({ where: { eventId }, data: eventChatWindow(startsAt, endsAt) });
      return serializeEvent(event);
    });
  }

  async cancel(eventId: string) {
    return serializeEvent(await this.db.event.update({ where: { id: eventId }, data: { status: "CANCELLED" } }));
  }

  async complete(eventId: string) {
    return serializeEvent(await this.db.event.update({ where: { id: eventId }, data: { status: "COMPLETED" } }));
  }

  async join(eventId: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      await lockEvent(tx, eventId);
      const event = await tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { status: true, capacity: true, waitlistEnabled: true } });
      if (event.status !== "PUBLISHED") throw new Error("EVENT_NOT_ACTIVE");
      const existing = await tx.eventRsvp.findUnique({ where: { eventId_userId: { eventId, userId } }, select: { status: true } });
      if (existing?.status === "CONFIRMED" || existing?.status === "ATTENDED") return { status: "CONFIRMED" as const };
      if (existing?.status === "WAITLISTED") return { status: "WAITLISTED" as const };

      const confirmed = await tx.eventRsvp.count({ where: { eventId, status: { in: ["CONFIRMED", "ATTENDED"] } } });
      const hasSeat = event.capacity === null || confirmed < event.capacity;
      if (!hasSeat && !event.waitlistEnabled) throw new Error("EVENT_FULL");

      if (hasSeat) {
        await tx.eventRsvp.upsert({
          where: { eventId_userId: { eventId, userId } },
          create: { eventId, userId, status: "CONFIRMED" },
          update: { status: "CONFIRMED", waitlistSequence: null, checkedInAt: null }
        });
        return { status: "CONFIRMED" as const };
      }

      const aggregate = await tx.eventRsvp.aggregate({ where: { eventId, status: "WAITLISTED" }, _max: { waitlistSequence: true } });
      const waitlistSequence = (aggregate._max.waitlistSequence ?? 0n) + 1n;
      await tx.eventRsvp.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId, status: "WAITLISTED", waitlistSequence },
        update: { status: "WAITLISTED", waitlistSequence, checkedInAt: null }
      });
      return { status: "WAITLISTED" as const };
    });
  }

  async cancelRsvp(eventId: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      await lockEvent(tx, eventId);
      const existing = await tx.eventRsvp.findUnique({ where: { eventId_userId: { eventId, userId } } });
      if (!existing || existing.status === "CANCELLED") return { cancelled: false, promotedUserId: null };
      if (existing.status === "ATTENDED") throw new Error("RSVP_ALREADY_ATTENDED");
      await tx.eventRsvp.update({ where: { id: existing.id }, data: { status: "CANCELLED", waitlistSequence: null } });
      let promotedUserId: string | null = null;
      if (existing.status === "CONFIRMED") {
        const next = await tx.eventRsvp.findFirst({ where: { eventId, status: "WAITLISTED" }, orderBy: [{ waitlistSequence: "asc" }, { createdAt: "asc" }] });
        if (next) {
          await tx.eventRsvp.update({ where: { id: next.id }, data: { status: "CONFIRMED", waitlistSequence: null } });
          promotedUserId = next.userId;
        }
      }
      return { cancelled: true, promotedUserId };
    });
  }

  createFormation(userId: string, eventId: string, input: EventFormationInput) {
    return this.db.formation.create({
      data: {
        eventId,
        createdByUserId: userId,
        name: input.name,
        format: input.format,
        published: input.published,
        slots: { create: input.slots.map((slot) => ({ ...slot, userId: slot.userId ?? null })) }
      },
      include: { slots: { orderBy: [{ team: "asc" }, { position: "asc" }] } }
    });
  }

  async canViewMemberContent(eventId: string, userId: string): Promise<boolean> {
    return Boolean(await this.db.event.findFirst({
      where: {
        id: eventId,
        OR: [
          { createdByUserId: userId },
          { community: { memberships: { some: { userId, leftAt: null, role: { in: ["FOUNDER", "COACH"] } } } } },
          { rsvps: { some: { userId, status: { in: ["CONFIRMED", "WAITLISTED", "ATTENDED"] } } } }
        ]
      },
      select: { id: true }
    }));
  }

  listFormations(eventId: string) {
    return this.db.formation.findMany({ where: { eventId }, include: { slots: true }, orderBy: { updatedAt: "desc" } });
  }

  async checkIn(eventId: string, userId: string, latitude?: number | null, longitude?: number | null) {
    return this.db.$transaction(async (tx) => {
      const rsvp = await tx.eventRsvp.findUnique({ where: { eventId_userId: { eventId, userId } } });
      if (!rsvp || !["CONFIRMED", "ATTENDED"].includes(rsvp.status)) throw new Error("RSVP_REQUIRED");
      const checkIn = await tx.eventCheckIn.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId, latitude: latitude ?? null, longitude: longitude ?? null },
        update: { latitude: latitude ?? null, longitude: longitude ?? null }
      });
      await tx.eventRsvp.update({ where: { id: rsvp.id }, data: { status: "ATTENDED", checkedInAt: checkIn.createdAt } });
      return checkIn;
    });
  }

  async listChat(eventId: string, userId: string) {
    const room = await this.authorizedOpenRoom(eventId, userId);
    if (!room) return null;
    const now = new Date();
    return this.db.eventChatMessage.findMany({
      where: { roomId: room.id, expiresAt: { gt: now } },
      select: { id: true, body: true, createdAt: true, userId: true, user: { select: { presentation: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 300
    });
  }

  async postChat(eventId: string, userId: string, body: string) {
    const room = await this.authorizedOpenRoom(eventId, userId);
    if (!room) return null;
    return this.db.eventChatMessage.create({
      data: { roomId: room.id, userId, body, expiresAt: room.closesAt },
      select: { id: true, body: true, createdAt: true, userId: true }
    });
  }

  private async authorizedOpenRoom(eventId: string, userId: string) {
    const now = new Date();
    const rsvp = await this.db.eventRsvp.findUnique({ where: { eventId_userId: { eventId, userId } }, select: { status: true } });
    if (!rsvp || !["CONFIRMED", "WAITLISTED", "ATTENDED"].includes(rsvp.status)) return null;
    return this.db.eventChatRoom.findFirst({ where: { eventId, opensAt: { lte: now }, closesAt: { gt: now } }, select: { id: true, closesAt: true } });
  }
}

async function lockEvent(tx: Prisma.TransactionClient, eventId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${eventId} FOR UPDATE`;
}

function serializeEvent<T extends { entryFeeMinor: bigint }>(event: T): Omit<T, "entryFeeMinor"> & { entryFeeMinor: number } {
  return { ...event, entryFeeMinor: Number(event.entryFeeMinor) };
}
