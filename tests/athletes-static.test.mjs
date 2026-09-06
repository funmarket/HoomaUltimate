import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const router = readFileSync("apps/web/src/app/router/HoomaRouter.tsx", "utf8");
const hoomaPage = readFileSync("packages/frontend/src/communities/HoomaPage.tsx", "utf8");
const athletesPage = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");
const api = readFileSync("packages/frontend/src/api.ts", "utf8");

test("Athletes routes are registered without changing Home or bottom navigation", () => {
  assert.match(router, /path="\/athletes"/);
  assert.match(router, /path="\/athletes\/new"/);
  assert.match(router, /path="\/athletes\/:athletesCommunityId"/);
  assert.doesNotMatch(router, /bottom.*Athletes|Athletes.*bottom/i);
});

test("Athletes create entry delegates authentication to app account state", () => {
  assert.match(athletesPage, /export function AthletesPage\(\{[\s\S]*onCreateCommunity/);
  assert.match(athletesPage, /onClick=\{onCreateCommunity\}/);
  assert.doesNotMatch(athletesPage, /Sign in to create/);
  const athletesHub = athletesPage.slice(
    athletesPage.indexOf("export function AthletesPage"),
    athletesPage.indexOf("export function CreateAthletesPage"),
  );
  assert.doesNotMatch(athletesHub, /authenticationHref/);

  const hubRoute = router.slice(
    router.indexOf("function AthletesHubRoute()"),
    router.indexOf("function CreateAthletesRoute()"),
  );
  assert.match(hubRoute, /useAccount\(\)/);
  assert.match(hubRoute, /if \(loading\) return;/);
  assert.match(hubRoute, /if \(me\)[\s\S]*navigate\("\/athletes\/new"\)/);
  assert.match(hubRoute, /if \(error\) return;/);
  assert.ok(
    hubRoute.indexOf("if (me)") < hubRoute.indexOf("if (error)"),
    "signed-in account must take precedence over auxiliary account authority errors",
  );
  assert.match(hubRoute, /createCommunityDisabled=\{loading \|\| Boolean\(error && !me\)\}/);
  assert.match(hubRoute, /authenticationHref\("\/athletes\/new"\)/);

  assert.match(router, /path="\/athletes" element=\{<AthletesHubRoute \/>\}/);
});

test("direct Athletes creation route requires a resolved signed-in HOOMA account", () => {
  const createRoute = router.slice(
    router.indexOf("function CreateAthletesRoute()"),
    router.indexOf("function AthletesDetailRoute()"),
  );
  assert.match(createRoute, /useAccount\(\)/);
  assert.match(createRoute, /if \(loading\) return/);
  assert.match(createRoute, /if \(me\) return <CreateAthletesPage \/>/);
  assert.match(createRoute, /if \(error\) return/);
  assert.ok(
    createRoute.indexOf("if (me)") < createRoute.indexOf("if (error)"),
    "direct create route must allow a resolved signed-in account before auxiliary errors",
  );
  assert.match(createRoute, /authenticationHref\("\/athletes\/new"\)/);
  assert.match(createRoute, /<Navigate to=\{href\} replace \/>/);
  assert.match(router, /path="\/athletes\/new" element=\{<CreateAthletesRoute \/>\}/);
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
