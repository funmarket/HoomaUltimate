import type { EventCreateInput, EventFormationInput, EventUpdateInput } from "@hooma/contracts";
import { Prisma, type PrismaClient } from "@hooma/database";
import { eventChatWindow } from "../domain/event-policy.js";
import type {
  EventAccessRecord,
  EventPublicListInput,
  EventRepository,
} from "../application/event.repository.js";

const publicEventSelect = Prisma.validator<Prisma.EventSelect>()({
  id: true,
  communityId: true,
  placeId: true,
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
  place: {
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
      city: true,
      houma: true,
      category: true,
      archivedAt: true,
      ownerships: { where: { revokedAt: null }, select: { userId: true } },
    },
  },
  playDetails: true,
  watchDetails: true,
  _count: {
    select: {
      rsvps: { where: { status: { in: ["CONFIRMED", "ATTENDED"] } } },
      checkIns: true,
    },
  },
});

const playerInviteSelect = Prisma.validator<Prisma.EventPlayerInviteSelect>()({
  id: true,
  eventId: true,
  targetUserId: true,
  invitedByUserId: true,
  status: true,
});

type PublicEventRow = Prisma.EventGetPayload<{ select: typeof publicEventSelect }>;
type CulturalDetails = {
  eventId: string;
  culturalCategory: string;
  imageUrl: string | null;
};

export class PrismaEventRepository implements EventRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPublic(input: EventPublicListInput) {
    const playVisibility: Prisma.EventWhereInput = input.viewerUserId
      ? {
          type: "PLAY",
          OR: [
            { community: { is: { visibility: "PUBLIC" } } },
            {
              community: {
                is: { memberships: { some: { userId: input.viewerUserId, leftAt: null } } },
              },
            },
          ],
        }
      : { type: "PLAY", community: { is: { visibility: "PUBLIC" } } };
    const watchVisibility: Prisma.EventWhereInput = {
      type: "WATCH",
      place: { is: { moderationStatus: "APPROVED", archivedAt: null } },
    };
    const visibility =
      input.type === "PLAY"
        ? playVisibility
        : input.type === "WATCH"
          ? watchVisibility
          : { OR: [playVisibility, watchVisibility] };

    const rows = await this.db.event.findMany({
      where: {
        ...visibility,
        status: "PUBLISHED",
        startsAt: { gte: input.from },
        ...(input.communityId ? { communityId: input.communityId } : {}),
        ...(input.placeId ? { placeId: input.placeId } : {}),
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: publicEventSelect,
    });
    const pageRows = rows.slice(0, input.limit);
    const culturalRows = pageRows.length
      ? await this.db.watchCulturalEventDetails.findMany({
          where: { eventId: { in: pageRows.map((event) => event.id) } },
        })
      : [];
    const placeIds = [
      ...new Set(pageRows.map((event) => event.placeId).filter((id): id is string => Boolean(id))),
    ];
    const placeImages = placeIds.length
      ? await this.db.placeImage.findMany({
          where: { placeId: { in: placeIds } },
          orderBy: [{ placeId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
          select: { placeId: true, imageUrl: true },
        })
      : [];
    const coverByPlace = new Map<string, string>();
    for (const image of placeImages) {
      if (!coverByPlace.has(image.placeId)) coverByPlace.set(image.placeId, image.imageUrl);
    }
    const culturalByEvent = new Map(culturalRows.map((details) => [details.eventId, details]));
    return {
      items: pageRows.map((event) =>
        serializePublicEvent(
          event,
          culturalByEvent.get(event.id),
          event.placeId ? (coverByPlace.get(event.placeId) ?? null) : null,
        ),
      ),
      nextCursor: rows.length > input.limit ? (rows[input.limit - 1]?.id ?? null) : null,
    };
  }

  async getPublic(eventId: string) {
    const row = await this.db.event.findFirst({
      where: {
        id: eventId,
        status: { in: ["PUBLISHED", "COMPLETED"] },
        OR: [
          { type: "PLAY" },
          {
            type: "WATCH",
            place: { is: { moderationStatus: "APPROVED", archivedAt: null } },
          },
        ],
      },
      select: publicEventSelect,
    });
    if (!row) return null;
    const [cultural, cover] = await Promise.all([
      row.type === "WATCH"
        ? this.db.watchCulturalEventDetails.findUnique({ where: { eventId } })
        : null,
      row.placeId
        ? this.db.placeImage.findFirst({
            where: { placeId: row.placeId },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: { imageUrl: true },
          })
        : null,
    ]);
    return serializePublicEvent(row, cultural ?? undefined, cover?.imageUrl ?? null);
  }

  async access(eventId: string): Promise<EventAccessRecord | null> {
    const event = await this.db.event.findUnique({
      where: { id: eventId },
      select: {
        communityId: true,
        placeId: true,
        type: true,
        createdByUserId: true,
        status: true,
        entryFeeMinor: true,
      },
    });
    if (!event) return null;
    if (event.type !== "WATCH") return { ...event, watchKind: null };
    const cultural = await this.db.watchCulturalEventDetails.findUnique({
      where: { eventId },
      select: { eventId: true },
    });
    return { ...event, watchKind: cultural ? "CULTURAL" : "MATCH" };
  }

  getRsvp(eventId: string, userId: string) {
    return this.db.eventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { status: true },
    });
  }

