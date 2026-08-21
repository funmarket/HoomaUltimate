import assert from "node:assert/strict";
import test from "node:test";
import { eventChatWindow } from "../apps/api/src/modules/events/domain/event-policy.js";

test("temporary Event chat opens six hours before and closes six hours after", () => {
  const startsAt = new Date("2026-08-21T18:00:00.000Z");
  const endsAt = new Date("2026-08-21T20:00:00.000Z");
  const window = eventChatWindow(startsAt, endsAt);
  assert.equal(window.opensAt.toISOString(), "2026-08-21T12:00:00.000Z");
  assert.equal(window.closesAt.toISOString(), "2026-08-22T02:00:00.000Z");
});
