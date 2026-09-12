import assert from "node:assert/strict";
import test from "node:test";
import type { WhistleList, WhistleListItem } from "../packages/frontend/src/api.js";
import {
  mergeNewestWhistlePage,
  mergeOlderWhistlePage,
} from "../packages/frontend/src/whistle/history.js";

function item(id: string, createdAt: string): WhistleListItem {
  return {
    id,
    authorUserId: `author-${id}`,
    body: `body-${id}`,
    createdAt,
    expiresAt: "2026-09-13T00:00:00.000Z",
  };
}

function page(
  items: WhistleListItem[],
  nextCursor: string | null,
  resetsAt = "2026-09-13T00:00:00.000Z",
): WhistleList {
  return { items, remainingToday: 7, resetsAt, nextCursor };
}

test("newest refresh merges without discarding loaded older Whistles", () => {
  const current = page(
    [
      item("oldest", "2026-09-12T10:00:00.000Z"),
      item("middle", "2026-09-12T11:00:00.000Z"),
      item("latest", "2026-09-12T12:00:00.000Z"),
    ],
    "older-cursor",
  );
  const newest = page(
    [
      item("latest", "2026-09-12T12:00:00.000Z"),
      item("new", "2026-09-12T13:00:00.000Z"),
    ],
    "newest-page-cursor",
  );

  const merged = mergeNewestWhistlePage(current, newest);

  assert.deepEqual(
    new Set(merged.items.map((entry) => entry.id)),
    new Set(["oldest", "middle", "latest", "new"]),
  );
  assert.equal(merged.nextCursor, "older-cursor");
});

test("newest refresh exposes its cursor when there is a gap before loaded history", () => {
  const current = page([item("old-loaded", "2026-09-12T08:00:00.000Z")], "old-cursor");
  const newest = page([item("new-only", "2026-09-12T13:00:00.000Z")], "gap-cursor");

  const merged = mergeNewestWhistlePage(current, newest);

  assert.equal(merged.nextCursor, "gap-cursor");
});

test("older page advances only the older-history cursor and deduplicates overlaps", () => {
  const current = page(
    [
      item("middle", "2026-09-12T11:00:00.000Z"),
      item("latest", "2026-09-12T12:00:00.000Z"),
    ],
    "cursor-1",
  );
  const older = page(
    [
      item("oldest", "2026-09-12T10:00:00.000Z"),
      item("middle", "2026-09-12T11:00:00.000Z"),
    ],
    null,
  );

  const merged = mergeOlderWhistlePage(current, older);

  assert.deepEqual(
    new Set(merged.items.map((entry) => entry.id)),
    new Set(["oldest", "middle", "latest"]),
  );
  assert.equal(merged.nextCursor, null);
});

test(
  "UTC reset replaces client history instead of retaining previous-day Whistle bodies",
  () => {
    const previousDay = page(
      [item("previous-day", "2026-09-12T23:59:00.000Z")],
      null,
      "2026-09-13T00:00:00.000Z",
    );
    const newDay = page([], null, "2026-09-14T00:00:00.000Z");

    assert.deepEqual(mergeNewestWhistlePage(previousDay, newDay), newDay);
    assert.deepEqual(mergeOlderWhistlePage(previousDay, newDay), newDay);
  },
);