  async formationRoster(eventId: string) {
    const rows = await this.db.eventRsvp.findMany({
      where: { eventId, status: { in: ["CONFIRMED", "ATTENDED"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        userId: true,
        status: true,
        user: {
          select: {
            presentation: { select: { displayName: true, username: true, photoUrl: true } },
          },
        },
      },
    });
    return rows.map((row) => ({
      userId: row.userId,
      status: row.status as "CONFIRMED" | "ATTENDED",
      presentation: row.user.presentation,
    }));
  }

  async create(userId: string, input: EventCreateInput) {
    const startsAt = new Date(input.startsAt);
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    const chatWindow = eventChatWindow(startsAt, endsAt);
    const title =
      input.type === "WATCH" && input.watch?.kind === "MATCH"
        ? `${input.watch.teamOneName} vs ${input.watch.teamTwoName}`
        : input.title;
    return this.db.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          communityId: input.communityId ?? null,
          placeId: input.placeId ?? null,
          createdByUserId: userId,
          type: input.type,
          title,
          description: input.description ?? null,
          startsAt,
          endsAt,
          timezone: input.timezone,
          venueName: input.type === "PLAY" ? (input.venueName ?? null) : null,
          address: input.type === "PLAY" ? (input.address ?? null) : null,
          capacity: input.capacity ?? null,
          waitlistEnabled: input.waitlistEnabled,
          entryFeeMinor: BigInt(input.entryFeeMinor),
          currency: input.currency.toUpperCase(),
        },
      });
      if (input.type === "PLAY" && input.play) {
        await tx.playEventDetails.create({
          data: {
            eventId: event.id,
            pitchType: input.play.pitchType,
            skillLevel: input.play.skillLevel,
            format: input.play.format,
          },
        });
      }
      if (input.type === "WATCH" && input.watch?.kind === "MATCH") {
        await tx.watchEventDetails.create({
          data: {
            eventId: event.id,
            teamOneName: input.watch.teamOneName,
            teamOneLogoUrl: input.watch.teamOneLogoUrl ?? null,
            teamTwoName: input.watch.teamTwoName,
            teamTwoLogoUrl: input.watch.teamTwoLogoUrl ?? null,
          },
        });
      }
      if (input.type === "WATCH" && input.watch?.kind === "CULTURAL") {
        await tx.watchCulturalEventDetails.create({
          data: {
            eventId: event.id,
            culturalCategory: input.watch.culturalCategory,
            imageUrl: input.watch.imageUrl ?? null,
          },
        });
      }
      await tx.eventChatRoom.create({ data: { eventId: event.id, ...chatWindow } });
      const created = await tx.event.findUniqueOrThrow({
        where: { id: event.id },
        select: publicEventSelect,
      });
      const [cultural, cover] = await Promise.all([
        input.type === "WATCH" && input.watch?.kind === "CULTURAL"
          ? tx.watchCulturalEventDetails.findUnique({ where: { eventId: event.id } })
          : null,
        created.placeId
          ? tx.placeImage.findFirst({
              where: { placeId: created.placeId },
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
              select: { imageUrl: true },
            })
          : null,
      ]);
      return serializePublicEvent(created, cultural ?? undefined, cover?.imageUrl ?? null);
    });
  }

  async update(eventId: string, input: EventUpdateInput) {
    return this.db.$transaction(async (tx) => {
      const current = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
      const currentCultural =
        current.type === "WATCH"
          ? await tx.watchCulturalEventDetails.findUnique({ where: { eventId } })
          : null;
      const currentWatchKind =
        current.type === "WATCH" ? (currentCultural ? "CULTURAL" : "MATCH") : null;
      if (input.watch && currentWatchKind && input.watch.kind !== currentWatchKind) {
        throw new Error("WATCH_EVENT_KIND_IMMUTABLE");
      }
      const startsAt = input.startsAt ? new Date(input.startsAt) : current.startsAt;
      const endsAt =
        input.endsAt === undefined ? current.endsAt : input.endsAt ? new Date(input.endsAt) : null;
      if (endsAt && endsAt <= startsAt) throw new Error("EVENT_TIME_INVALID");
      const data: Prisma.EventUpdateInput = {
        ...(input.watch?.kind === "MATCH"
          ? { title: `${input.watch.teamOneName} vs ${input.watch.teamTwoName}` }
          : input.title !== undefined
            ? { title: input.title }
            : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.startsAt !== undefined ? { startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(current.type === "PLAY" && input.venueName !== undefined
          ? { venueName: input.venueName }
          : {}),
        ...(current.type === "PLAY" && input.address !== undefined
          ? { address: input.address }
          : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.waitlistEnabled !== undefined ? { waitlistEnabled: input.waitlistEnabled } : {}),
      };
      await tx.event.update({ where: { id: eventId }, data });
      if (current.type === "WATCH" && input.watch?.kind === "MATCH") {
        await tx.watchEventDetails.upsert({
          where: { eventId },
          create: {
            eventId,
            teamOneName: input.watch.teamOneName,
            teamOneLogoUrl: input.watch.teamOneLogoUrl ?? null,
            teamTwoName: input.watch.teamTwoName,
            teamTwoLogoUrl: input.watch.teamTwoLogoUrl ?? null,
          },
          update: {
            teamOneName: input.watch.teamOneName,
            teamOneLogoUrl: input.watch.teamOneLogoUrl ?? null,
            teamTwoName: input.watch.teamTwoName,
            teamTwoLogoUrl: input.watch.teamTwoLogoUrl ?? null,
          },
        });
      }
      if (current.type === "WATCH" && input.watch?.kind === "CULTURAL") {
        await tx.watchCulturalEventDetails.update({
          where: { eventId },
          data: {
            culturalCategory: input.watch.culturalCategory,
            imageUrl: input.watch.imageUrl ?? null,
          },
        });
      }
      await tx.eventChatRoom.update({
        where: { eventId },
        data: eventChatWindow(startsAt, endsAt),
      });
      const updated = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
        select: publicEventSelect,
      });
      const [cultural, cover] = await Promise.all([
        current.type === "WATCH"
          ? tx.watchCulturalEventDetails.findUnique({ where: { eventId } })
          : null,
        updated.placeId
          ? tx.placeImage.findFirst({
              where: { placeId: updated.placeId },
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
              select: { imageUrl: true },
            })
          : null,
      ]);
      return serializePublicEvent(updated, cultural ?? undefined, cover?.imageUrl ?? null);
    });
  }

  async cancel(eventId: string) {
    const now = new Date();
    await this.db.$transaction([
      this.db.event.update({ where: { id: eventId }, data: { status: "CANCELLED" } }),
      this.db.eventPlayerInvite.updateMany({
        where: { eventId, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: now },
      }),
    ]);
    return { cancelled: true };
  }

  async complete(eventId: string) {
    const now = new Date();
    await this.db.$transaction([
      this.db.event.update({ where: { id: eventId }, data: { status: "COMPLETED" } }),
      this.db.eventPlayerInvite.updateMany({
        where: { eventId, status: "PENDING" },
        data: { status: "CANCELLED", respondedAt: now },
      }),
    ]);
    return this.getPublic(eventId);
  }

  join(eventId: string, userId: string) {
    return this.db.$transaction((tx) => joinEvent(tx, eventId, userId));
  }

  async cancelRsvp(eventId: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      await lockEvent(tx, eventId);
      const existing = await tx.eventRsvp.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });
      if (!existing || existing.status === "CANCELLED")
        return { cancelled: false, promotedUserId: null };
      if (existing.status === "ATTENDED") throw new Error("RSVP_ALREADY_ATTENDED");
      await tx.eventRsvp.update({
        where: { id: existing.id },
        data: { status: "CANCELLED", waitlistSequence: null },
      });
      let promotedUserId: string | null = null;
      if (existing.status === "CONFIRMED") {
        const next = await tx.eventRsvp.findFirst({
          where: { eventId, status: "WAITLISTED" },
          orderBy: [{ waitlistSequence: "asc" }, { createdAt: "asc" }],
        });
        if (next) {
          await tx.eventRsvp.update({
            where: { id: next.id },
            data: { status: "CONFIRMED", waitlistSequence: null },
          });
          promotedUserId = next.userId;
        }
      }
      return { cancelled: true, promotedUserId };
    });
  }

  async listManagedPlayEvents(userId: string) {
    const rows = await this.db.event.findMany({
      where: {
        type: "PLAY",
        status: "PUBLISHED",
        OR: [
          { createdByUserId: userId },
          {
            community: {
              is: {
                memberships: {
                  some: { userId, leftAt: null, role: { in: ["FOUNDER", "COACH"] } },
                },
              },
            },
          },
        ],
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: publicEventSelect,
    });
    return rows.map((event) => serializePublicEvent(event));
  }

  upsertPlayerInvite(eventId: string, targetUserId: string, invitedByUserId: string) {
    return this.db.eventPlayerInvite.upsert({
      where: { eventId_targetUserId: { eventId, targetUserId } },
      create: { eventId, targetUserId, invitedByUserId },
      update: {
        invitedByUserId,
        status: "PENDING",
        respondedAt: null,
        createdAt: new Date(),
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            timezone: true,
            venueName: true,
            address: true,
          },
        },
      },
    });
  }

  listIncomingPlayerInvites(targetUserId: string) {
    return this.db.eventPlayerInvite.findMany({
      where: {
        targetUserId,
        status: "PENDING",
        event: { type: "PLAY", status: "PUBLISHED" },
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            timezone: true,
            venueName: true,
            address: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  listPendingPlayerInvitesForManager(userId: string) {
    return this.db.eventPlayerInvite.findMany({
      where: {
        status: "PENDING",
        event: {
          type: "PLAY",
          status: "PUBLISHED",
          OR: [
            { createdByUserId: userId },
            {
              community: {
                is: {
                  memberships: {
                    some: { userId, leftAt: null, role: { in: ["FOUNDER", "COACH"] } },
                  },
                },
              },
            },
          ],
        },
      },
      select: playerInviteSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  getPlayerInviteForTarget(inviteId: string, targetUserId: string) {
    return this.db.eventPlayerInvite.findFirst({
      where: { id: inviteId, targetUserId },
      select: playerInviteSelect,
    });
  }

  acceptPlayerInvite(inviteId: string, targetUserId: string) {
    return this.db.$transaction(async (tx) => {
      const invite = await tx.eventPlayerInvite.findFirst({
        where: { id: inviteId, targetUserId, status: "PENDING" },
        select: { eventId: true },
      });
      if (!invite) return null;
      const rsvp = await joinEvent(tx, invite.eventId, targetUserId);
      const changed = await tx.eventPlayerInvite.updateMany({
        where: { id: inviteId, targetUserId, status: "PENDING" },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      if (changed.count !== 1) throw new Error("EVENT_INVITE_STATE_CHANGED");
      const accepted = await tx.eventPlayerInvite.findUniqueOrThrow({
        where: { id: inviteId },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              startsAt: true,
              timezone: true,
              venueName: true,
              address: true,
            },
          },
        },
      });
      return { invite: accepted, rsvp };
    });
  }

  async declinePlayerInvite(inviteId: string, targetUserId: string) {
    return this.db.$transaction(async (tx) => {
      const changed = await tx.eventPlayerInvite.updateMany({
        where: { id: inviteId, targetUserId, status: "PENDING" },
        data: { status: "DECLINED", respondedAt: new Date() },
      });
      if (changed.count !== 1) return null;
      return tx.eventPlayerInvite.findUnique({
        where: { id: inviteId },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              startsAt: true,
              timezone: true,
              venueName: true,
              address: true,
            },
          },
        },
      });
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
        slots: { create: input.slots.map((slot) => ({ ...slot, userId: slot.userId ?? null })) },
      },
      include: { slots: { orderBy: [{ team: "asc" }, { position: "asc" }] } },
    });
  }

  async canViewMemberContent(eventId: string, userId: string): Promise<boolean> {
    return Boolean(
      await this.db.event.findFirst({
        where: {
          id: eventId,
          OR: [
            { createdByUserId: userId },
            {
              community: {
                is: {
                  memberships: {
                    some: { userId, leftAt: null, role: { in: ["FOUNDER", "COACH"] } },
                  },
                },
              },
            },
            {
              rsvps: { some: { userId, status: { in: ["CONFIRMED", "WAITLISTED", "ATTENDED"] } } },
            },
          ],
        },
        select: { id: true },
      }),
    );
  }

  listFormations(eventId: string) {
    return this.db.formation.findMany({
      where: { eventId },
      include: { slots: { orderBy: [{ team: "asc" }, { position: "asc" }] } },
      orderBy: { createdAt: "desc" },
    });
  }

  async checkIn(
    eventId: string,
    userId: string,
    latitude?: number | null,
    longitude?: number | null,
  ) {
    const rsvp = await this.db.eventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { status: true },
    });
    if (!rsvp || !["CONFIRMED", "ATTENDED"].includes(rsvp.status))
      throw new Error("EVENT_CHECK_IN_REQUIRES_CONFIRMED_RSVP");
    const checkedInAt = new Date();
    await this.db.$transaction([
      this.db.eventCheckIn.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId, latitude: latitude ?? null, longitude: longitude ?? null },
        update: { latitude: latitude ?? null, longitude: longitude ?? null },
      }),
      this.db.eventRsvp.update({
        where: { eventId_userId: { eventId, userId } },
        data: { status: "ATTENDED", checkedInAt },
      }),
    ]);
    return { checkedIn: true, checkedInAt };
  }

  async listChat(eventId: string, userId: string) {
    if (!(await this.canViewMemberContent(eventId, userId))) return null;
    const room = await this.db.eventChatRoom.findUnique({ where: { eventId } });
    if (!room) return null;
    const now = new Date();
    if (now < room.opensAt || now >= room.closesAt) return null;
    return this.db.eventChatMessage.findMany({
      where: { roomId: room.id, expiresAt: { gt: now } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 200,
    });
  }

  async postChat(eventId: string, userId: string, body: string) {
    if (!(await this.canViewMemberContent(eventId, userId))) return null;
    const room = await this.db.eventChatRoom.findUnique({ where: { eventId } });
    if (!room) return null;
    const now = new Date();
    if (now < room.opensAt || now >= room.closesAt) return null;
    return this.db.eventChatMessage.create({
      data: { roomId: room.id, userId, body, expiresAt: room.closesAt },
    });
  }
}

