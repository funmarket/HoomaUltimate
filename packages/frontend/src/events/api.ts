import type { EventCreateInput, EventFormationInput, EventUpdateInput } from "@hooma/contracts";
import type { PublicEvent, PublicEventPage } from "@hooma/contracts/events";
import { request, type HoomaTransport } from "../http";

export type { PublicEvent, PublicEventPage } from "@hooma/contracts/events";
export type PublicWatchQuery = {
  cursor?: string | undefined;
  placeId?: string;
  limit?: number;
};
export type EventRsvpState = "CONFIRMED" | "WAITLISTED" | "CANCELLED" | "ATTENDED" | "NO_SHOW";
export type MyEventRsvp = { rsvp: { status: EventRsvpState } | null };
export type FormationRosterPlayer = {
  userId: string;
  status: "CONFIRMED" | "ATTENDED";
  presentation: { displayName: string; username: string; photoUrl: string | null } | null;
};
export type FormationRoster = { players: FormationRosterPlayer[] };
export type FormationRecord = {
  id: string;
  name: string;
  format: string;
  published: boolean;
  slots: {
    id: string;
    userId: string | null;
    team: "A" | "B";
    position: string;
    label: string;
    x: number;
    y: number;
  }[];
};
export type EventChatRecord = {
  id: string;
  body: string;
  userId: string;
  createdAt: string;
  user?: { presentation: { displayName: string; username: string } | null };
};

function publicWatchPath(query: PublicWatchQuery = {}): string {
  const params = new URLSearchParams({ type: "WATCH", limit: String(query.limit ?? 50) });
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.placeId) params.set("placeId", query.placeId);
  return `/api/public/v1/events?${params.toString()}`;
}

export function createEventApi(transport: HoomaTransport) {
  return {
    publicPlay: () =>
      request<PublicEventPage>(transport, "/api/public/v1/events?type=PLAY&limit=50"),
    publicWatch: (query: PublicWatchQuery = {}) =>
      request<PublicEventPage>(transport, publicWatchPath(query)),
    publicDetail: (id: string) =>
      request<PublicEvent>(transport, `/api/public/v1/events/${encodeURIComponent(id)}`),
    manage: (id: string) =>
      request<PublicEvent>(transport, `/api/v1/events/${encodeURIComponent(id)}/manage`),
    myRsvp: (id: string) =>
      request<MyEventRsvp>(transport, `/api/v1/events/${encodeURIComponent(id)}/rsvp`),
    formationRoster: (id: string) =>
      request<FormationRoster>(
        transport,
        `/api/v1/events/${encodeURIComponent(id)}/formation-roster`,
      ),
    create: (input: EventCreateInput) =>
      request<PublicEvent>(transport, "/api/v1/events", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: EventUpdateInput) =>
      request<PublicEvent>(transport, `/api/v1/events/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    join: (id: string) =>
      request<{ status: "CONFIRMED" | "WAITLISTED" }>(
        transport,
        `/api/v1/events/${encodeURIComponent(id)}/join`,
        { method: "POST" },
      ),
    cancelRsvp: (id: string) =>
      request<{ cancelled: boolean; promotedUserId: string | null }>(
        transport,
        `/api/v1/events/${encodeURIComponent(id)}/rsvp`,
        { method: "DELETE" },
      ),
    cancel: (id: string) =>
      request(transport, `/api/v1/events/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
    complete: (id: string) =>
      request(transport, `/api/v1/events/${encodeURIComponent(id)}/complete`, { method: "POST" }),
    formations: (id: string) =>
      request<FormationRecord[]>(transport, `/api/v1/events/${encodeURIComponent(id)}/formations`),
    createFormation: (id: string, input: EventFormationInput) =>
      request<FormationRecord>(transport, `/api/v1/events/${encodeURIComponent(id)}/formations`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    checkIn: (id: string, latitude?: number, longitude?: number) =>
      request(transport, `/api/v1/events/${encodeURIComponent(id)}/check-in`, {
        method: "POST",
        body: JSON.stringify({ latitude: latitude ?? null, longitude: longitude ?? null }),
      }),
    chat: (id: string) =>
      request<EventChatRecord[]>(transport, `/api/v1/events/${encodeURIComponent(id)}/chat`),
    postChat: (id: string, body: string) =>
      request<EventChatRecord>(
        transport,
        `/api/v1/events/${encodeURIComponent(id)}/chat/messages`,
        { method: "POST", body: JSON.stringify({ body }) },
      ),
  };
}
