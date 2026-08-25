import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("api"),
  version: z.string().min(1),
});

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9_.-]+$/);

export const displayNameSchema = z.string().trim().min(2).max(120);

export const registerSchema = z.object({
  loginUsername: usernameSchema,
  password: z.string().min(10).max(128),
  displayUsername: usernameSchema,
  email: z.string().trim().email().max(320).optional().nullable(),
  displayName: displayNameSchema.optional().nullable(),
});

export const loginSchema = z.object({
  loginUsername: usernameSchema,
  password: z.string().min(1).max(128),
});

export const sessionResponseSchema = z.object({ ok: z.literal(true) });

export const profilePresentationUpdateSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  photoUrl: z.string().trim().url().max(2000).nullable(),
  bio: z.string().trim().max(500).nullable(),
});

export const meResponseSchema = z.object({
  id: z.string(),
  presentation: z.object({
    username: z.string(),
    displayName: z.string(),
    photoUrl: z.string().url().nullable(),
    bio: z.string().nullable(),
  }),
  transports: z.array(z.enum(["web", "telegram"])),
  platformRoles: z.array(z.literal("PLATFORM_ADMIN")),
  communities: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      role: z.enum(["FOUNDER", "COACH", "MEMBER"]),
    }),
  ),
  teams: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      badgeUrl: z.string().url().nullable(),
      isPlayer: z.boolean(),
      responsibilities: z.array(z.enum(["COACH", "ASSISTANT"])),
      capabilities: z
        .array(
          z.enum([
            "EDIT_TEAM",
            "MANAGE_ROSTER",
            "MANAGE_LINEUP",
            "CREATE_CHALLENGE",
            "RESPOND_TO_CHALLENGE",
            "MANAGE_TEAM_EVENTS",
          ]),
        )
        .optional()
        .default([]),
    }),
  ),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfilePresentationUpdateInput = z.infer<typeof profilePresentationUpdateSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;

export const teamCapabilitySchema = z.enum([
  "EDIT_TEAM",
  "MANAGE_ROSTER",
  "MANAGE_LINEUP",
  "CREATE_CHALLENGE",
  "RESPOND_TO_CHALLENGE",
  "MANAGE_TEAM_EVENTS",
]);

export const teamCreateSchema = z.object({
  communityId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  motto: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  houma: z.string().trim().max(100).optional().nullable(),
  badgeUrl: z.string().url().max(2000).optional().nullable(),
  bannerUrl: z.string().url().max(2000).optional().nullable(),
});

export const teamUpdateSchema = teamCreateSchema.omit({ communityId: true }).partial();
export const teamPlayerSchema = z.object({ userId: z.string().min(1) });
export const teamAssistantSchema = z.object({
  userId: z.string().min(1),
  capabilities: z.array(teamCapabilitySchema).min(1).max(6),
});

export const footballFormatSchema = z.enum([
  "FIVE_V_FIVE",
  "SIX_V_SIX",
  "SEVEN_V_SEVEN",
  "EIGHT_V_EIGHT",
  "NINE_V_NINE",
  "ELEVEN_V_ELEVEN",
]);

export type FootballFormatInput = z.infer<typeof footballFormatSchema>;

export const FOOTBALL_FORMAT_PLAYER_COUNTS: Readonly<Record<FootballFormatInput, number>> = {
  FIVE_V_FIVE: 5,
  SIX_V_SIX: 6,
  SEVEN_V_SEVEN: 7,
  EIGHT_V_EIGHT: 8,
  NINE_V_NINE: 9,
  ELEVEN_V_ELEVEN: 11,
};

export const TEAM_STANDARD_FORMATIONS = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3"] as const;

export const TEAM_POSITION_ROLES = [
  "GK",
  "CB",
  "FB",
  "WB",
  "DM",
  "CM",
  "AM",
  "W",
  "ST",
  "ANY",
] as const;

export const teamFormationSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(
    /^\d+(?:-\d+){1,4}$/,
    "Formation must use numbers separated by hyphens, for example 4-3-3 or 4-2-3-1",
  );

export const teamLineupSlotSchema = z.object({
  teamPlayerId: z.string().min(1).optional().nullable(),
  position: z.enum(TEAM_POSITION_ROLES),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  isStarter: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(50).default(0),
});

