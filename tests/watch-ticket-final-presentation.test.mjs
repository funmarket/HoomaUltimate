import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function cssRule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
}

test("Watch ticket keeps Place photo vertically inside corrected master rails", () => {
  const css = source("packages/frontend/src/watch/watch.css");
  const photo = cssRule(css, ".watch-ticket__place-photo");

  assert.match(photo, /top:\s*8\.1%/);
  assert.match(photo, /height:\s*82%/);

  const top = Number(photo.match(/top:\s*([0-9.]+)%/)?.[1]);
  const height = Number(photo.match(/height:\s*([0-9.]+)%/)?.[1]);
  assert.ok(Number.isFinite(top) && Number.isFinite(height));
  assert.ok(top >= 8.1, "Place photo must start below the corrected upper rail");
  assert.ok(top + height <= 90.1, "Place photo must end above the corrected lower rail");
});

test("Watch matchup keeps contrasting centered team-name presentation", () => {
  const ticket = source("packages/frontend/src/watch/WatchTicket.tsx");
  const css = source("packages/frontend/src/watch/watch.css");

  assert.match(ticket, /watch-ticket__team-name--one/);
  assert.match(ticket, /watch-ticket__team-name--two/);

  const teamOne = cssRule(css, ".watch-ticket__team-name--one");
  const teamTwo = cssRule(css, ".watch-ticket__team-name--two");
  const title = cssRule(css, ".watch-ticket__matchup-title strong");

  assert.match(teamOne, /color:\s*#174f93/);
  assert.match(teamTwo, /color:\s*#a6342c/);
  assert.match(title, /align-items:\s*center/);
  assert.match(title, /justify-content:\s*center/);
  assert.match(title, /text-align:\s*center/);
});

test("Watch side stub stays lime, centered and intentionally larger", () => {
  const css = source("packages/frontend/src/watch/watch.css");
  const stub = cssRule(css, ".watch-ticket__stub");

  assert.match(stub, /top:\s*15%/);
  assert.match(stub, /height:\s*65%/);
  assert.match(stub, /color:\s*#c8f23a/);
  assert.match(stub, /align-items:\s*center/);
  assert.match(stub, /justify-content:\s*center/);
  assert.match(stub, /text-align:\s*center/);
  assert.match(stub, /font-size:\s*clamp\(0\.42rem, 1\.72cqw, 0\.86rem\)/);
});
