import type { TeamPlayerOfferStatus } from "@hooma/contracts/team-offers";

export interface TeamLifecycleRecord {
  readonly createdByUserId: string;
  readonly status: "ACTIVE" | "ARCHIVED";
}

export interface TeamPlayerOfferRecord {
  readonly id: string;
  readonly teamId: string;
  readonly targetUserId: string;
  readonly offeredByUserId: string;
  readonly message: string | null;
  readonly status: TeamPlayerOfferStatus;
  readonly createdAt: Date;
  readonly respondedAt: Date | null;
}

export interface TeamLifecycleRepository {
  get(teamId: string): Promise<TeamLifecycleRecord | null>;
  isActive(teamId: string): Promise<boolean>;
  archive(teamId: string): Promise<void>;
  listRecruitingTeams(userId: string): Promise<unknown>;
  listPendingPlayerOffersForRecruiter(userId: string): Promise<TeamPlayerOfferRecord[]>;
  isActivePlayer(teamId: string, targetUserId: string): Promise<boolean>;
  upsertPlayerOffer(
    teamId: string,
    targetUserId: string,
    offeredByUserId: string,
    message: string | null,
  ): Promise<unknown>;
  listIncomingPlayerOffers(targetUserId: string): Promise<unknown>;
  getPlayerOfferForTarget(
    offerId: string,
    targetUserId: string,
  ): Promise<TeamPlayerOfferRecord | null>;
  acceptPlayerOffer(offerId: string, targetUserId: string): Promise<unknown | null>;
  declinePlayerOffer(offerId: string, targetUserId: string): Promise<unknown | null>;
}
