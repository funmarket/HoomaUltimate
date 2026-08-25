import type { PrismaClient } from "@hooma/database";
import type { DiscoveryRecord, DiscoveryRepository } from "../application/discovery.repository.js";

export class PrismaDiscoveryRepository implements DiscoveryRepository {
  constructor(private readonly db: PrismaClient) {}

  async listCurrent(input: {
    readonly now: Date;
    readonly lookaheadUntil: Date;
    readonly justStartedSince: Date;
    readonly gamerActiveSince: Date;
    readonly limit: number;
  }): Promise<DiscoveryRecord[]> {
    const [events, teamGames, gamerMatches] = await Promise.all([
      this.db.event.findMany({
        where: {
          status: "PUBLISHED",
          community: { visibility: "PUBLIC" },
          startsAt: { lte: input.lookaheadUntil },
          OR: [
            { startsAt: { gte: input.now } },
            { startsAt: { gte: input.justStartedSince } },
            { endsAt: { gt: input.now } },
          ],
        },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        take: input.limit,
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          startsAt: true,
          endsAt: true,
          community: {
            select: { id: true, name: true, city: true, houma: true },
          },
        },
      }),
      this.db.teamGame.findMany({
        where: {
          status: "CONFIRMED",
          scheduledAt: { lte: input.lookaheadUntil },
          AND: [
            {
              OR: [
                { scheduledAt: { gte: input.now } },
                { scheduledAt: { gte: input.justStartedSince } },
                { endsAt: { gt: input.now } },
              ],
            },
            {
              OR: [
                { homeTeam: { communityId: null } },
                { homeTeam: { community: { visibility: "PUBLIC" } } },
              ],
            },
          ],
        },
        orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
        take: input.limit,
        select: {
          id: true,
          scheduledAt: true,
          endsAt: true,
          homeTeam: {
            select: {
              id: true,
              name: true,
              city: true,
              houma: true,
              community: { select: { id: true, name: true, city: true, houma: true } },
            },
          },
          awayTeam: { select: { name: true } },
        },
      }),
      this.db.gamerChallenge.findMany({
        where: {
          status: "ACCEPTED",
          respondedAt: { gte: input.gamerActiveSince, lte: input.now },
        },
        orderBy: [{ respondedAt: "desc" }, { id: "asc" }],
        take: input.limit,
        select: {
          id: true,
          respondedAt: true,
          game: { select: { slug: true, name: true } },
          challengerProfile: {
            select: {
              handle: true,
              user: { select: { presentation: { select: { displayName: true } } } },
            },
          },
          challengedProfile: {
            select: {
              handle: true,
              user: { select: { presentation: { select: { displayName: true } } } },
            },
          },
        },
      }),
    ]);

    return [
      ...events.map((event): DiscoveryRecord => ({
        kind: "EVENT",
        id: event.id,
        type: event.type,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        context: {
          communityId: event.community.id,
          communityName: event.community.name,
          city: event.community.city,
          houma: event.community.houma,
        },
      })),
      ...teamGames.flatMap((game): DiscoveryRecord[] => {
        if (!game.scheduledAt) return [];
        const community = game.homeTeam.community;
        return [
          {
            kind: "TEAM_GAME",
            id: game.id,
            scheduledAt: game.scheduledAt,
            endsAt: game.endsAt,
            homeTeamId: game.homeTeam.id,
            homeTeamName: game.homeTeam.name,
            awayTeamName: game.awayTeam.name,
            context: {
              communityId: community?.id ?? null,
              communityName: community?.name ?? null,
              city: community?.city ?? game.homeTeam.city,
              houma: community?.houma ?? game.homeTeam.houma,
            },
          },
        ];
      }),
      ...gamerMatches.flatMap((match): DiscoveryRecord[] => {
        if (!match.respondedAt) return [];
        return [
          {
            kind: "GAMER_MATCH_READY",
            id: match.id,
            respondedAt: match.respondedAt,
            gameSlug: match.game.slug,
            gameName: match.game.name,
            challengerName:
              match.challengerProfile.user.presentation?.displayName ??
              match.challengerProfile.handle,
            challengedName:
              match.challengedProfile.user.presentation?.displayName ??
              match.challengedProfile.handle,
            challengerHandle: match.challengerProfile.handle,
            challengedHandle: match.challengedProfile.handle,
          },
        ];
      }),
    ];
  }
}
