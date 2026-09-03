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
import type {
  AthletesCommunityCreateInput,
  AthletesCommunityUpdateInput,
  AthletesJoinRequest,
  AthletesJoinRequestForManager,
  AthletesJoinResult,
  AthletesMember,
  AthletesPublicDetail,
  AthletesPublicSummary,
  AthletesSport,
} from "@hooma/contracts/athletes";
import type {
  CommunityCreateInput,
  CommunityJoinRequest,
  CommunityJoinRequestForFounder,
  CommunityJoinResult,
  CommunityPublicDetail,
  CommunityPublicSummary,
  CommunityRole,
  CommunityUpdateInput,
  CommunityVisibility,
} from "@hooma/contracts/communities";
import { request, type HoomaTransport } from "./http";

import { HoomaApiError } from "./http";
export { HoomaApiError, request } from "./http";
export type { HoomaTransport } from "./http";
export type {
  CommunityCreateInput,
  CommunityJoinRequest,
  CommunityJoinRequestForFounder,
  CommunityJoinResult,
  CommunityRole,
  CommunityUpdateInput,
  CommunityVisibility,
};

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
export type PublicCommunitySummary = CommunityPublicSummary;
export type PublicCommunityDetail = CommunityPublicDetail;
export type PublicCommunityList = { items: PublicCommunitySummary[]; nextCursor: string | null };
export type PublicAthletesSummary = AthletesPublicSummary;
export type PublicAthletesDetail = AthletesPublicDetail;
export type PublicAthletesList = { items: PublicAthletesSummary[]; nextCursor: string | null };
export type CreatedCommunity = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  houma: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  visibility: CommunityVisibility;
  joinPolicy: "OPEN" | "APPROVAL_REQUIRED";
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
  joinedAt: string;
  user: {
    presentation: { displayName: string; username: string; photoUrl?: string | null } | null;
  };
};
export type TeamLineupSlotView = {
  id?: string;
  teamPlayerId: string | null;
  position: string;
  x: number;
  y: number;
  isStarter: boolean;
  sortOrder: number;
};
export type TeamLineupView = {
  id: string;
  name: string;
  formation: string;
  matchFormat: string;
  published: boolean;
  isCurrent: boolean;
  updatedAt?: string;
  slots: TeamLineupSlotView[];
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
  bannerUrl: string | null;
  community: { id: string; name: string; slug: string } | null;
  players: TeamRosterPlayer[];
  responsibilities: {
    userId: string;
    role: "COACH" | "ASSISTANT";
    user: { presentation: { displayName: string; username?: string } | null };
  }[];
  lineups?: TeamLineupView[];
};
export type TeamGamePlace = {
  id: string;
  name: string;
  address: string;
  city: string | null;
  houma: string | null;
};
export type TeamChallengeSummary = {
  id: string;
  challengerTeamId: string;
  challengedTeamId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  format: string;
  proposedAt: string | null;
  proposedEndsAt?: string | null;
  placeId: string | null;
  venueName: string | null;
  address: string | null;
  place: TeamGamePlace | null;
  message: string | null;
  challengerTeam: { id: string; name: string };
  challengedTeam: { id: string; name: string };
  game?: { id: string; status?: string; place?: TeamGamePlace | null } | null;
};
export type TeamGameSummary = {
  id: string;
  challengeId: string;
  status: "SCHEDULING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  scheduledAt: string | null;
  endsAt?: string | null;
  placeId: string | null;
  venueName: string | null;
  address: string | null;
  place: TeamGamePlace | null;
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

function athletesPublicListPath(
  filters: { sport?: AthletesSport; cursor?: string; limit?: number } = {},
): string {
  const params = new URLSearchParams();
  if (filters.sport) params.set("sport", filters.sport);
  if (filters.cursor) params.set("cursor", filters.cursor);
  params.set("limit", String(filters.limit ?? 30));
  return `/api/public/v1/athletes?${params.toString()}`;
}

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
    meOptional: () => request<MeResponse | null>(transport, "/api/public/v1/auth/session"),
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
      request<CreatedCommunity>(transport, `/api/v1/communities/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    archive: (id: string) =>
      request<{ ok: true }>(transport, `/api/v1/communities/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    join: (id: string) =>
      request<CommunityJoinResult>(
        transport,
        `/api/v1/communities/${encodeURIComponent(id)}/join`,
        {
          method: "POST",
        },
      ),
    myJoinRequest: (id: string) =>
      request<{ request: CommunityJoinRequest | null }>(
        transport,
        `/api/v1/communities/${encodeURIComponent(id)}/join-request`,
      ),
    cancelJoinRequest: (id: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/communities/${encodeURIComponent(id)}/join-request`,
        { method: "DELETE" },
      ),
    joinRequests: (id: string) =>
      request<{ requests: CommunityJoinRequestForFounder[] }>(
        transport,
        `/api/v1/communities/${encodeURIComponent(id)}/join-requests`,
      ),
    approveJoinRequest: (id: string, userId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/communities/${encodeURIComponent(id)}/join-requests/${encodeURIComponent(userId)}/approve`,
        { method: "POST" },
      ),
    declineJoinRequest: (id: string, userId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/communities/${encodeURIComponent(id)}/join-requests/${encodeURIComponent(userId)}/decline`,
        { method: "POST" },
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
    addMember: (id: string, username: string) =>
      request<{ member: { userId: string; username: string } }>(
        transport,
        `/api/v1/communities/${encodeURIComponent(id)}/members`,
        { method: "POST", body: JSON.stringify({ username }) },
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
    community: (communityId: string) =>
      request<WhistleList>(
        transport,
        `/api/v1/whistles/contexts/COMMUNITY/${encodeURIComponent(communityId)}`,
      ),
    sendToCommunity: (communityId: string, body: string) =>
      request<{ whistle: WhistleListItem; remainingToday: number; resetsAt: string }>(
        transport,
        `/api/v1/whistles/contexts/COMMUNITY/${encodeURIComponent(communityId)}`,
        { method: "POST", body: JSON.stringify({ body }) },
      ),
    athletes: (athletesCommunityId: string) =>
      request<WhistleList>(
        transport,
        `/api/v1/whistles/contexts/ATHLETES/${encodeURIComponent(athletesCommunityId)}`,
      ),
    sendToAthletes: (athletesCommunityId: string, body: string) =>
      request<{ whistle: WhistleListItem; remainingToday: number; resetsAt: string }>(
        transport,
        `/api/v1/whistles/contexts/ATHLETES/${encodeURIComponent(athletesCommunityId)}`,
        { method: "POST", body: JSON.stringify({ body }) },
      ),
    ride: (rideRequestId: string) =>
      request<WhistleList>(
        transport,
        `/api/v1/whistles/contexts/RIDE/${encodeURIComponent(rideRequestId)}`,
      ),
    sendToRide: (rideRequestId: string, body: string) =>
      request<{ whistle: WhistleListItem; remainingToday: number; resetsAt: string }>(
        transport,
        `/api/v1/whistles/contexts/RIDE/${encodeURIComponent(rideRequestId)}`,
        { method: "POST", body: JSON.stringify({ body }) },
      ),
  };

  const athletes = {
    publicList: (filters?: { sport?: AthletesSport; cursor?: string; limit?: number }) =>
      request<PublicAthletesList>(transport, athletesPublicListPath(filters)),
    publicDetail: (id: string) =>
      request<PublicAthletesDetail>(transport, `/api/public/v1/athletes/${encodeURIComponent(id)}`),
    detail: async (id: string) => {
      try {
        return await request<PublicAthletesDetail>(
          transport,
          `/api/v1/athletes/${encodeURIComponent(id)}`,
        );
      } catch (error) {
        if (error instanceof HoomaApiError && error.status === 401) {
          return request<PublicAthletesDetail>(
            transport,
            `/api/public/v1/athletes/${encodeURIComponent(id)}`,
          );
        }
        throw error;
      }
    },
    create: (input: AthletesCommunityCreateInput) =>
      request<PublicAthletesDetail>(transport, "/api/v1/athletes", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: AthletesCommunityUpdateInput) =>
      request<PublicAthletesDetail>(transport, `/api/v1/athletes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    archive: (id: string) =>
      request<{ ok: true }>(transport, `/api/v1/athletes/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    join: (id: string) =>
      request<AthletesJoinResult>(transport, `/api/v1/athletes/${encodeURIComponent(id)}/join`, {
        method: "POST",
      }),
    myJoinRequest: (id: string) =>
      request<{ request: AthletesJoinRequest | null }>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/join-request`,
      ),
    cancelJoinRequest: (id: string) =>
      request<{ ok: true }>(transport, `/api/v1/athletes/${encodeURIComponent(id)}/join-request`, {
        method: "DELETE",
      }),
    joinRequests: (id: string) =>
      request<{ requests: AthletesJoinRequestForManager[] }>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/join-requests`,
      ),
    approveJoinRequest: (id: string, userId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/join-requests/${encodeURIComponent(userId)}/approve`,
        { method: "POST" },
      ),
    declineJoinRequest: (id: string, userId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/join-requests/${encodeURIComponent(userId)}/decline`,
        { method: "POST" },
      ),
    members: (id: string) =>
      request<AthletesMember[]>(transport, `/api/v1/athletes/${encodeURIComponent(id)}/members`),
    addMember: (id: string, username: string) =>
      request<{ member: { userId: string; username: string } }>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/members`,
        { method: "POST", body: JSON.stringify({ username }) },
      ),
    removeMember: (id: string, userId: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      ),
    setMemberRole: (id: string, userId: string, role: "MODERATOR" | "MEMBER") =>
      request<{ ok: true }>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}/role`,
        { method: "PATCH", body: JSON.stringify({ role }) },
      ),
  };

  const teams = {
    publicList: (filters?: TeamListFilters) =>
      request<PublicTeamList>(transport, publicListPath(filters)),
    mine: () => request<PublicTeamSummary[]>(transport, "/api/v1/teams/mine"),
    managed: () => request<ManagedTeam[]>(transport, "/api/v1/teams/managed"),
    publicDetail: (teamId: string) =>
      request<TeamControlDetail>(transport, `/api/public/v1/teams/${encodeURIComponent(teamId)}`),
    create: (input: TeamCreateInput) =>
      request(transport, "/api/v1/teams", { method: "POST", body: JSON.stringify(input) }),
    update: (teamId: string, input: TeamUpdateInput) =>
      request(transport, `/api/v1/teams/${encodeURIComponent(teamId)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    archive: (teamId: string) =>
      request<{ ok: true }>(transport, `/api/v1/teams/${encodeURIComponent(teamId)}`, {
        method: "DELETE",
      }),
    addPlayer: (teamId: string, userId: string) =>
      request(transport, `/api/v1/teams/${encodeURIComponent(teamId)}/players`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    removePlayer: (teamId: string, userId: string) =>
      request(
        transport,
        `/api/v1/teams/${encodeURIComponent(teamId)}/players/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      ),
    assignAssistant: (
      teamId: string,
      userId: string,
      capabilities: readonly TeamCapabilityInput[],
    ) =>
      request(transport, `/api/v1/teams/${encodeURIComponent(teamId)}/assistants`, {
        method: "POST",
        body: JSON.stringify({ userId, capabilities }),
      }),
    revokeAssistant: (teamId: string, userId: string) =>
      request(
        transport,
        `/api/v1/teams/${encodeURIComponent(teamId)}/assistants/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      ),
    currentLineup: (teamId: string) =>
      request<TeamLineupView | null>(
        transport,
        `/api/v1/teams/${encodeURIComponent(teamId)}/lineups/current`,
      ),
    saveCurrentLineup: (teamId: string, input: TeamLineupInput) =>
      request<TeamLineupView>(
        transport,
        `/api/v1/teams/${encodeURIComponent(teamId)}/lineups/current`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      ),
    createChallenge: (input: TeamChallengeCreateInput) =>
      request(transport, "/api/v1/teams/challenges", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    incomingChallenges: () =>
      request<TeamChallengeSummary[]>(transport, "/api/v1/teams/challenges/incoming"),
    outgoingChallenges: () =>
      request<TeamChallengeSummary[]>(transport, "/api/v1/teams/challenges/outgoing"),
    games: () => request<TeamGameSummary[]>(transport, "/api/v1/teams/games"),
    acceptChallenge: (id: string) =>
      request(transport, `/api/v1/teams/challenges/${encodeURIComponent(id)}/accept`, {
        method: "POST",
      }),
    declineChallenge: (id: string) =>
      request(transport, `/api/v1/teams/challenges/${encodeURIComponent(id)}/decline`, {
        method: "POST",
      }),
    cancelChallenge: (id: string) =>
      request(transport, `/api/v1/teams/challenges/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
      }),
  };
  return { identity, platformAdmin, communities, athletes, whistles, teams };
}

export type HoomaApi = ReturnType<typeof createHoomaApi>;