async function joinEvent(
  tx: Prisma.TransactionClient,
  eventId: string,
  userId: string,
): Promise<{ status: "CONFIRMED" | "WAITLISTED" }> {
  await lockEvent(tx, eventId);
  const event = await tx.event.findUniqueOrThrow({
    where: { id: eventId },
    select: { status: true, capacity: true, waitlistEnabled: true },
  });
  if (event.status !== "PUBLISHED") throw new Error("EVENT_NOT_ACTIVE");
  const existing = await tx.eventRsvp.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { status: true },
  });
  if (existing?.status === "CONFIRMED" || existing?.status === "ATTENDED") {
    return { status: "CONFIRMED" };
  }
  if (existing?.status === "WAITLISTED") return { status: "WAITLISTED" };
  const confirmed = await tx.eventRsvp.count({
    where: { eventId, status: { in: ["CONFIRMED", "ATTENDED"] } },
  });
  const hasSeat = event.capacity === null || confirmed < event.capacity;
  if (!hasSeat && !event.waitlistEnabled) throw new Error("EVENT_FULL");
  if (hasSeat) {
    await tx.eventRsvp.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, status: "CONFIRMED" },
      update: { status: "CONFIRMED", waitlistSequence: null, checkedInAt: null },
    });
    return { status: "CONFIRMED" };
  }
  const aggregate = await tx.eventRsvp.aggregate({
    where: { eventId, status: "WAITLISTED" },
    _max: { waitlistSequence: true },
  });
  const waitlistSequence = (aggregate._max.waitlistSequence ?? 0n) + 1n;
  await tx.eventRsvp.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId, status: "WAITLISTED", waitlistSequence },
    update: { status: "WAITLISTED", waitlistSequence, checkedInAt: null },
  });
  return { status: "WAITLISTED" };
}

