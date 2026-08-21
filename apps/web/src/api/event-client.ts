import type { EventCreateInput, EventFormationInput, EventUpdateInput } from "@hooma/contracts";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers }
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: { code?: string; message?: string } };
  if (!response.ok) {
    const error = new Error(body.error?.message ?? `Event request failed (${response.status})`) as Error & { code?: string };
    error.code = body.error?.code;
    throw error;
  }
  return body;
}

export type PublicEvent = {
  id: string;
  communityId: string;
  type: "PLAY" | "WATCH";
  status?: "PUBLISHED" | "COMPLETED";
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
  community: { id: string; name: string; slug: string };
  playDetails: { pitchType: string; skillLevel: string; format: string } | null;
  _count: { rsvps: number; checkIns?: number };
};

export type FormationRecord = {
  id: string;
  name: string;
  format: string;
  published: boolean;
  slots: { id: string; userId: string | null; team: "A" | "B"; position: string; label: string; x: number; y: number }[];
};

export type EventChatRecord = {
  id: string;
  body: string;
  userId: string;
  createdAt: string;
  user?: { presentation: { displayName: string; username: string } | null };
};

export const eventApi = {
  publicPlay: () => request<{ items: PublicEvent[]; nextCursor: string | null }>("/api/public/v1/events?type=PLAY&limit=50"),
  publicDetail: (id: string) => request<PublicEvent>(`/api/public/v1/events/${encodeURIComponent(id)}`),
  create: (input: EventCreateInput) => request<PublicEvent>("/api/v1/events", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: EventUpdateInput) => request<PublicEvent>(`/api/v1/events/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
  join: (id: string) => request<{ status: "CONFIRMED" | "WAITLISTED" }>(`/api/v1/events/${encodeURIComponent(id)}/join`, { method: "POST" }),
  cancelRsvp: (id: string) => request<{ cancelled: boolean; promotedUserId: string | null }>(`/api/v1/events/${encodeURIComponent(id)}/rsvp`, { method: "DELETE" }),
  cancel: (id: string) => request(`/api/v1/events/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  complete: (id: string) => request(`/api/v1/events/${encodeURIComponent(id)}/complete`, { method: "POST" }),
  formations: (id: string) => request<FormationRecord[]>(`/api/v1/events/${encodeURIComponent(id)}/formations`),
  createFormation: (id: string, input: EventFormationInput) => request<FormationRecord>(`/api/v1/events/${encodeURIComponent(id)}/formations`, { method: "POST", body: JSON.stringify(input) }),
  checkIn: (id: string, latitude?: number, longitude?: number) => request(`/api/v1/events/${encodeURIComponent(id)}/check-in`, { method: "POST", body: JSON.stringify({ latitude: latitude ?? null, longitude: longitude ?? null }) }),
  chat: (id: string) => request<EventChatRecord[]>(`/api/v1/events/${encodeURIComponent(id)}/chat`),
  postChat: (id: string, body: string) => request<EventChatRecord>(`/api/v1/events/${encodeURIComponent(id)}/chat/messages`, { method: "POST", body: JSON.stringify({ body }) })
};
