export const TEST_PERSONAS = [
  "guest",
  "member",
  "player",
  "coach",
  "assistant",
  "ultras-leader",
  "gamer-squad-leader",
  "place-owner",
  "platform-admin",
] as const;

export type TestPersona = (typeof TEST_PERSONAS)[number];
