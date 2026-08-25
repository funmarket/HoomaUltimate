import { request, type HoomaTransport } from "../api";
import type { WhistleList, WhistleListItem } from "../api";

export function listEventWhistles(transport: HoomaTransport, eventId: string) {
  return request<WhistleList>(
    transport,
    `/api/v1/whistles/contexts/EVENT/${encodeURIComponent(eventId)}`,
  );
}

export function sendEventWhistle(transport: HoomaTransport, eventId: string, body: string) {
  return request<{ whistle: WhistleListItem; remainingToday: number; resetsAt: string }>(
    transport,
    `/api/v1/whistles/contexts/EVENT/${encodeURIComponent(eventId)}`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
}
