import type { DiscoveryNowItem, DiscoveryNowResponse } from "@hooma/contracts/discovery";
import {
  DISCOVERY_GAMER_ACTIVE_HOURS,
  DISCOVERY_JUST_STARTED_MINUTES,
  DISCOVERY_LOOKAHEAD_HOURS,
  DISCOVERY_REFRESH_SECONDS,
  classifyTimedActivity,
  compareUrgency,
} from "../domain/discovery-policy.js";
import type { DiscoveryRecord, DiscoveryRepository } from "./discovery.repository.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export class DiscoveryService {
  constructor(private readonly repository: DiscoveryRepository) {}

  async now(
    now = new Date(),
    limit = 30,
    focusCommunityId?: string,
  ): Promise<DiscoveryNowResponse> {
    const safeLimit = Math.max(1, Math.min(limit, 50));
    const records = await this.repository.listCurrent({
      now,
      lookaheadUntil: new Date(now.getTime() + DISCOVERY_LOOKAHEAD_HOURS * HOUR),
      justStartedSince: new Date(now.getTime() - DISCOVERY_JUST_STARTED_MINUTES * MINUTE),
      gamerActiveSince: new Date(now.getTime() - DISCOVERY_GAMER_ACTIVE_HOURS * HOUR),
      limit: safeLimit * 3,
    });

    const items = records
      .map((record) => projectRecord(record, now))
      .filter((item): item is DiscoveryNowItem => item !== null)
      .sort((a, b) => compareItems(a, b, focusCommunityId))
      .slice(0, safeLimit);

    return {
      generatedAt: now.toISOString(),
      refreshAfterSeconds: DISCOVERY_REFRESH_SECONDS,
      items,
    };
  }
}

function projectRecord(record: DiscoveryRecord, now: Date): DiscoveryNowItem | null {
  if (record.kind === "EVENT") {
    const urgency = classifyTimedActivity(now, record.startsAt, record.endsAt);
    if (!urgency) return null;
    return {
      id: `events:${record.id}`,
      sourceDomain: "EVENTS",
      activityType: record.type === "PLAY" ? "PLAY_EVENT" : "WATCH_EVENT",
      sourceId: record.id,
      href: `/events/${encodeURIComponent(record.id)}`,
      title: record.title,
      summary: record.description,
      sourceLabel: record.type,
      urgency,
      startsAt: record.startsAt.toISOString(),
      endsAt: record.endsAt?.toISOString() ?? null,
      occurredAt: null,
      context: record.context,
    };
  }

  if (record.kind === "TEAM_GAME") {
    const urgency = classifyTimedActivity(now, record.scheduledAt, null);
    if (!urgency) return null;
    return {
      id: `teams:${record.id}`,
      sourceDomain: "TEAMS",
      activityType: "TEAM_GAME",
      sourceId: record.id,
      href: `/teams/${encodeURIComponent(record.homeTeamId)}`,
      title: `${record.homeTeamName} vs ${record.awayTeamName}`,
      summary: "Team match",
      sourceLabel: "TEAMS",
      urgency,
      startsAt: record.scheduledAt.toISOString(),
      endsAt: null,
      occurredAt: null,
      context: record.context,
    };
  }

  return {
    id: `gamers:${record.id}`,
    sourceDomain: "GAMERS",
    activityType: "GAMER_MATCH_READY",
    sourceId: record.id,
    href: `/gamers/games/${encodeURIComponent(record.gameSlug)}`,
    title: `${record.challengerName} vs ${record.challengedName}`,
    summary: `${record.gameName} · ${record.challengerHandle} vs ${record.challengedHandle}`,
    sourceLabel: "GAMERS",
    urgency: "ACTIVE",
    startsAt: null,
    endsAt: null,
    occurredAt: record.respondedAt.toISOString(),
    context: {
      communityId: null,
      communityName: null,
      city: null,
      houma: null,
    },
  };
}

function compareItems(a: DiscoveryNowItem, b: DiscoveryNowItem, focusCommunityId?: string): number {
  if (focusCommunityId) {
    const aFocused = a.context.communityId === focusCommunityId;
    const bFocused = b.context.communityId === focusCommunityId;
    if (aFocused !== bFocused) return aFocused ? -1 : 1;
  }

  const urgency = compareUrgency(a.urgency, b.urgency);
  if (urgency !== 0) return urgency;
  const aTime = Date.parse(a.startsAt ?? a.occurredAt ?? "9999-12-31T00:00:00.000Z");
  const bTime = Date.parse(b.startsAt ?? b.occurredAt ?? "9999-12-31T00:00:00.000Z");
  if (aTime !== bTime) return aTime - bTime;
  return a.id.localeCompare(b.id);
}
