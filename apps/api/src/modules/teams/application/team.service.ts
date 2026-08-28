import {
  FOOTBALL_FORMAT_PLAYER_COUNTS,
  type TeamCapabilityInput,
  type TeamChallengeCreateInput,
  type TeamCreateInput,
  type TeamLineupInput,
  type TeamUpdateInput,
} from "@hooma/contracts";
import type { TeamPlayerOfferCreateInput } from "@hooma/contracts/team-offers";
import { AppError } from "../../../http/errors/app-error.js";
import type { CommunityService } from "../../communities/application/community.service.js";
import type { ApprovedPitchReader } from "../../pitch/application/approved-pitch.reader.js";
import type { PlatformAdminAuthorizer } from "../../platform-admin/application/platform-admin.authorizer.js";
import { directResponsibilityHasCapability } from "../domain/team-access.js";
import type { TeamLifecycleRepository } from "./team-lifecycle.repository.js";
import type { TeamAccessRecord, TeamListInput, TeamRepository } from "./team.repository.js";

export class TeamService {
  constructor(
    private readonly repository: TeamRepository,
    private readonly communities: CommunityService,
    private readonly lifecycle: TeamLifecycleRepository,
    private readonly platformAdmin: PlatformAdminAuthorizer,
    private readonly pitch?: ApprovedPitchReader,
  ) {}

  listPublic(input: TeamListInput) {
    return this.repository.listPublic({ ...input, limit: Math.min(Math.max(input.limit, 1), 100) });
  }

  async getPublic(teamId: string) {
    const team = await this.repository.getPublic(teamId);
    if (!team) throw new AppError(404, "TEAM_NOT_FOUND", "Team not found");
    return team;
  }

  myTeams(userId: string) {
    return this.repository.listMine(userId);
  }

  managedTeams(userId: string) {
    return this.repository.listManaged(userId);
  }

  recruitingTeams(userId: string) {
    return this.lifecycle.listRecruitingTeams(userId);
  }

  incomingPlayerOffers(userId: string) {
    return this.lifecycle.listIncomingPlayerOffers(userId);
  }

  async sendPlayerOffer(userId: string, teamId: string, input: TeamPlayerOfferCreateInput) {
    await this.requireCapability(userId, teamId, "MANAGE_ROSTER");
    const targetUserId = await this.lifecycle.resolvePlayerOfferTarget(input.listingId);
    if (!targetUserId) {
      throw new AppError(
        404,
        "TEAM_OFFER_TARGET_NOT_AVAILABLE",
        "This player is no longer looking for a Team",
      );
    }
    if (targetUserId === userId) {
      throw new AppError(409, "TEAM_OFFER_SELF", "You cannot offer yourself a Team spot");
    }
    if (await this.lifecycle.isActivePlayer(teamId, targetUserId)) {
      throw new AppError(409, "TEAM_PLAYER_ALREADY_ACTIVE", "This player is already on the Team");
    }
    return this.lifecycle.upsertPlayerOffer(teamId, targetUserId, userId, input.message ?? null);
  }

  async acceptPlayerOffer(userId: string, offerId: string) {
    const offer = await this.lifecycle.getPlayerOfferForTarget(offerId, userId);
    if (!offer) throw new AppError(404, "TEAM_OFFER_NOT_FOUND", "Team offer not found");
    if (offer.status === "ACCEPTED") return { offer, alreadyAccepted: true };
    if (offer.status !== "PENDING") {
      throw new AppError(409, "TEAM_OFFER_CLOSED", "This Team offer is already closed");
    }
    const accepted = await this.lifecycle.acceptPlayerOffer(offerId, userId);
    if (!accepted) {
      throw new AppError(409, "TEAM_OFFER_CLOSED", "This Team offer is already closed");
    }
    return { offer: accepted, alreadyAccepted: false };
  }

