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
export { HoomaApiError, request, requestBinary, requestBlob } from "./http";
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
  teamId: string;
  createdByUserId: string;
  name: string;
  formation: string;
  matchFormat: string;
  isCurrent: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  slots: TeamLineupSlotView[];
};

export type TeamChallengeView = {
  id: string;
  challengerTeamId: string;
  challengedTeamId: string;
  createdByUserId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED";
  proposedAt: string | null;
  proposedEndsAt: string | null;
  proposedVenue: string | null;
  proposedFormat: string | null;
  message: string | null;
  acceptedByUserId: string | null;
  declinedByUserId: string | null;
  cancelledByUserId: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeamGameView = {
  id: string;
  challengeId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string | null;
  endsAt: string | null;
  venueName: string | null;
  matchFormat: string | null;
  status: "SCHEDULING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
};

export type EventView = {
  id: string;
  communityId: string;
  createdByUserId: string;
  type: string;
  status: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  venueName: string | null;
  address: string | null;
  capacity: number | null;
  waitlistEnabled: boolean;
  entryFeeMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type GamerGameView = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};

export type GamerProfileView = {
  id: string;
  userId: string;
  gameId: string;
  handle: string;
  platform: string;
  region: string | null;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
};

export type GamerChallengeView = {
  id: string;
  gameId: string;
  challengerProfileId: string;
  challengedProfileId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type HoomaApi = ReturnType<typeof createHoomaApi>;

export function createHoomaApi(transport: HoomaTransport) {
  return {
    register: (input: RegisterInput) =>
      request<MeResponse>(transport, "/api/public/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    login: (input: LoginInput) =>
      request<MeResponse>(transport, "/api/public/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    logout: () => request<{ ok: true }>(transport, "/api/v1/auth/logout", { method: "POST" }),
    me: () => request<MeResponse>(transport, "/api/v1/me"),
    updateProfile: (input: ProfilePresentationUpdateInput) =>
      request<MeResponse>(transport, "/api/v1/me/profile", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    publicProfile: (username: string) =>
      request<PublicProfile>(transport, `/api/public/v1/profiles/${encodeURIComponent(username)}`),
    listCommunities: () =>
      request<PublicCommunityList>(transport, "/api/public/v1/communities?limit=50"),
    getCommunity: (slug: string) =>
      request<PublicCommunityDetail>(
        transport,
        `/api/public/v1/communities/${encodeURIComponent(slug)}`,
      ),
    createCommunity: (input: CommunityCreateInput) =>
      request<CreatedCommunity>(transport, "/api/v1/communities", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateCommunity: (communityId: string, input: CommunityUpdateInput) =>
      request<CreatedCommunity>(
        transport,
        `/api/v1/communities/${encodeURIComponent(communityId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      ),
    archiveCommunity: (communityId: string) =>
      request<CreatedCommunity>(
        transport,
        `/api/v1/communities/${encodeURIComponent(communityId)}/archive`,
        { method: "POST" },
      ),
    joinCommunity: (communityId: string) =>
      request<CommunityJoinResult>(
        transport,
        `/api/v1/communities/${encodeURIComponent(communityId)}/join`,
        { method: "POST" },
      ),
    cancelCommunityJoinRequest: (communityId: string) =>
      request<CommunityJoinRequest>(
        transport,
        `/api/v1/communities/${encodeURIComponent(communityId)}/join-request`,
        { method: "DELETE" },
      ),
    listCommunityMembers: (communityId: string) =>
      request<CommunityMember[]>(
        transport,
        `/api/v1/communities/${encodeURIComponent(communityId)}/members`,
      ),
    listCommunityJoinRequests: (communityId: string) =>
      request<CommunityJoinRequestForFounder[]>(
        transport,
        `/api/v1/communities/${encodeURIComponent(communityId)}/join-requests`,
      ),
    approveCommunityJoinRequest: (communityId: string, requestId: string) =>
      request<CommunityJoinRequestForFounder>(
        transport,
        `/api/v1/communities/${encodeURIComponent(communityId)}/join-requests/${encodeURIComponent(requestId)}/approve`,
        { method: "POST" },
      ),
    declineCommunityJoinRequest: (communityId: string, requestId: string) =>
      request<CommunityJoinRequestForFounder>(
        transport,
        `/api/v1/communities/${encodeURIComponent(communityId)}/join-requests/${encodeURIComponent(requestId)}/decline`,
        { method: "POST" },
      ),
    listCommunityWhistles: (communityId: string) =>
      request<WhistleList>(
        transport,
        `/api/v1/whistles?context=COMMUNITY&contextId=${encodeURIComponent(communityId)}`,
      ),
    sendCommunityWhistle: (communityId: string, body: string) =>
      request<WhistleListItem>(transport, "/api/v1/whistles", {
        method: "POST",
        body: JSON.stringify({ context: "COMMUNITY", contextId: communityId, body }),
      }),
    listAthletes: (sport?: AthletesSport) =>
      request<PublicAthletesList>(
        transport,
        `/api/public/v1/athletes?limit=50${sport ? `&sport=${encodeURIComponent(sport)}` : ""}`,
      ),
    getAthletes: (slug: string) =>
      request<PublicAthletesDetail>(
        transport,
        `/api/public/v1/athletes/${encodeURIComponent(slug)}`,
      ),
    createAthletes: (input: AthletesCommunityCreateInput) =>
      request<PublicAthletesDetail>(transport, "/api/v1/athletes", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateAthletes: (communityId: string, input: AthletesCommunityUpdateInput) =>
      request<PublicAthletesDetail>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(communityId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      ),
    archiveAthletes: (communityId: string) =>
      request<PublicAthletesDetail>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(communityId)}/archive`,
        { method: "POST" },
      ),
    joinAthletes: (communityId: string) =>
      request<AthletesJoinResult>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(communityId)}/join`,
        { method: "POST" },
      ),
    cancelAthletesJoinRequest: (communityId: string) =>
      request<AthletesJoinRequest>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(communityId)}/join-request`,
        { method: "DELETE" },
      ),
    listAthletesMembers: (communityId: string) =>
      request<AthletesMember[]>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(communityId)}/members`,
      ),
    listAthletesJoinRequests: (communityId: string) =>
      request<AthletesJoinRequestForManager[]>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(communityId)}/join-requests`,
      ),
    approveAthletesJoinRequest: (communityId: string, requestId: string) =>
      request<AthletesJoinRequestForManager>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(communityId)}/join-requests/${encodeURIComponent(requestId)}/approve`,
        { method: "POST" },
      ),
    declineAthletesJoinRequest: (communityId: string, requestId: string) =>
      request<AthletesJoinRequestForManager>(
        transport,
        `/api/v1/athletes/${encodeURIComponent(communityId)}/join-requests/${encodeURIComponent(requestId)}/decline`,
        { method: "POST" },
      ),
    listTeams: () => request<PublicTeamList>(transport, "/api/public/v1/teams?limit=50"),
    getTeam: (slug: string) =>
      request<PublicTeamSummary>(transport, `/api/public/v1/teams/${encodeURIComponent(slug)}`),
    createTeam: (input: TeamCreateInput) =>
      request<ManagedTeam>(transport, "/api/v1/teams", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateTeam: (teamId: string, input: TeamUpdateInput) =>
      request<ManagedTeam>(transport, `/api/v1/teams/${encodeURIComponent(teamId)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    archiveTeam: (teamId: string) =>
      request<ManagedTeam>(transport, `/api/v1/teams/${encodeURIComponent(teamId)}/archive`, {
        method: "POST",
      }),
    listTeamRoster: (teamId: string) =>
      request<TeamRosterPlayer[]>(transport, `/api/v1/teams/${encodeURIComponent(teamId)}/players`),
    addTeamPlayer: (teamId: string, userId: string) =>
      request<TeamRosterPlayer>(transport, `/api/v1/teams/${encodeURIComponent(teamId)}/players`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    removeTeamPlayer: (teamId: string, teamPlayerId: string) =>
      request<TeamRosterPlayer>(
        transport,
        `/api/v1/teams/${encodeURIComponent(teamId)}/players/${encodeURIComponent(teamPlayerId)}`,
        { method: "DELETE" },
      ),
    getTeamLineup: (teamId: string) =>
      request<TeamLineupView | null>(
        transport,
        `/api/v1/teams/${encodeURIComponent(teamId)}/lineups/current`,
      ),
    upsertTeamLineup: (teamId: string, input: TeamLineupInput) =>
      request<TeamLineupView>(transport, `/api/v1/teams/${encodeURIComponent(teamId)}/lineups`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    createTeamChallenge: (teamId: string, input: TeamChallengeCreateInput) =>
      request<TeamChallengeView>(
        transport,
        `/api/v1/teams/${encodeURIComponent(teamId)}/challenges`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    respondTeamChallenge: (
      teamId: string,
      challengeId: string,
      action: "accept" | "decline" | "cancel",
    ) =>
      request<TeamChallengeView>(
        transport,
        `/api/v1/teams/${encodeURIComponent(teamId)}/challenges/${encodeURIComponent(challengeId)}/${action}`,
        { method: "POST" },
      ),
    grantTeamCapability: (teamId: string, userId: string, input: TeamCapabilityInput) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/teams/${encodeURIComponent(teamId)}/capabilities/${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      ),
    revokeTeamCapability: (teamId: string, userId: string, capability: string) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/teams/${encodeURIComponent(teamId)}/capabilities/${encodeURIComponent(userId)}/${encodeURIComponent(capability)}`,
        { method: "DELETE" },
      ),
  };
}
