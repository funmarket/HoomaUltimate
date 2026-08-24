import { z } from "zod";

export const discoverySourceDomainSchema = z.enum(["EVENTS", "TEAMS", "GAMERS"]);

export const discoveryActivityTypeSchema = z.enum([
  "PLAY_EVENT",
  "WATCH_EVENT",
  "TEAM_GAME",
  "GAMER_MATCH_READY",
]);

export const discoveryUrgencySchema = z.enum([
  "LIVE_NOW",
  "JUST_STARTED",
  "ACTIVE",
  "STARTING_SOON",
  "ENDING_SOON",
  "FINAL_MINUTES",
  "UPCOMING",
]);

export const discoveryContextSchema = z.object({
  communityId: z.string().min(1).nullable(),
  communityName: z.string().min(1).nullable(),
  city: z.string().min(1).nullable(),
  houma: z.string().min(1).nullable(),
});

export const discoveryNowItemSchema = z.object({
  id: z.string().min(1),
  sourceDomain: discoverySourceDomainSchema,
  activityType: discoveryActivityTypeSchema,
  sourceId: z.string().min(1),
  href: z.string().startsWith("/"),
  title: z.string().min(1),
  summary: z.string().nullable(),
  sourceLabel: z.string().min(1),
  urgency: discoveryUrgencySchema,
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  occurredAt: z.string().datetime().nullable(),
  context: discoveryContextSchema,
});

export const discoveryNowResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  refreshAfterSeconds: z.number().int().min(10).max(300),
  items: z.array(discoveryNowItemSchema),
});

export type DiscoverySourceDomain = z.infer<typeof discoverySourceDomainSchema>;
export type DiscoveryActivityType = z.infer<typeof discoveryActivityTypeSchema>;
export type DiscoveryUrgency = z.infer<typeof discoveryUrgencySchema>;
export type DiscoveryContext = z.infer<typeof discoveryContextSchema>;
export type DiscoveryNowItem = z.infer<typeof discoveryNowItemSchema>;
export type DiscoveryNowResponse = z.infer<typeof discoveryNowResponseSchema>;
