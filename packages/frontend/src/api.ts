import type {
  LoginInput,
  MeResponse,
  ProfilePresentationUpdateInput,
  RegisterInput,
  TeamCapabilityInput,
  TeamChallengeCreateInput,
  TeamCreateInput,
  TeamLineupInput,
  TeamUpdateInput,
} from "@hooma/contracts";
import { request, type HoomaTransport } from "./http";

export { HoomaApiError, request } from "./http";
export type { HoomaTransport } from "./http";

export type PublicProfile = {
  presentation: {
    username: string;
    displayName: string;
    photoUrl: string | null;
    bio: string | null;
  };
  teams: {
    id: string;
    name: string;
    slug: string;
    badgeUrl: string | null;
  }[];
};
export type CommunityRole = "FOUNDER" | "COACH" | "MEMBER";
export type CommunityCreateInput = {
  name: string;
  description?: string | null;
  city?: string | null;
  houma?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
};
export type CommunityUpdateInput = Partial<CommunityCreateInput>;
export type PublicCommunitySummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  houma: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  createdAt: string;
};
export type PublicCommunityDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  houma: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  _count: { teams: number; memberships: number };
};
export type PublicCommunityList = { items: PublicCommunitySummary[]; nextCursor: string | null };
export type CreatedCommunity = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  houma: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};
export type CommunityMember = {
  userId: string;
  role: CommunityRole;
  joinedAt: string;
  presentation: { displayName: string; username: string; photoUrl: string | null } | null;
};
export type WhistleListItem = {
  id: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  expiresAt: string;
  author?: {
    presentation: { displayName: string; username: string; photoUrl: string | null } | null;
  };
};
export type WhistleList = { items: WhistleListItem[]; remainingToday: number; resetsAt: string };
export type PublicTeamSummary = {
  id: string;
  slug: string;
  name: string;
  motto: string | null;
  city: string | null;
  houma: string | null;
  badgeUrl: string | null;
  bannerUrl: string | null;
  communityId: string | null;
  _count: { players: number };
};
export type PublicTeamList = { items: PublicTeamSummary[]; nextCursor: string | null };
export type ManagedTeam = {
  id: string;
  name: string;
  slug: string;
  badgeUrl: string | null;
  bannerUrl: string | null;
  communityId: string | null;
  city: string | null;
  houma: string | null;
};
export type TeamRosterPlayer = {
  id: string;
  userId: string;
  shirtNumber: number | null;
  position: string | null;
  active: boolean;
  joinedAt: string;
  presentation: { displayName: string; username: string; photoUrl: string | null } | null;
};
export type TeamDetail = PublicTeamSummary & {
  bannerUrl: string | null;
  players: TeamRosterPlayer[];
};
export type TeamCapability =
  | "EDIT_TEAM"
  | "MANAGE_ROSTER"
  | "MANAGE_ASSISTANTS"
  | "MANAGE_LINEUP"
  | "CHALLENGE_TEAMS";
