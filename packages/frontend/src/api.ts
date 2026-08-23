import type {
  MeResponse,
  TeamCapabilityInput,
  TeamChallengeCreateInput,
  TeamCreateInput,
  TeamLineupInput,
  TeamUpdateInput
} from "@hooma/contracts";

export class HoomaApiError extends Error {
  readonly code?: string;
  readonly status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "HoomaApiError";
    this.status = status;
    if (code !== undefined) this.code = code;
  }
}

export type HoomaTransport = {
  readonly baseUrl: string;
  readonly credentials?: RequestCredentials;
  readonly getHeaders?: () => HeadersInit;
  readonly onAuthenticationRequired?: () => void;
  readonly authenticationHref?: (returnTo: string) => string | null;
};

async function request<T>(transport: HoomaTransport, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${transport.baseUrl}${path}`, {
    ...init,
    ...(transport.credentials ? { credentials: transport.credentials } : {}),
    headers: {
      "content-type": "application/json",
      ...(transport.getHeaders?.() ?? {}),
      ...init?.headers
    }
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: { code?: string; message?: string };
  };
  if (!response.ok) {
    throw new HoomaApiError(
      body.error?.message ?? `Request failed (${response.status})`,
      response.status,
      body.error?.code
    );
  }
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
export type PublicTeamList = { items: PublicTeamSummary[]; nextCursor: string | null };
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

export function createHoomaApi(transport: HoomaTransport) {
  const identity = {
    me: () => request<MeResponse>(transport, "/api/v1/me"),
    async meOptional(): Promise<MeResponse | null> {
      try {
        return await request<MeResponse>(transport, "/api/v1/me");
      } catch (reason) {
        if (reason instanceof HoomaApiError && reason.status === 401) return null;
        throw reason;
      }
    }
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
  return { identity, teams };
}

export type HoomaApi = ReturnType<typeof createHoomaApi>;
