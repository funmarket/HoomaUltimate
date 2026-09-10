import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const board = readFileSync("packages/frontend/src/whistle/HoomaWhistleBoard.tsx", "utf8");
const action = readFileSync("packages/frontend/src/whistle/WhistleAction.tsx", "utf8");
const css = readFileSync("packages/frontend/src/whistle/whistle.css", "utf8");
const profile = readFileSync("apps/web/src/profile/UserWhistlePanel.tsx", "utf8");
const profileCss = readFileSync("apps/web/src/profile/profile.css", "utf8");

test("Community, Event, Athletes, and Ride share the canonical Whistle action", () => {
  assert.match(board, /import \{ WhistleAction \} from "\.\/WhistleAction"/);
  assert.match(board, /<WhistleAction[\s\S]*trailing=\{`\$\{feed\.remainingToday\}\/11`\}/);
  for (const context of ["COMMUNITY", "EVENT", "ATHLETES", "RIDE"]) {
    assert.match(board, new RegExp(`contextType=\\"${context}\\"`));
  }
});

test("Direct user Whistle reuses the same action rather than a profile-specific button", () => {
  assert.match(profile, /WhistleAction/);
  assert.match(profile, /label="Open Whistle"/);
  assert.match(profile, /trailing=\{`\$\{feed\.remainingToday\}\/11`\}/);
  assert.match(profileCss, /button:not\(\.whistle-action\)/);
});

test("Whistle action owns a recognizable transparent lime-outlined identity", () => {
  assert.match(action, /className=\{`whistle-action/);
  assert.match(action, /whistle-action__signal/);
  assert.match(css, /\.whistle-action \{/);
  assert.match(css, /min-height: 46px/);
  assert.match(css, /border: 1px solid rgba\(196, 220, 67, 0\.78\)/);
  assert.match(css, /border-radius: 999px/);
  assert.match(css, /text-transform: uppercase/);
});
