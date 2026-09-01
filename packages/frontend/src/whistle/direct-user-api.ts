import { request, type HoomaTransport } from "../http";
import type { WhistleListItem } from "../api";

export type DirectWhistleCreateResult = {
  readonly whistle: WhistleListItem;
  readonly remainingToday: number;
  readonly resetsAt: string;
};

export function sendDirectUserWhistle(
  transport: HoomaTransport,
  username: string,
  body: string,
) {
  return request<DirectWhistleCreateResult>(
    transport,
    `/api/v1/whistles/users/${encodeURIComponent(username)}`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
}
