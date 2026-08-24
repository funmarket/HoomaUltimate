import type { TeamCapabilityInput } from "@hooma/contracts";

export type TeamResponsibility = "COACH" | "ASSISTANT";
export type TeamCapability = TeamCapabilityInput;

export const ALL_TEAM_CAPABILITIES: readonly TeamCapability[] = [
  "EDIT_TEAM",
  "MANAGE_ROSTER",
  "MANAGE_LINEUP",
  "CREATE_CHALLENGE",
  "RESPOND_TO_CHALLENGE",
  "MANAGE_TEAM_EVENTS",
];

export function directResponsibilityHasCapability(
  role: TeamResponsibility | null,
  grants: readonly TeamCapability[],
  capability: TeamCapability,
): boolean {
  if (role === "COACH") return true;
  return role === "ASSISTANT" && grants.includes(capability);
}
