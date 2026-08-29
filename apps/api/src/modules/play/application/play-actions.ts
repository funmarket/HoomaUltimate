export interface PlayTeamOfferRecord {
  readonly id: string;
  readonly teamId: string;
  readonly targetUserId: string;
}

export interface PlayTeamOfferGateway {
  sendPlayerOfferToUser(
    actorUserId: string,
    teamId: string,
    targetUserId: string,
    message: string | null,
  ): Promise<unknown>;
  pendingPlayerOffersForRecruiter(actorUserId: string): Promise<PlayTeamOfferRecord[]>;
}

export interface PlayEventInviteRecord {
  readonly id: string;
  readonly eventId: string;
  readonly targetUserId: string;
}

export interface PlayEventInviteGateway {
  invitePlayer(actorUserId: string, eventId: string, targetUserId: string): Promise<unknown>;
  pendingPlayerInvitesForManager(actorUserId: string): Promise<PlayEventInviteRecord[]>;
}
