import assert from "node:assert/strict";
import test from "node:test";
import {
  clearInteractionNoticeState,
  readInteractionNotice,
  successNavigationState,
} from "../packages/frontend/src/interaction-feedback.ts";

test("success navigation state round-trips one transient success notice", () => {
  const state = successNavigationState("Team created.");
  assert.deepEqual(readInteractionNotice(state), {
    kind: "success",
    message: "Team created.",
  });
});

test("interaction notice reader ignores invalid and blank state", () => {
  assert.equal(readInteractionNotice(null), null);
  assert.equal(readInteractionNotice({ hoomaInteractionNotice: { kind: "error", message: "No" } }), null);
  assert.equal(
    readInteractionNotice({ hoomaInteractionNotice: { kind: "success", message: "   " } }),
    null,
  );
});

test("clearing interaction notice preserves unrelated route state", () => {
  const state = {
    ...successNavigationState("Game created."),
    returnFocusTo: "publish-game",
  };
  assert.deepEqual(clearInteractionNoticeState(state), { returnFocusTo: "publish-game" });
  assert.equal(readInteractionNotice(clearInteractionNoticeState(state)), null);
});
