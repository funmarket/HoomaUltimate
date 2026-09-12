import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pages = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");
const css = readFileSync(
  "packages/frontend/src/athletes/athletes-member-management.css",
  "utf8",
);
const index = readFileSync("packages/frontend/src/index.ts", "utf8");

test("Athletes membership management keeps direct add secondary", () => {
  const joinRequests = pages.indexOf("<h2>Join requests</h2>");
  const directAdd = pages.indexOf("<summary>Add member directly</summary>");

  assert.ok(joinRequests >= 0, "join requests heading should exist");
  assert.ok(directAdd > joinRequests, "direct add should follow join requests");
  assert.doesNotMatch(pages, /<h2>Manage members<\/h2>/);
  assert.match(pages, /<details className="athletes-direct-add">/);
  assert.match(pages, /Add an existing HOOMA user by username\./);
  assert.match(pages, /api\.athletes\.addMember\(id, username\)/);
  assert.match(pages, /api\.athletes\.approveJoinRequest\(id, request\.userId\)/);
  assert.match(pages, /api\.athletes\.declineJoinRequest\(id, request\.userId\)/);
});

test("Athletes direct add uses a compact phone-safe layout", () => {
  const inputRuleStart = css.indexOf(".athletes-page .athletes-direct-add__form input {");
  const desktopRuleStart = css.indexOf("@media (min-width: 430px)");

  assert.ok(inputRuleStart >= 0, "direct-add input rule should exist");
  assert.ok(desktopRuleStart >= 0, "responsive direct-add rule should exist");

  const inputRuleEnd = css.indexOf("}", inputRuleStart);
  const inputRule = css.slice(inputRuleStart, inputRuleEnd);
  const desktopRules = css.slice(desktopRuleStart);

  assert.match(index, /import "\.\/athletes\/athletes-member-management\.css"/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(inputRule, /min-height: 3rem;/);
  assert.match(inputRule, /flex: 0 0 auto;/);
  assert.match(desktopRules, /grid-template-columns: minmax\(0, 1fr\) auto;/);
});