  async declinePlayerOffer(userId: string, offerId: string) {
    const offer = await this.lifecycle.getPlayerOfferForTarget(offerId, userId);
    if (!offer) throw new AppError(404, "TEAM_OFFER_NOT_FOUND", "Team offer not found");
    if (offer.status !== "PENDING") {
      throw new AppError(409, "TEAM_OFFER_CLOSED", "This Team offer is already closed");
    }
    const declined = await this.lifecycle.declinePlayerOffer(offerId, userId);
    if (!declined) {
      throw new AppError(409, "TEAM_OFFER_CLOSED", "This Team offer is already closed");
    }
    return { offer: declined };
  }

  async create(userId: string, input: TeamCreateInput) {
    await this.communities.requireCoach(input.communityId, userId);
    return this.repository.create(userId, input);
  }

  async update(userId: string, teamId: string, input: TeamUpdateInput) {
    const record = await this.lifecycle.get(teamId);
    if (!record || record.status !== "ACTIVE") {
      throw new AppError(404, "TEAM_NOT_FOUND", "Team not found");
    }
    const ownerOrAdmin =
      record.createdByUserId === userId || (await this.platformAdmin.isPlatformAdmin(userId));
    if (!ownerOrAdmin) await this.requireCapability(userId, teamId, "EDIT_TEAM");
    return this.repository.update(teamId, input);
  }

  async archive(userId: string, teamId: string) {
    const record = await this.lifecycle.get(teamId);
    if (!record) throw new AppError(404, "TEAM_NOT_FOUND", "Team not found");
    if (record.createdByUserId !== userId && !(await this.platformAdmin.isPlatformAdmin(userId))) {
      throw new AppError(
        403,
        "TEAM_OWNER_OR_ADMIN_REQUIRED",
        "Team creator or App Admin access required",
      );
    }
    if (record.status === "ARCHIVED") return { ok: true };
    await this.lifecycle.archive(teamId);
    return { ok: true };
  }

  async addPlayer(userId: string, teamId: string, targetUserId: string) {
    await this.requireCapability(userId, teamId, "MANAGE_ROSTER");
    return this.repository.addPlayer(teamId, targetUserId);
  }

  async removePlayer(userId: string, teamId: string, targetUserId: string) {
    await this.requireCapability(userId, teamId, "MANAGE_ROSTER");
    const targetAccess = await this.repository.access(teamId, targetUserId);
    if (targetAccess?.responsibility === "COACH") {
      throw new AppError(
        409,
        "COACH_REMOVE_FORBIDDEN",
        "Transfer Coach responsibility before removing this player",
      );
    }
    await this.repository.removePlayer(teamId, targetUserId);
    return { ok: true };
  }

  async assignAssistant(
    userId: string,
    teamId: string,
    targetUserId: string,
    capabilities: readonly TeamCapabilityInput[],
  ) {
    await this.requireDirectCoach(userId, teamId);
    if (userId === targetUserId) {
      throw new AppError(
        409,
        "ASSISTANT_SELF_FORBIDDEN",
        "Coach cannot assign themselves as Assistant",
      );
    }
    await this.repository.assignAssistant(teamId, targetUserId, capabilities, userId);
    return { ok: true };
  }

  async revokeAssistant(userId: string, teamId: string, targetUserId: string) {
    await this.requireDirectCoach(userId, teamId);
    await this.repository.revokeAssistant(teamId, targetUserId);
    return { ok: true };
  }

  async currentLineup(userId: string, teamId: string) {
    await this.requireCapability(userId, teamId, "MANAGE_LINEUP");
    return this.repository.getCurrentLineup(teamId);
  }

