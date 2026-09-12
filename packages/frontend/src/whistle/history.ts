import type { WhistleList, WhistleListItem } from "../api";

export function emptyWhistleList(): WhistleList {
  return { items: [], remainingToday: 11, resetsAt: "", nextCursor: null };
}

export function whistleListPath(path: string, cursor?: string): string {
  return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;
}

function mergeItems(
  current: readonly WhistleListItem[],
  incoming: readonly WhistleListItem[],
): WhistleListItem[] {
  const items = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) items.set(item.id, item);
  return [...items.values()];
}

function crossedUtcReset(current: WhistleList, incoming: WhistleList): boolean {
  return Boolean(current.resetsAt && incoming.resetsAt && current.resetsAt !== incoming.resetsAt);
}

export function mergeNewestWhistlePage(current: WhistleList, incoming: WhistleList): WhistleList {
  if (!current.items.length || crossedUtcReset(current, incoming)) return incoming;

  const currentIds = new Set(current.items.map((item) => item.id));
  const overlapsLoadedHistory = incoming.items.some((item) => currentIds.has(item.id));

  return {
    items: mergeItems(current.items, incoming.items),
    remainingToday: incoming.remainingToday,
    resetsAt: incoming.resetsAt,
    nextCursor: overlapsLoadedHistory ? current.nextCursor : incoming.nextCursor,
  };
}

export function mergeOlderWhistlePage(current: WhistleList, incoming: WhistleList): WhistleList {
  if (crossedUtcReset(current, incoming)) return incoming;
  return {
    items: mergeItems(current.items, incoming.items),
    remainingToday: incoming.remainingToday,
    resetsAt: incoming.resetsAt,
    nextCursor: incoming.nextCursor,
  };
}
