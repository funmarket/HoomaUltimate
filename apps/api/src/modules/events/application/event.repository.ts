import type { EventCreateInput, EventFormationInput, EventUpdateInput } from "@hooma/contracts";

export interface EventPublicListInput {
  readonly type?: "PLAY" | "WATCH";
  readonly communityId?: string;
  readonly from: Date;
  readonly limit: number;
  readonly cursor?: string;
}

export interface EventAccessRecord {
  readonly communityId: string;
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
  listPublic(input: EventPublicListInput): Promise<unknown>;
  getPublic(eventId: string): Promise<unknown | null>;
  access(eventId: string): Promise<EventAccessRecord | null>;
  getRsvp(eventId: string, userId: string): Promise<{ status: EventRsvpState } | null>;
  formationRoster(eventId: string): Promise<FormationRosterPlayer[]>;
  create(userId: string, input: EventCreateInput): Promise<unknown>;
  update(eventId: string, input: EventUpdateInput): Promise<unknown>;
  cancel(eventId: string): Promise<unknown>;
  complete(eventId: string): Promise<unknown>;
  join(eventId: string, userId: string): Promise<{ status: "CONFIRMED" | "WAITLISTED"; promotedUserId?: string }>;
  cancelRsvp(eventId: string, userId: string): Promise<{ cancelled: boolean; promotedUserId: string | null }>;
  createFormation(userId: string, eventId: string, input: EventFormationInput): Promise<unknown>;
  canViewMemberContent(eventId: string, userId: string): Promise<boolean>;
  listFormations(eventId: string): Promise<unknown>;
  checkIn(eventId: string, userId: string, latitude?: number | null, longitude?: number | null): Promise<unknown>;
  listChat(eventId: string, userId: string): Promise<unknown | null>;
  postChat(eventId: string, userId: string, body: string): Promise<unknown | null>;
}
