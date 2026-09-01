import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile("packages/frontend/src/communities/HoomaPage.tsx", "utf8");

test("HOOMA creates only HOOMA Communities from the Communities-owned page", () => {
  assert.doesNotMatch(source, /type CreationType/);
  assert.doesNotMatch(source, /type CreationOption/);
  assert.doesNotMatch(source, /CREATION_ORDER/);
  assert.doesNotMatch(source, /CREATION_OPTIONS/);
  assert.doesNotMatch(source, /creationType/);
  assert.doesNotMatch(source, /selectedCreation/);
  assert.doesNotMatch(source, /continueCreation/);
  assert.doesNotMatch(source, /Community type/);
  assert.doesNotMatch(source, /What are you starting\?/);
  assert.doesNotMatch(source, /One gateway\. Separate owning domains\./);
  assert.doesNotMatch(source, /Continue with/);
  assert.match(source, /Create a HOOMA Community/);
  assert.match(source, /navigate\("\/hooma\/new"\)/);
});

test("HOOMA creation only continues back to Teams for the bounded team-create handoff", () => {
  assert.match(source, /new URLSearchParams\(window\.location\.search\)\.get\("after"\)/);
  assert.match(source, /after === "team-create"/);
  assert.match(
    source,
    /navigate\(`\/teams\/new\?communityId=\$\{encodeURIComponent\(created\.id\)\}`\)/,
  );
  assert.match(source, /navigate\("\/hooma"\)/);
  assert.doesNotMatch(source, /returnTo/);
});

test("Team and future ULTRAS creation are not owned by the HOOMA page", () => {
  assert.doesNotMatch(source, /"TEAM"/);
  assert.doesNotMatch(source, /"ULTRAS"/);
  assert.doesNotMatch(source, /href: "\/teams"/);
  assert.doesNotMatch(source, /href: null/);
  assert.doesNotMatch(source, /href: "\/ultras"/);
  assert.doesNotMatch(source, /CommunityType/);
});