export const teamLineupSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    formation: teamFormationSchema,
    matchFormat: footballFormatSchema,
    published: z.boolean().default(false),
    slots: z.array(teamLineupSlotSchema).min(1).max(30),
  })
  .superRefine((input, context) => {
    const expectedPlayers = FOOTBALL_FORMAT_PLAYER_COUNTS[input.matchFormat];
    const outfieldPlayers = input.formation
      .split("-")
      .map(Number)
      .reduce((total, count) => total + count, 0);

    if (outfieldPlayers !== expectedPlayers - 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["formation"],
        message: `Formation must contain ${expectedPlayers - 1} outfield players for ${expectedPlayers}v${expectedPlayers}`,
      });
    }

    if (input.slots.length !== expectedPlayers) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slots"],
        message: `Lineup must contain exactly ${expectedPlayers} slots for this match format`,
      });
    }
  });

export const teamChallengeCreateSchema = z
  .object({
    challengerTeamId: z.string().min(1),
    challengedTeamId: z.string().min(1),
    format: footballFormatSchema,
    proposedAt: z.string().datetime().optional().nullable(),
    proposedEndsAt: z.string().datetime().optional().nullable(),
    message: z.string().trim().max(300).optional().nullable(),
  })
  .superRefine((input, context) => {
    if (input.proposedEndsAt && !input.proposedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedEndsAt"],
        message: "proposedEndsAt requires proposedAt",
      });
    }
    if (
      input.proposedAt &&
      input.proposedEndsAt &&
      new Date(input.proposedEndsAt) <= new Date(input.proposedAt)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedEndsAt"],
        message: "proposedEndsAt must be after proposedAt",
      });
    }
  });
export const teamChallengeMessageSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

export type TeamCapabilityInput = z.infer<typeof teamCapabilitySchema>;
export type TeamCreateInput = z.infer<typeof teamCreateSchema>;
export type TeamUpdateInput = z.infer<typeof teamUpdateSchema>;
export type TeamLineupInput = z.infer<typeof teamLineupSchema>;
export type TeamLineupSlotInput = z.infer<typeof teamLineupSlotSchema>;
export type TeamChallengeCreateInput = z.infer<typeof teamChallengeCreateSchema>;

export const eventTypeSchema = z.enum(["PLAY", "WATCH"]);
export const eventStatusSchema = z.enum(["PUBLISHED", "CANCELLED", "COMPLETED"]);
export const skillLevelSchema = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "MIXED"]);
export const playPitchTypeSchema = z.enum([
  "FIVE_A_SIDE",
  "SEVEN_A_SIDE",
  "ELEVEN_A_SIDE",
  "FUTSAL",
  "STREET",
  "OTHER",
]);
export const eventCreateSchema = z
  .object({
    communityId: z.string().min(1),
    type: eventTypeSchema.default("PLAY"),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1200).optional().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().optional().nullable(),
    timezone: z.string().trim().min(1).max(80).default("Africa/Tunis"),
    venueName: z.string().trim().max(120).optional().nullable(),
    address: z.string().trim().max(240).optional().nullable(),
    capacity: z.number().int().positive().max(1000).optional().nullable(),
    waitlistEnabled: z.boolean().default(true),
    entryFeeMinor: z.number().int().min(0).max(100_000_000).default(0),
    currency: z.string().trim().length(3).default("TND"),
    play: z
      .object({
        pitchType: playPitchTypeSchema,
        skillLevel: skillLevelSchema.default("MIXED"),
        format: footballFormatSchema,
      })
      .optional()
      .nullable(),
  })
  .superRefine((input, context) => {
    if (input.type === "PLAY" && !input.play) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["play"],
        message: "Play details are required for PLAY events",
      });
    }
    if (input.type !== "PLAY" && input.play) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["play"],
        message: "Play details are only valid for PLAY events",
      });
    }
    if (input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "endsAt must be after startsAt",
      });
    }
  });
export const eventUpdateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1200).optional().nullable(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().nullable(),
  timezone: z.string().trim().min(1).max(80).optional(),
  venueName: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(240).optional().nullable(),
  capacity: z.number().int().positive().max(1000).optional().nullable(),
  waitlistEnabled: z.boolean().optional(),
});
export const eventFormationSchema = z.object({
  name: z.string().trim().min(1).max(80),
  format: footballFormatSchema,
  published: z.boolean().default(false),
  slots: z
    .array(
      z.object({
        userId: z.string().min(1).optional().nullable(),
        team: z.enum(["A", "B"]),
        position: z.string().trim().min(1).max(20),
        label: z.string().trim().min(1).max(32),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
      }),
    )
    .max(30),
});
export const eventCheckInSchema = z.object({
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});
export const eventChatMessageSchema = z.object({ body: z.string().trim().min(1).max(1200) });
export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
export type EventFormationInput = z.infer<typeof eventFormationSchema>;
