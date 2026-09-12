import { request, type HoomaTransport } from "../api";
import type { WhistleList, WhistleListItem } from "../api";
import { whistleListPath } from "./history";

export function listEventWhistles(transport: HoomaTransport, eventId: string, cursor?: string) {
  return request<WhistleList>(
    transport,
    whistleListPath(`/api/v1/whistles/contexts/EVENT/${encodeURIComponent(eventId)}`, cursor),
  );
}

export function sendEventWhistle(transport: HoomaTransport, eventId: string, body: string) {
  return request<{ whistle: WhistleListItem; remainingToday: number; resetsAt: string }>(
    transport,
    `/api/v1/whistles/contexts/EVENT/${encodeURIComponent(eventId)}`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
}
