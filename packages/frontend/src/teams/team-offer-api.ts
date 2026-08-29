import type { TeamPlayerOfferStatus } from "@hooma/contracts/team-offers";
import { request, type HoomaTransport } from "../http";

export type RecruitingTeam = {
  id: string;
  name: string;
  slug: string;
  badgeUrl: string | null;
  city: string | null;
  houma: string | null;
};

export type TeamPlayerOffer = {
  id: string;
  teamId: string;
  targetUserId: string;
  offeredByUserId: string;
  message: string | null;
  status: TeamPlayerOfferStatus;
  createdAt: string;
  respondedAt: string | null;
  team: {
    id: string;
    name: string;
    slug: string;
    badgeUrl: string | null;
  };
};

export function createTeamOfferApi(transport: HoomaTransport) {
  return {
    recruitingTeams: () =>
      request<RecruitingTeam[]>(transport, "/api/v1/teams/offers/recruiting-teams"),
    incoming: () => request<TeamPlayerOffer[]>(transport, "/api/v1/teams/offers/incoming"),
    accept: (offerId: string) =>
      request<{ offer: TeamPlayerOffer; alreadyAccepted: boolean }>(
        transport,
        `/api/v1/teams/offers/${encodeURIComponent(offerId)}/accept`,
        { method: "POST" },
      ),
    decline: (offerId: string) =>
      request<{ offer: TeamPlayerOffer }>(
        transport,
        `/api/v1/teams/offers/${encodeURIComponent(offerId)}/decline`,
        { method: "POST" },
      ),
  };
}
