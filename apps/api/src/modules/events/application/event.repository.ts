import type { EventCreateInput, EventFormationInput, EventUpdateInput } from "@hooma/contracts";
import type { PublicEvent, PublicEventPage } from "@hooma/contracts/events";

export interface EventPublicListInput {
  readonly type?: "PLAY" | "WATCH";
  readonly communityId?: string;
  readonly placeId?: string;
  readonly from: Date;
  readonly limit: number;
  readonly cursor?: string;
  readonly viewerUserId?: string;
}

export interface EventAccessRecord {
  readonly communityId: string | null;
  readonly placeId: string | null;
  readonly type: "PLAY" | "WATCH";
  readonly watchKind: "MATCH" | "CULTURAL" | null;
  readonly createdByUserId: string;
  readonly status: "PUBLISHED" | "CANCELLED" | "COMPLETED";
  readonly entryFeeMinor: bigint;
}

export type EventRsvpState = "CONFIRMED" | "WAITLISTED" | "CANCELLED" | "ATTENDED" | "NO_SHOW";

export interface FormationRosterPlayer {
  readonly userId: string;
  readonly status: "CONFIRMED" | "ATTENDED";
  readonly presentation: {
    readonly displayName: string;
    readonly username: string;
    readonly photoUrl: string | null;
  } | null;
}

export interface EventRepository {
  listPublic(input: EventPublicListInput): Promise<PublicEventPage>;
  getPublic(eventId: string): Promise<PublicEvent | null>;
  access(eventId: string): Promise<EventAccessRecord | null>;
  getRsvp(eventId: string, userId: string): Promise<{ status: EventRsvpState } | null>;
  formationRoster(eventId: string): Promise<FormationRosterPlayer[]>;
  create(userId: string, input: EventCreateInput): Promise<PublicEvent>;
  update(eventId: string, input: EventUpdateInput): Promise<PublicEvent>;
  cancel(eventId: string): Promise<unknown>;
  complete(eventId: string): Promise<PublicEvent | null>;
  join(
    eventId: string,
    userId: string,
  ): Promise<{ status: "CONFIRMED" | "WAITLISTED"; promotedUserId?: string }>;
  cancelRsvp(
    eventId: string,
    userId: string,
  ): Promise<{ cancelled: boolean; promotedUserId: string | null }>;
  createFormation(userId: string, eventId: string, input: EventFormationInput): Promise<unknown>;
  canViewMemberContent(eventId: string, userId: string): Promise<boolean>;
  listFormations(eventId: string): Promise<unknown>;
  checkIn(
    eventId: string,
    userId: string,
    latitude?: number | null,
    longitude?: number | null,
  ): Promise<unknown>;
  listChat(eventId: string, userId: string): Promise<unknown | null>;
  postChat(eventId: string, userId: string, body: string): Promise<unknown | null>;
}
