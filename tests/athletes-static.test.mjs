import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const router = readFileSync("apps/web/src/app/router/HoomaRouter.tsx", "utf8");
const hoomaPage = readFileSync("packages/frontend/src/communities/HoomaPage.tsx", "utf8");
const api = readFileSync("packages/frontend/src/api.ts", "utf8");

test("Athletes routes are registered without changing Home or bottom navigation", () => {
  assert.match(router, /path="\/athletes"/);
  assert.match(router, /path="\/athletes\/new"/);
  assert.match(router, /path="\/athletes\/:athletesCommunityId"/);
  assert.doesNotMatch(router, /bottom.*Athletes|Athletes.*bottom/i);
});

test("HOOMA page links Athletes separately from HOOMA Community creation", () => {
  assert.match(hoomaPage, /MORE IN HOOMA/);
  assert.match(hoomaPage, /navigate\("\/athletes"\)/);
  const createSection = hoomaPage.slice(
    hoomaPage.indexOf("hooma-create-section"),
    hoomaPage.indexOf("hooma-memberships"),
  );
  assert.doesNotMatch(createSection, /Athletes|TEAM|ULTRAS|What are you starting\?/);
});

test("frontend Athletes API does not use Communities create or a generic creator", () => {
  assert.match(api, /const athletes =/);
  assert.match(api, /\/api\/v1\/athletes/);
  assert.doesNotMatch(api, /createEntity|CreateAnything|api\.communities\.create\(.*athletes/is);
});

test("frontend Athletes API exposes existing archive and member-role operations", () => {
  const athletesApi = api.slice(api.indexOf("const athletes ="), api.indexOf("const teams ="));

  assert.match(
    athletesApi,
    /archive: \(id: string\) =>[\s\S]*?`\/api\/v1\/athletes\/\$\{encodeURIComponent\(id\)\}`[\s\S]*?method: "DELETE"/,
  );
  assert.match(
    athletesApi,
    /setMemberRole: \(id: string, userId: string, role: "MODERATOR" \| "MEMBER"\) =>[\s\S]*?`\/api\/v1\/athletes\/\$\{encodeURIComponent\(id\)\}\/members\/\$\{encodeURIComponent\(userId\)\}\/role`[\s\S]*?method: "PATCH"[\s\S]*?JSON\.stringify\(\{ role \}\)/,
  );
});