  async saveCurrentLineup(userId: string, teamId: string, input: TeamLineupInput) {
    await this.requireCapability(userId, teamId, "MANAGE_LINEUP");
    this.requireFormatConsistency(input);

    const rosterIds = new Set(await this.repository.listActivePlayerIds(teamId));
    const assigned = new Set<string>();

    for (const slot of input.slots) {
      if (!slot.teamPlayerId) continue;
      if (!rosterIds.has(slot.teamPlayerId)) {
        throw new AppError(
          400,
          "LINEUP_PLAYER_NOT_ON_ROSTER",
          "Lineup slots may only use active Team players",
        );
      }
      if (assigned.has(slot.teamPlayerId)) {
        throw new AppError(
          400,
          "LINEUP_PLAYER_DUPLICATE",
          "A player cannot occupy more than one lineup slot",
        );
      }
      assigned.add(slot.teamPlayerId);
    }

    if (input.published) {
      const completeStarters = input.slots.every(
        (slot) => slot.isStarter && Boolean(slot.teamPlayerId),
      );
      if (!completeStarters) {
        throw new AppError(
          400,
          "LINEUP_PUBLISH_INCOMPLETE",
          "Assign every starter before publishing the lineup",
        );
      }
    }

    return this.repository.saveCurrentLineup(userId, teamId, input);
  }

  async createChallenge(userId: string, input: TeamChallengeCreateInput) {
    if (input.challengerTeamId === input.challengedTeamId) {
      throw new AppError(400, "TEAM_CHALLENGE_SELF", "A Team cannot challenge itself");
    }
    await this.requireCapability(userId, input.challengerTeamId, "CREATE_CHALLENGE");
    if (!(await this.lifecycle.isActive(input.challengedTeamId))) {
      throw new AppError(404, "TEAM_NOT_FOUND", "Challenged Team not found");
    }
    if (input.placeId) {
      if (!this.pitch) {
        throw new AppError(503, "PITCH_VALIDATION_UNAVAILABLE", "Pitch validation is unavailable");
      }
      await this.pitch.getApproved(input.placeId);
    }
    return this.repository.createChallenge(userId, input);
  }

  incoming(userId: string, limit = 30) {
    return this.repository.listIncoming(userId, Math.min(Math.max(limit, 1), 100));
  }

  outgoing(userId: string, limit = 30) {
    return this.repository.listOutgoing(userId, Math.min(Math.max(limit, 1), 100));
  }

  async challenge(userId: string, challengeId: string) {
    const challenge = await this.repository.getChallengeForUser(challengeId, userId);
    if (!challenge) throw new AppError(404, "TEAM_CHALLENGE_NOT_FOUND", "Challenge not found");
    return challenge;
  }

  async accept(userId: string, challengeId: string) {
    return this.transitionChallenge(userId, challengeId, "ACCEPTED");
  }

  async decline(userId: string, challengeId: string) {
    return this.transitionChallenge(userId, challengeId, "DECLINED");
  }

  async cancel(userId: string, challengeId: string) {
    const challenge = await this.requireChallenge(challengeId);
    await this.requireCapability(userId, challenge.challengerTeamId, "CREATE_CHALLENGE");
    if (challenge.status === "CANCELLED") return challenge;
    if (challenge.status !== "PENDING") {
      throw new AppError(
        409,
        "TEAM_CHALLENGE_NOT_PENDING",
        "Only a pending challenge can be cancelled",
      );
    }
    const updated = await this.repository.cancelChallenge(challengeId);
    if (!updated) {
      throw new AppError(
        409,
        "TEAM_CHALLENGE_STATE_CHANGED",
        "Challenge state changed; refresh and try again",
      );
    }
    return updated;
  }

  async messages(userId: string, challengeId: string) {
    await this.requireChallengeCoordination(userId, challengeId);
    return this.repository.listMessages(challengeId);
  }

  async createMessage(userId: string, challengeId: string, body: string) {
    await this.requireChallengeCoordination(userId, challengeId);
    return this.repository.createMessage(challengeId, userId, body);
  }

  games(userId: string, limit = 30) {
    return this.repository.listGames(userId, Math.min(Math.max(limit, 1), 100));
  }

  async game(userId: string, gameId: string) {
    const game = await this.repository.getGame(gameId, userId);
    if (!game) throw new AppError(404, "TEAM_GAME_NOT_FOUND", "Team game not found");
    return game;
  }

