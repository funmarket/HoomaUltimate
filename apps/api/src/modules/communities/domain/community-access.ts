export type CommunityManagerRole = "FOUNDER" | "COACH";

export function canManageCommunity(role: string | null | undefined): role is CommunityManagerRole {
  return role === "FOUNDER" || role === "COACH";
}
