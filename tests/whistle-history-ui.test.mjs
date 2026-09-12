import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const room = readFileSync("packages/frontend/src/whistle/WhistleRoom.tsx", "utf8");
const board = readFileSync("packages/frontend/src/whistle/HoomaWhistleBoard.tsx", "utf8");
const userDirect = readFileSync("apps/web/src/profile/UserWhistlePanel.tsx", "utf8");
const gamerDirect = readFileSync("packages/frontend/src/gamers/GamerWhistlePanel.tsx", "utf8");
const history = readFileSync("packages/frontend/src/whistle/history.ts", "utf8");
const whistleCss = readFileSync("packages/frontend/src/whistle/whistle.css", "utf8");

test("shared Whistle room owns older-history access and canonical author profile navigation", () => {
  assert.match(room, /hasOlder/);
  assert.match(room, /↑ Load older/);
  assert.match(room, /loadingOlder/);
  assert.match(room, /href=\{`\/profile\/\$\{encodeURIComponent\(presentation\.username\)\}`\}/);
  assert.match(room, /useLayoutEffect/);
  assert.match(room, /room\.scrollTop \+= room\.scrollHeight - previousScrollHeightRef\.current/);
});

test("shared Whistle scroll container keeps oldest loaded history reachable", () => {
  assert.match(whistleCss, /\.whistle-room\s*\{[\s\S]*align-content:\s*safe end;/);
  assert.doesNotMatch(whistleCss, /align-content:\s*end;/);
  assert.match(whistleCss, /scrollbar-color:\s*transparent transparent;/);
  assert.match(
    whistleCss,
    /\.whistle-room::\-webkit-scrollbar-thumb\s*\{[\s\S]*background:\s*transparent;/,
  );
});

test("Community/Event/Athletes/Ride and direct Whistle surfaces expose the shared older-history control", () => {
  for (const source of [board, userDirect, gamerDirect]) {
    assert.match(source, /hasOlder=\{Boolean\(feed\.nextCursor\)\}/);
    assert.match(source, /onLoadOlder=\{\(\) => void loadOlder\(\)\}/);
    assert.match(source, /mergeOlderWhistlePage/);
  }
});

test("client history drops previous-day bodies when the UTC reset changes", () => {
  assert.match(history, /crossedUtcReset/);
  assert.match(history, /current\.resetsAt !== incoming\.resetsAt/);
  assert.match(
    history,
    /if \(!current\.items\.length \|\| crossedUtcReset\(current, incoming\)\) return incoming/,
  );
  assert.match(history, /if \(crossedUtcReset\(current, incoming\)\) return incoming/);
});
