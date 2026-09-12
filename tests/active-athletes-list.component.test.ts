import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync("packages/frontend/src/athletes/ActiveAthletesList.tsx", "utf8");
const pages = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");
const css = readFileSync("packages/frontend/src/athletes/active-athletes.css", "utf8");
const index = readFileSync("packages/frontend/src/index.ts", "utf8");

test("Active Athletes keeps canonical profile navigation and identity presentation", () => {
  assert.match(component, /href=\{`\/profile\/\$\{encodeURIComponent\(presentation\.username\)\}`\}/);
  assert.match(component, /presentation\.displayName/);
  assert.match(component, /@\{presentation\.username\}/);
  assert.match(component, /presentation\?\.photoUrl/);
  assert.match(component, /active-athlete-role/);
});

test("Active Athletes exposes only WebSession-derived last-seen text, not invented presence", () => {
  assert.match(component, /lastSeenLabel\(member\.lastSeenAt\)/);
  assert.match(component, /No recent web activity/);
  assert.match(component, /Last seen just now/);
  assert.doesNotMatch(component, /online|offline|green dot|red dot/i);
  assert.doesNotMatch(component, /telegram|redis/i);
});

test("Active Athletes is integrated into the existing member-only Athletes detail surface", () => {
  assert.match(pages, /import \{ ActiveAthletesList \} from "\.\/ActiveAthletesList"/);
  assert.match(pages, /detail\.viewerRole \? \([\s\S]*<ActiveAthletesList/);
  assert.match(pages, /members=\{members\}/);
  assert.match(index, /import "\.\/athletes\/active-athletes\.css"/);
  assert.match(css, /\.active-athlete-avatar/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
