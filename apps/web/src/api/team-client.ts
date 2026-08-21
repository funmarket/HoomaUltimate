import type {
  TeamCapabilityInput,
  TeamChallengeCreateInput,
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
  name: string;
  motto: string | null;
  city: string | null;
  houma: string | null;
  players: {
    userId: string;
    user: { presentation: { displayName: string; username: string } | null };
  }[];
  responsibilities: {
    userId: string;
    role: "COACH" | "ASSISTANT";
    user: { presentation: { displayName: string; username?: string } | null };
  }[];
};

export type TeamChallengeSummary = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  challengerTeam: { id: string; name: string };
  challengedTeam: { id: string; name: string };
};

export const teamApi = {
  managed: () => request<ManagedTeam[]>("/api/v1/teams/managed"),
  publicDetail: (teamId: string) => request<TeamControlDetail>(`/api/public/v1/teams/${encodeURIComponent(teamId)}`),
  update: (teamId: string, input: TeamUpdateInput) => request(`/api/v1/teams/${encodeURIComponent(teamId)}`, { method: "PATCH", body: JSON.stringify(input) }),
  addPlayer: (teamId: string, userId: string) => request(`/api/v1/teams/${encodeURIComponent(teamId)}/players`, { method: "POST", body: JSON.stringify({ userId }) }),
  removePlayer: (teamId: string, userId: string) => request(`/api/v1/teams/${encodeURIComponent(teamId)}/players/${encodeURIComponent(userId)}`, { method: "DELETE" }),
  assignAssistant: (teamId: string, userId: string, capabilities: readonly TeamCapabilityInput[]) => request(`/api/v1/teams/${encodeURIComponent(teamId)}/assistants`, { method: "POST", body: JSON.stringify({ userId, capabilities }) }),
  revokeAssistant: (teamId: string, userId: string) => request(`/api/v1/teams/${encodeURIComponent(teamId)}/assistants/${encodeURIComponent(userId)}`, { method: "DELETE" }),
  createLineup: (teamId: string, input: TeamLineupInput) => request(`/api/v1/teams/${encodeURIComponent(teamId)}/lineups`, { method: "POST", body: JSON.stringify(input) }),
  createChallenge: (input: TeamChallengeCreateInput) => request("/api/v1/teams/challenges", { method: "POST", body: JSON.stringify(input) }),
  incomingChallenges: () => request<TeamChallengeSummary[]>("/api/v1/teams/challenges/incoming"),
  outgoingChallenges: () => request<TeamChallengeSummary[]>("/api/v1/teams/challenges/outgoing"),
  acceptChallenge: (id: string) => request(`/api/v1/teams/challenges/${encodeURIComponent(id)}/accept`, { method: "POST" }),
  declineChallenge: (id: string) => request(`/api/v1/teams/challenges/${encodeURIComponent(id)}/decline`, { method: "POST" }),
  cancelChallenge: (id: string) => request(`/api/v1/teams/challenges/${encodeURIComponent(id)}/cancel`, { method: "POST" })
};