  async requireCapability(
    userId: string,
    teamId: string,
    capability: TeamCapabilityInput,
  ): Promise<void> {
    const access = await this.repository.access(teamId, userId);
    if (!access) throw new AppError(404, "TEAM_NOT_FOUND", "Team not found");
    if (!this.accessHasCapability(access, capability)) {
      throw new AppError(403, "TEAM_CAPABILITY_REQUIRED", `Team capability ${capability} required`);
    }
  }

  private requireFormatConsistency(input: TeamLineupInput): void {
    const expectedPlayers = FOOTBALL_FORMAT_PLAYER_COUNTS[input.matchFormat];
    const outfieldPlayers = input.formation
      .split("-")
      .map(Number)
      .reduce((total, count) => total + count, 0);

    if (outfieldPlayers !== expectedPlayers - 1 || input.slots.length !== expectedPlayers) {
      throw new AppError(
        400,
        "LINEUP_FORMAT_MISMATCH",
        `Formation and slots must match the selected ${expectedPlayers}v${expectedPlayers} format`,
      );
    }
  }

  private accessHasCapability(access: TeamAccessRecord, capability: TeamCapabilityInput): boolean {
    const communityCoach = access.communityRole === "FOUNDER" || access.communityRole === "COACH";
    return (
      communityCoach ||
      directResponsibilityHasCapability(access.responsibility, access.grants, capability)
    );
  }

  private async hasCapability(
    userId: string,
    teamId: string,
    capability: TeamCapabilityInput,
  ): Promise<boolean> {
    const access = await this.repository.access(teamId, userId);
    return Boolean(access && this.accessHasCapability(access, capability));
  }

  private async requireChallengeCoordination(userId: string, challengeId: string): Promise<void> {
    const challenge = await this.requireChallenge(challengeId);
    const authorized =
      (await this.hasCapability(userId, challenge.challengerTeamId, "RESPOND_TO_CHALLENGE")) ||
      (await this.hasCapability(userId, challenge.challengedTeamId, "RESPOND_TO_CHALLENGE"));
    if (!authorized) throw new AppError(404, "TEAM_CHALLENGE_NOT_FOUND", "Challenge not found");
    if (challenge.status !== "ACCEPTED") {
      throw new AppError(
        409,
        "TEAM_CHALLENGE_COORDINATION_NOT_OPEN",
        "Challenge coordination opens only after acceptance",
      );
    }
  }

  private async transitionChallenge(
    userId: string,
    challengeId: string,
    nextStatus: "ACCEPTED" | "DECLINED",
  ) {
    const challenge = await this.requireChallenge(challengeId);
    await this.requireCapability(userId, challenge.challengedTeamId, "RESPOND_TO_CHALLENGE");
    if (challenge.status === nextStatus) return challenge;
    if (challenge.status !== "PENDING") {
      throw new AppError(
        409,
        "TEAM_CHALLENGE_NOT_PENDING",
        "Only a pending challenge can be answered",
      );
    }
    const updated =
      nextStatus === "ACCEPTED"
        ? await this.repository.acceptChallenge(challengeId)
        : await this.repository.declineChallenge(challengeId);
    if (!updated) {
      throw new AppError(
        409,
        "TEAM_CHALLENGE_STATE_CHANGED",
        "Challenge state changed; refresh and try again",
      );
    }
    return updated;
  }

  private async requireChallenge(challengeId: string) {
    const challenge = await this.repository.getChallenge(challengeId);
    if (!challenge) throw new AppError(404, "TEAM_CHALLENGE_NOT_FOUND", "Challenge not found");
    return challenge;
  }

  private async requireDirectCoach(userId: string, teamId: string): Promise<void> {
    const access = await this.repository.access(teamId, userId);
    if (!access || access.responsibility !== "COACH") {
      throw new AppError(403, "TEAM_COACH_REQUIRED", "Direct Team Coach responsibility required");
    }
  }
}
