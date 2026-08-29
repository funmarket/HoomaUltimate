import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile("packages/frontend/src/communities/HoomaPage.tsx", "utf8");

test("HOOMA create chooser stays limited to HOOMA, TEAM and ULTRAS", () => {
  assert.match(source, /type CreationType = "HOOMA" \| "TEAM" \| "ULTRAS";/);
  assert.match(
    source,
    /const CREATION_ORDER: readonly CreationType\[] = \["HOOMA", "TEAM", "ULTRAS"\]/,
  );
  assert.doesNotMatch(source, /GAMERS/);
  assert.doesNotMatch(source, /CommunityType/);
});

test("ULTRAS stays unavailable and cannot route into Community creation", () => {
  assert.match(source, /ULTRAS:[\s\S]*?available: false,[\s\S]*?href: null,/);
  assert.doesNotMatch(source, /href: "\/ultras"/);
  assert.match(source, /if \(selectedCreation\.available && selectedCreation\.href\)/);
  assert.match(source, /navigate\(selectedCreation\.href\)/);
});
