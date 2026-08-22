import type {
  TeamCapabilityInput,
  TeamChallengeCreateInput,
  TeamCreateInput,
  TeamLineupInput,
  TeamUpdateInput
} from "@hooma/contracts";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers }
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? `Team request failed (${response.status})`);
  return body;
}

export type PublicTeamSummary = {
  id: string;
  slug: string;
  name: string;
  motto: string | null;
  city: string | null;
  houma: string | null;
  badgeUrl: string | null;
  communityId: string | null;
  _count: { players: number };
};

export type PublicTeamList = {
  items: PublicTeamSummary[];
  nextCursor: string | null;
};

export type ManagedTeam = {
  id: string;
  name: string;
  slug: string;
  badgeUrl: string | null;
  communityId: string | null;
  city: string | null;
  houma: string | null;
};

export type TeamControlDetail = {
  id: string;
  communityId: string | null;
  slug: string;
  name: string;
  motto: string | null;
  city: string | null;
  houma: string | null;
  badgeUrl: string | null;
  community: { id: string; name: string; slug: string } | null;
  players: {
    userId: string;
    joinedAt: string;
    user: { presentation: { displayName: string; username: string; photoUrl?: string | null } | null };
  }[];
  responsibilities: {
    userId: string;
    role: "COACH" | "ASSISTANT";
    user: { presentation: { displayName: string; username?: string } | null };
  }[];
};

export type TeamChallengeSummary = {
  id: string;
  challengerTeamId: string;
  challengedTeamId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  format: string;
  proposedAt: string | null;
  message: string | null;
  challengerTeam: { id: string; name: string };
  challengedTeam: { id: string; name: string };
  game?: { id: string; status?: string } | null;
};

export type TeamGameSummary = {
  id: string;
  challengeId: string;
  status: "SCHEDULING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  scheduledAt: string | null;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
};

export type TeamListFilters = {
  search?: string;
  city?: string;
  houma?: string;
  cursor?: string;
  limit?: number;
};

function publicListPath(filters: TeamListFilters = {}): string {
  const params = new URLSearchParams();
  const search = filters.search?.trim();
  const city = filters.city?.trim();
  const houma = filters.houma?.trim();
  if (search) params.set("search", search);
  if (city) params.set("city", city);
  if (houma) params.set("houma", houma);
  if (filters.cursor) params.set("cursor", filters.cursor);
  params.set("limit", String(filters.limit ?? 30));
  return `/api/public/v1/teams?${params.toString()}`;
}

export const teamApi = {
  publicList: (filters?: TeamListFilters) => request<PublicTeamList>(publicListPath(filters)),
  managed: () => request<ManagedTeam[]>("/api/v1/teams/managed"),
  publicDetail: (teamId: string) => request<TeamControlDetail>(`/api/public/v1/teams/${encodeURIComponent(teamId)}`),
  create: (input: TeamCreateInput) => request("/api/v1/teams", { method: "POST", body: JSON.stringify(input) }),
  update: (teamId: string, input: TeamUpdateInput) => request(`/api/v1/teams/${encodeURIComponent(teamId)}`, { method: "PATCH", body: JSON.stringify(input) }),
  addPlayer: (teamId: string, userId: string) => request(`/api/v1/teams/${encodeURIComponent(teamId)}/players`, { method: "POST", body: JSON.stringify({ userId }) }),
  removePlayer: (teamId: string, userId: string) => request(`/api/v1/teams/${encodeURIComponent(teamId)}/players/${encodeURIComponent(userId)}`, { method: "DELETE" }),
  assignAssistant: (teamId: string, userId: string, capabilities: readonly TeamCapabilityInput[]) => request(`/api/v1/teams/${encodeURIComponent(teamId)}/assistants`, { method: "POST", body: JSON.stringify({ userId, capabilities }) }),
  revokeAssistant: (teamId: string, userId: string) => request(`/api/v1/teams/${encodeURIComponent(teamId)}/assistants/${encodeURIComponent(userId)}`, { method: "DELETE" }),
  createLineup: (teamId: string, input: TeamLineupInput) => request(`/api/v1/teams/${encodeURIComponent(teamId)}/lineups`, { method: "POST", body: JSON.stringify(input) }),
  createChallenge: (input: TeamChallengeCreateInput) => request("/api/v1/teams/challenges", { method: "POST", body: JSON.stringify(input) }),
  incomingChallenges: () => request<TeamChallengeSummary[]>("/api/v1/teams/challenges/incoming"),
  outgoingChallenges: () => request<TeamChallengeSummary[]>("/api/v1/teams/challenges/outgoing"),
  games: () => request<TeamGameSummary[]>("/api/v1/teams/games"),
  acceptChallenge: (id: string) => request(`/api/v1/teams/challenges/${encodeURIComponent(id)}/accept`, { method: "POST" }),
  declineChallenge: (id: string) => request(`/api/v1/teams/challenges/${encodeURIComponent(id)}/decline`, { method: "POST" }),
  cancelChallenge: (id: string) => request(`/api/v1/teams/challenges/${encodeURIComponent(id)}/cancel`, { method: "POST" })
};
