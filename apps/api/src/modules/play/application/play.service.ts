import type {
  PlayEventInviteInput,
  PlayPlayerListingInput,
  PlayTeamOfferInput,
} from "@hooma/contracts/play";
import { AppError } from "../../../http/errors/app-error.js";
import type { PlayEventInviteGateway, PlayTeamOfferGateway } from "./play-actions.js";
import type { PlayPlayerListingRepository } from "./play.repository.js";

export class PlayService {
  constructor(
    private readonly repository: PlayPlayerListingRepository,
    private readonly teams: PlayTeamOfferGateway,
    private readonly events: PlayEventInviteGateway,
  ) {}

  listPublic(limit = 30) {
    return this.repository.listPublic(Math.min(Math.max(limit, 1), 100));
  }

  getMine(userId: string) {
    return this.repository.getMine(userId);
  }

  saveMine(userId: string, input: PlayPlayerListingInput) {
    return this.repository.saveMine(userId, input);
  }

  async removeMine(userId: string) {
    return { removed: await this.repository.removeMine(userId) };
  }

  async sendTeamOffer(userId: string, listingId: string, input: PlayTeamOfferInput) {
    const target = await this.repository.resolveTarget(listingId, "TEAM");
    if (!target) {
      throw new AppError(
        404,
        "PLAY_TEAM_TARGET_NOT_AVAILABLE",
        "This player is no longer looking for a Team",
      );
    }
    return this.teams.sendPlayerOfferToUser(
      userId,
      input.teamId,
      target.userId,
      input.message ?? null,
    );
  }

  async sendEventInvite(userId: string, listingId: string, input: PlayEventInviteInput) {
    const target = await this.repository.resolveTarget(listingId, "GAME");
    if (!target) {
      throw new AppError(
        404,
        "PLAY_GAME_TARGET_NOT_AVAILABLE",
        "This player is no longer looking for a Game",
      );
    }
    return this.events.invitePlayer(userId, input.eventId, target.userId);
  }

  async actionState(userId: string) {
    const [offers, invites] = await Promise.all([
      this.teams.pendingPlayerOffersForRecruiter(userId),
      this.events.pendingPlayerInvitesForManager(userId),
    ]);
    const [teamListings, gameListings] = await Promise.all([
      this.repository.listByUserIds(
        [...new Set(offers.map((offer) => offer.targetUserId))],
        "TEAM",
      ),
      this.repository.listByUserIds(
        [...new Set(invites.map((invite) => invite.targetUserId))],
        "GAME",
      ),
    ]);
    const teamListingByUser = new Map(teamListings.map((listing) => [listing.userId, listing.listingId]));
    const gameListingByUser = new Map(gameListings.map((listing) => [listing.userId, listing.listingId]));

    return {
      teamOffers: offers.flatMap((offer) => {
        const listingId = teamListingByUser.get(offer.targetUserId);
        return listingId ? [{ offerId: offer.id, teamId: offer.teamId, listingId }] : [];
      }),
      eventInvites: invites.flatMap((invite) => {
        const listingId = gameListingByUser.get(invite.targetUserId);
        return listingId ? [{ inviteId: invite.id, eventId: invite.eventId, listingId }] : [];
      }),
    };
  }
}
