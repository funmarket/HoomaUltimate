import type { PublicEvent, PublicEventPage } from "@hooma/contracts/events";

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

export interface PlayManagedEventRecord {
  readonly id: string;
  readonly title: string;
  readonly startsAt: string;
}

export interface PlayEventInviteRecord {
  readonly id: string;
  readonly eventId: string;
  readonly targetUserId: string;
}

export interface PlayEventGateway {
  listOpenPlay(input: { limit: number; cursor?: string }): Promise<PublicEventPage>;
  getVisiblePlay(eventId: string, viewerUserId: string): Promise<PublicEvent>;
  invitePlayer(actorUserId: string, eventId: string, targetUserId: string): Promise<unknown>;
  pendingPlayerInvitesForManager(actorUserId: string): Promise<PlayEventInviteRecord[]>;
  listManagedPlayEvents(actorUserId: string): Promise<PlayManagedEventRecord[]>;
}
