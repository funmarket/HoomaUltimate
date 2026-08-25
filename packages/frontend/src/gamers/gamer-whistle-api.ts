import type { WhistleList, WhistleListItem } from "../api";
import { request, type HoomaTransport } from "../http";

export function listGamerWhistles(transport: HoomaTransport, otherProfileId: string) {
  return request<WhistleList>(
    transport,
    `/api/v1/whistles/gamers/${encodeURIComponent(otherProfileId)}`,
  );
}

export function sendGamerWhistle(
  transport: HoomaTransport,
  otherProfileId: string,
  body: string,
) {
  return request<{ whistle: WhistleListItem; remainingToday: number; resetsAt: string }>(
    transport,
    `/api/v1/whistles/gamers/${encodeURIComponent(otherProfileId)}`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
}