async function lockEvent(tx: Prisma.TransactionClient, eventId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`,
  );
  if (rows.length === 0) throw new Error("EVENT_NOT_FOUND");
}

function serializePublicEvent(
  event: PublicEventRow,
  cultural?: CulturalDetails,
  canonicalPlaceImageUrl: string | null = null,
) {
  const publishedByVerifiedPlaceOwner = Boolean(
    event.place?.ownerships.some((ownership) => ownership.userId === event.createdByUserId),
  );
  const place = event.place
    ? {
        ...Object.fromEntries(
          Object.entries(event.place).filter(
            ([key]) => key !== "ownerships" && key !== "archivedAt",
          ),
        ),
        imageUrl: canonicalPlaceImageUrl,
      }
    : null;
  const watchDetails = cultural
    ? {
        kind: "CULTURAL" as const,
        culturalCategory: cultural.culturalCategory,
        imageUrl: cultural.imageUrl,
      }
    : event.watchDetails
      ? { kind: "MATCH" as const, ...event.watchDetails }
      : null;
  const output = {
    ...event,
    place,
    watchDetails,
    publisherAuthority:
      event.place === null
        ? null
        : publishedByVerifiedPlaceOwner
          ? "VERIFIED_PLACE_OWNER"
          : "COMMUNITY_PUBLISHER",
  };
  delete (output as { createdByUserId?: string }).createdByUserId;
  return JSON.parse(
    JSON.stringify(output, (_key, value) => (typeof value === "bigint" ? value.toString() : value)),
  );
}
