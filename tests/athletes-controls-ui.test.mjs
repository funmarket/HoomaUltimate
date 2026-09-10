import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controls = readFileSync("packages/frontend/src/athletes/athletes-controls.css", "utf8");
const index = readFileSync("packages/frontend/src/index.ts", "utf8");
const pages = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");

test("Athletes back navigation has explicit app styling instead of native button chrome", () => {
  assert.match(pages, /athletes-back/);
  assert.match(index, /import "\.\/athletes\/athletes-controls\.css"/);
  assert.match(controls, /\.athletes-page \.athletes-back/);
  assert.match(controls, /background: transparent/);
  assert.match(controls, /border: 1px solid rgba\(243, 207, 98, 0\.58\)/);
  assert.match(controls, /border-radius: 999px/);
  assert.match(controls, /appearance: none/);
});