export type TeamAuthority = {
  teamId: string;
  responsibilities: string[];
  capabilities: TeamCapability[];
};
export type TeamLineupSlot = {
  id: string;
  teamPlayerId: string;
  x: number;
  y: number;
  role: string | null;
  player: TeamRosterPlayer;
};
export type TeamLineup = {
  teamId: string;
  formation: string | null;
  slots: TeamLineupSlot[];
};
export type TeamChallenge = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  message: string | null;
  proposedAt: string | null;
  createdAt: string;
  challengerTeam: { id: string; name: string; slug: string };
  challengedTeam: { id: string; name: string; slug: string };
};
export type TeamPlayerOffer = {
  id: string;
  teamId: string;
  playerUserId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  createdAt: string;
  team: { id: string; name: string; slug: string; badgeUrl: string | null };
  player: {
    id: string;
    presentation: { displayName: string; username: string; photoUrl: string | null } | null;
  };
};
export type TeamGame = {
  id: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
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
export type PlatformAdminOverview = {
  users: number;
  activePlatformAdmins: number;
  auditEntries: number;
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
    register: (input: RegisterInput) =>
      request<{ ok: true }>(transport, "/api/public/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    login: (input: LoginInput) =>
      request<{ ok: true }>(transport, "/api/public/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    logout: () => request<{ ok: true }>(transport, "/api/v1/auth/logout", { method: "POST" }),
    publicProfile: (username: string) =>
      request<PublicProfile>(transport, `/api/public/v1/profiles/${encodeURIComponent(username)}`),
    me: () => request<MeResponse>(transport, "/api/v1/me"),
    meOptional: () =>
      request<MeResponse | null>(transport, "/api/public/v1/auth/session"),
    updatePresentation: (input: ProfilePresentationUpdateInput) =>
      request<MeResponse>(transport, "/api/v1/me/presentation", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  };
  const platformAdmin = {
    overview: () => request<PlatformAdminOverview>(transport, "/api/v1/admin/overview"),
  };
  const communities = {
    publicList: () =>
      request<PublicCommunityList>(transport, "/api/public/v1/communities?limit=30"),
    publicDetail: (id: string) =>
      request<PublicCommunityDetail>(
        transport,
        `/api/public/v1/communities/${encodeURIComponent(id)}`,
      ),
    create: (input: CommunityCreateInput) =>
      request<CreatedCommunity>(transport, "/api/v1/communities", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: CommunityUpdateInput) =>
      request(transport, `/api/v1/communities/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    archive: (id: string) =>
      request<{ ok: true }>(transport, `/api/v1/communities/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    join: (id: string) =>
      request<{ membership: { role: CommunityRole } }>(
        transport,
        `/api/v1/communities/${encodeURIComponent(id)}/join`,
        {
          method: "POST",
        },
      ),
    leave: (id: string) =>
      request<{ ok: true }>(transport, `/api/v1/communities/${encodeURIComponent(id)}/membership`, {
        method: "DELETE",
      }),
    members: (id: string) =>
      request<CommunityMember[]>(
        transport,
        `/api/v1/communities/${encodeURIComponent(id)}/members`,
      ),
    removeMember: (id: string, userId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/communities/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      ),
    appointCoach: (id: string, userId: string) =>
      request<{ ok: true }>(transport, `/api/v1/communities/${encodeURIComponent(id)}/coaches`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    revokeCoach: (id: string, userId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/communities/${encodeURIComponent(id)}/coaches/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      ),
  };
  const whistles = {
    list: (communityId: string) =>
      request<WhistleList>(transport, `/api/v1/whistles/communities/${communityId}`),
    create: (communityId: string, body: string) =>
      request<{ id: string }>(transport, `/api/v1/whistles/communities/${communityId}`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    remove: (communityId: string, whistleId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/whistles/communities/${communityId}/${whistleId}`,
        { method: "DELETE" },
      ),
  };
  const teams = {
    publicList: (filters?: TeamListFilters) =>
      request<PublicTeamList>(transport, publicListPath(filters)),
    publicDetail: (id: string) =>
      request<TeamDetail>(transport, `/api/public/v1/teams/${encodeURIComponent(id)}`),
    create: (input: TeamCreateInput) =>
      request<PublicTeamSummary>(transport, "/api/v1/teams", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: TeamUpdateInput) =>
      request<PublicTeamSummary>(transport, `/api/v1/teams/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    managed: () => request<ManagedTeam[]>(transport, "/api/v1/teams/managed"),
    mine: () => request<PublicTeamSummary[]>(transport, "/api/v1/teams/mine"),
    roster: (id: string) =>
      request<TeamRosterPlayer[]>(transport, `/api/v1/teams/${encodeURIComponent(id)}/players`),
    addPlayer: (id: string, userId: string) =>
      request<TeamRosterPlayer>(transport, `/api/v1/teams/${encodeURIComponent(id)}/players`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    removePlayer: (id: string, playerId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/teams/${encodeURIComponent(id)}/players/${encodeURIComponent(playerId)}`,
        { method: "DELETE" },
      ),
    authority: (id: string) =>
      request<TeamAuthority>(transport, `/api/v1/teams/${encodeURIComponent(id)}/authority`),
    setCapabilities: (id: string, userId: string, input: TeamCapabilityInput) =>
      request<TeamAuthority>(
        transport,
        `/api/v1/teams/${encodeURIComponent(id)}/assistants/${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      ),
    removeAssistant: (id: string, userId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/teams/${encodeURIComponent(id)}/assistants/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      ),
    lineup: (id: string) =>
      request<TeamLineup>(transport, `/api/v1/teams/${encodeURIComponent(id)}/lineup`),
    saveLineup: (id: string, input: TeamLineupInput) =>
      request<TeamLineup>(transport, `/api/v1/teams/${encodeURIComponent(id)}/lineup`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    challenge: (id: string, input: TeamChallengeCreateInput) =>
      request<TeamChallenge>(transport, `/api/v1/teams/${encodeURIComponent(id)}/challenges`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    challengesIncoming: () =>
      request<TeamChallenge[]>(transport, "/api/v1/teams/challenges/incoming"),
    challengesOutgoing: () =>
      request<TeamChallenge[]>(transport, "/api/v1/teams/challenges/outgoing"),
    respondChallenge: (challengeId: string, action: "accept" | "decline") =>
      request<TeamChallenge>(transport, `/api/v1/teams/challenges/${challengeId}/${action}`, {
        method: "POST",
      }),
    games: () => request<TeamGame[]>(transport, "/api/v1/teams/games"),
    offersIncoming: () =>
      request<TeamPlayerOffer[]>(transport, "/api/v1/teams/offers/incoming"),
    offerPlayer: (teamId: string, playerUserId: string) =>
      request<TeamPlayerOffer>(transport, `/api/v1/teams/${encodeURIComponent(teamId)}/offers`, {
        method: "POST",
        body: JSON.stringify({ playerUserId }),
      }),
    respondOffer: (offerId: string, action: "accept" | "decline") =>
      request<TeamPlayerOffer>(transport, `/api/v1/teams/offers/${offerId}/${action}`, {
        method: "POST",
      }),
  };

  return { identity, platformAdmin, communities, whistles, teams };
}

export type HoomaApi = ReturnType<typeof createHoomaApi>;
