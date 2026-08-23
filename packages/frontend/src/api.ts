import type {
  LoginInput,
  MeResponse,
  ProfilePresentationUpdateInput,
  RegisterInput,
  TeamCapabilityInput,
  TeamChallengeCreateInput,
  TeamCreateInput,
  TeamLineupInput,
  TeamUpdateInput
} from "@hooma/contracts";
import { HoomaApiError, request, type HoomaTransport } from "./http";

export { HoomaApiError, request } from "./http";
export type { HoomaTransport } from "./http";

export type CommunityRole = "FOUNDER" | "COACH" | "MEMBER";
export type CommunityCreateInput = { name: string; description?: string | null; city?: string | null; houma?: string | null; logoUrl?: string | null; bannerUrl?: string | null };
export type PublicCommunitySummary = { id: string; slug: string; name: string; description: string | null; city: string | null; houma: string | null; logoUrl: string | null; bannerUrl: string | null; createdAt: string };
export type PublicCommunityDetail = { id: string; slug: string; name: string; description: string | null; city: string | null; houma: string | null; logoUrl: string | null; bannerUrl: string | null; _count: { teams: number; memberships: number } };
export type PublicCommunityList = { items: PublicCommunitySummary[]; nextCursor: string | null };
export type CreatedCommunity = { id: string; slug: string; name: string; description: string | null; city: string | null; houma: string | null; logoUrl: string | null; bannerUrl: string | null; status: "ACTIVE" | "ARCHIVED"; createdByUserId: string; createdAt: string; updatedAt: string };
export type CommunityMember = { userId: string; role: CommunityRole; joinedAt: string; presentation: { displayName: string; username: string; photoUrl: string | null } | null };
export type WhistleListItem = { id: string; authorUserId: string; body: string; createdAt: string; expiresAt: string; author?: { presentation: { displayName: string; username: string; photoUrl: string | null } | null } };
export type WhistleList = { items: WhistleListItem[]; remainingToday: number; resetsAt: string };
export type PublicTeamSummary = { id: string; slug: string; name: string; motto: string | null; city: string | null; houma: string | null; badgeUrl: string | null; communityId: string | null; _count: { players: number } };
export type PublicTeamList = { items: PublicTeamSummary[]; nextCursor: string | null };
export type ManagedTeam = { id: string; name: string; slug: string; badgeUrl: string | null; communityId: string | null; city: string | null; houma: string | null };
export type TeamControlDetail = {
  id: string; communityId: string | null; slug: string; name: string; motto: string | null; city: string | null; houma: string | null; badgeUrl: string | null;
  community: { id: string; name: string; slug: string } | null;
  players: { userId: string; joinedAt: string; user: { presentation: { displayName: string; username: string; photoUrl?: string | null } | null } }[];
  responsibilities: { userId: string; role: "COACH" | "ASSISTANT"; user: { presentation: { displayName: string; username?: string } | null } }[];
};
export type TeamChallengeSummary = { id: string; challengerTeamId: string; challengedTeamId: string; status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED"; format: string; proposedAt: string | null; message: string | null; challengerTeam: { id: string; name: string }; challengedTeam: { id: string; name: string }; game?: { id: string; status?: string } | null };
export type TeamGameSummary = { id: string; challengeId: string; status: "SCHEDULING" | "CONFIRMED" | "COMPLETED" | "CANCELLED"; scheduledAt: string | null; homeTeam: { id: string; name: string }; awayTeam: { id: string; name: string } };
export type TeamListFilters = { search?: string; city?: string; houma?: string; cursor?: string; limit?: number };
export type PlatformAdminOverview = { users: number; activePlatformAdmins: number; auditEntries: number };

function publicListPath(filters: TeamListFilters = {}): string {
  const params = new URLSearchParams();
  const search = filters.search?.trim(); const city = filters.city?.trim(); const houma = filters.houma?.trim();
  if (search) params.set("search", search); if (city) params.set("city", city); if (houma) params.set("houma", houma); if (filters.cursor) params.set("cursor", filters.cursor);
  params.set("limit", String(filters.limit ?? 30));
  return `/api/public/v1/teams?${params.toString()}`;
}

export function createHoomaApi(transport: HoomaTransport) {
  const identity = {
    register: (input: RegisterInput) => request<{ ok: true }>(transport, "/api/public/v1/auth/register", { method: "POST", body: JSON.stringify(input) }),
    login: (input: LoginInput) => request<{ ok: true }>(transport, "/api/public/v1/auth/login", { method: "POST", body: JSON.stringify(input) }),
    logout: () => request<{ ok: true }>(transport, "/api/v1/auth/logout", { method: "POST" }),
    me: () => request<MeResponse>(transport, "/api/v1/me"),
    async meOptional(): Promise<MeResponse | null> {
      try { return await request<MeResponse>(transport, "/api/v1/me"); }
      catch (reason) { if (reason instanceof HoomaApiError && reason.status === 401) return null; throw reason; }
    },
    updatePresentation: (input: ProfilePresentationUpdateInput) => request<MeResponse>(transport, "/api/v1/me/presentation", { method: "PATCH", body: JSON.stringify(input) })
  };
  const platformAdmin = {
    overview: () => request<PlatformAdminOverview>(transport, "/api/v1/admin/overview")
  };
  const communities = {
    publicList: () => request<PublicCommunityList>(transport, "/api/public/v1/communities?limit=30"),
    publicDetail: (id: string) => request<PublicCommunityDetail>(transport, `/api/public/v1/communities/${encodeURIComponent(id)}`),
    create: (input: CommunityCreateInput) => request<CreatedCommunity>(transport, "/api/v1/communities", { method: "POST", body: JSON.stringify(input) }),
    join: (id: string) => request<{ membership: { role: CommunityRole } }>(transport, `/api/v1/communities/${encodeURIComponent(id)}/join`, { method: "POST" }),
    leave: (id: string) => request<{ ok: true }>(transport, `/api/v1/communities/${encodeURIComponent(id)}/membership`, { method: "DELETE" }),
    members: (id: string) => request<CommunityMember[]>(transport, `/api/v1/communities/${encodeURIComponent(id)}/members`),
    removeMember: (id: string, userId: string) => request<{ ok: true }>(transport, `/api/v1/communities/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" }),
    appointCoach: (id: string, userId: string) => request<{ ok: true }>(transport, `/api/v1/communities/${encodeURIComponent(id)}/coaches`, { method: "POST", body: JSON.stringify({ userId }) }),
    revokeCoach: (id: string, userId: string) => request<{ ok: true }>(transport, `/api/v1/communities/${encodeURIComponent(id)}/coaches/${encodeURIComponent(userId)}`, { method: "DELETE" })
  };
  const whistles = {
    community: (communityId: string) => request<WhistleList>(transport, `/api/v1/whistles/contexts/COMMUNITY/${encodeURIComponent(communityId)}`),
    sendToCommunity: (communityId: string, body: string) => request<{ whistle: WhistleListItem; remainingToday: number; resetsAt: string }>(transport, `/api/v1/whistles/contexts/COMMUNITY/${encodeURIComponent(communityId)}`, { method: "POST", body: JSON.stringify({ body }) }),
    event: (eventId: string) => request<WhistleList>(transport, `/api/v1/whistles/contexts/EVENT/${encodeURIComponent(eventId)}`),
    sendToEvent: (eventId: string, body: string) => request<{ whistle: WhistleListItem; remainingToday: number; resetsAt: string }>(transport, `/api/v1/whistles/contexts/EVENT/${encodeURIComponent(eventId)}`, { method: "POST", body: JSON.stringify({ body }) })
  };
  const teams = {
    publicList: (filters?: TeamListFilters) => request<PublicTeamList>(transport, publicListPath(filters)),
    managed: () => request<ManagedTeam[]>(transport, "/api/v1/teams/managed"),
    publicDetail: (teamId: string) => request<TeamControlDetail>(transport, `/api/public/v1/teams/${encodeURIComponent(teamId)}`),
    create: (input: TeamCreateInput) => request(transport, "/api/v1/teams", { method: "POST", body: JSON.stringify(input) }),
    update: (teamId: string, input: TeamUpdateInput) => request(transport, `/api/v1/teams/${encodeURIComponent(teamId)}`, { method: "PATCH", body: JSON.stringify(input) }),
    addPlayer: (teamId: string, userId: string) => request(transport, `/api/v1/teams/${encodeURIComponent(teamId)}/players`, { method: "POST", body: JSON.stringify({ userId }) }),
    removePlayer: (teamId: string, userId: string) => request(transport, `/api/v1/teams/${encodeURIComponent(teamId)}/players/${encodeURIComponent(userId)}`, { method: "DELETE" }),
    assignAssistant: (teamId: string, userId: string, capabilities: readonly TeamCapabilityInput[]) => request(transport, `/api/v1/teams/${encodeURIComponent(teamId)}/assistants`, { method: "POST", body: JSON.stringify({ userId, capabilities }) }),
    revokeAssistant: (teamId: string, userId: string) => request(transport, `/api/v1/teams/${encodeURIComponent(teamId)}/assistants/${encodeURIComponent(userId)}`, { method: "DELETE" }),
    createLineup: (teamId: string, input: TeamLineupInput) => request(transport, `/api/v1/teams/${encodeURIComponent(teamId)}/lineups`, { method: "POST", body: JSON.stringify(input) }),
    createChallenge: (input: TeamChallengeCreateInput) => request(transport, "/api/v1/teams/challenges", { method: "POST", body: JSON.stringify(input) }),
    incomingChallenges: () => request<TeamChallengeSummary[]>(transport, "/api/v1/teams/challenges/incoming"),
    outgoingChallenges: () => request<TeamChallengeSummary[]>(transport, "/api/v1/teams/challenges/outgoing"),
    games: () => request<TeamGameSummary[]>(transport, "/api/v1/teams/games"),
    acceptChallenge: (id: string) => request(transport, `/api/v1/teams/challenges/${encodeURIComponent(id)}/accept`, { method: "POST" }),
    declineChallenge: (id: string) => request(transport, `/api/v1/teams/challenges/${encodeURIComponent(id)}/decline`, { method: "POST" }),
    cancelChallenge: (id: string) => request(transport, `/api/v1/teams/challenges/${encodeURIComponent(id)}/cancel`, { method: "POST" })
  };
  return { identity, platformAdmin, communities, whistles, teams };
}
export type HoomaApi = ReturnType<typeof createHoomaApi>;
