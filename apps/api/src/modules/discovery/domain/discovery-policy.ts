import type { DiscoveryUrgency } from "@hooma/contracts/discovery";

export const DISCOVERY_REFRESH_SECONDS = 30;
export const DISCOVERY_LOOKAHEAD_HOURS = 72;
export const DISCOVERY_JUST_STARTED_MINUTES = 15;
export const DISCOVERY_STARTING_SOON_MINUTES = 30;
export const DISCOVERY_ENDING_SOON_MINUTES = 15;
export const DISCOVERY_FINAL_MINUTES = 5;
export const DISCOVERY_GAMER_ACTIVE_HOURS = 6;

const MINUTE = 60_000;

export function classifyTimedActivity(
  now: Date,
  startsAt: Date,
  endsAt: Date | null,
): DiscoveryUrgency | null {
  const untilStart = startsAt.getTime() - now.getTime();
  if (untilStart > 0) {
    return untilStart <= DISCOVERY_STARTING_SOON_MINUTES * MINUTE ? "STARTING_SOON" : "UPCOMING";
  }

  const elapsed = now.getTime() - startsAt.getTime();
  if (!endsAt) {
    return elapsed <= DISCOVERY_JUST_STARTED_MINUTES * MINUTE ? "JUST_STARTED" : null;
  }

  const remaining = endsAt.getTime() - now.getTime();
  if (remaining <= 0) return null;
  if (remaining <= DISCOVERY_FINAL_MINUTES * MINUTE) return "FINAL_MINUTES";
  if (remaining <= DISCOVERY_ENDING_SOON_MINUTES * MINUTE) return "ENDING_SOON";
  if (elapsed <= DISCOVERY_JUST_STARTED_MINUTES * MINUTE) return "JUST_STARTED";
  return "LIVE_NOW";
}

const urgencyRank: Readonly<Record<DiscoveryUrgency, number>> = {
  FINAL_MINUTES: 0,
  ENDING_SOON: 1,
  LIVE_NOW: 2,
  JUST_STARTED: 3,
  ACTIVE: 4,
  STARTING_SOON: 5,
  UPCOMING: 6,
};

export function compareUrgency(a: DiscoveryUrgency, b: DiscoveryUrgency): number {
  return urgencyRank[a] - urgencyRank[b];
}
