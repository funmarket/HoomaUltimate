import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function cssRule(css, selector) {
  const marker = `${selector} {`;
  const start = css.indexOf(marker);
  if (start < 0) return "";
  const bodyStart = start + marker.length;
  const bodyEnd = css.indexOf("\n}", bodyStart);
  return bodyEnd < 0 ? "" : css.slice(bodyStart, bodyEnd);
}

test("Watch ticket removes the upper Place photo and stacks a taller framed photo below", () => {
  const ticket = source("packages/frontend/src/watch/WatchTicket.tsx");
  const css = source("packages/frontend/src/watch/watch.css");
  const photo = cssRule(css, ".watch-ticket__photo-panel");
  const photoImage = cssRule(css, ".watch-ticket__photo-panel img");

  assert.doesNotMatch(ticket, /WATCH_COLLECTOR_TICKET_MASTER/);
  assert.doesNotMatch(ticket, /watch-ticket__place-photo/);
  assert.match(ticket, /watch-ticket__photo-panel/);
  assert.match(ticket, /feedVariant \? \(/);
  assert.match(photo, /width:\s*calc\(100% - clamp\(10px, 2cqw, 18px\)\)/);
  assert.match(photo, /aspect-ratio:\s*2 \/ 1/);
  assert.match(photo, /justify-self:\s*center/);
  assert.match(photoImage, /object-fit:\s*contain/);
  assert.match(photoImage, /object-position:\s*center/);
});

test("Watch matchup stays single-line, dominant and centered between fully contained crests", () => {
  const ticket = source("packages/frontend/src/watch/WatchTicket.tsx");
  const css = source("packages/frontend/src/watch/watch.css");
  const matchup = cssRule(css, ".watch-ticket__matchup");
  const title = cssRule(css, ".watch-ticket__matchup-title");
  const teamName = cssRule(css, ".watch-ticket__matchup-title strong");

  assert.match(ticket, /watch-ticket__team-name--one/);
  assert.match(ticket, /watch-ticket__team-name--two/);
  assert.match(
    matchup,
    /grid-template-columns:\s*clamp\(42px, 11cqw, 92px\) minmax\(0, 1fr\) clamp\(42px, 11cqw, 92px\)/,
  );
  assert.match(title, /grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  assert.match(title, /font-family:\s*var\(--watch-ticket-font-display\)/);
  assert.match(teamName, /font-size:\s*clamp\(1\.08rem, 5\.2cqw, 2\.7rem\)/);
  assert.match(teamName, /font-weight:\s*950/);
  assert.match(teamName, /white-space:\s*nowrap/);
  assert.doesNotMatch(teamName, /overflow-wrap:\s*anywhere/);
  assert.match(css, /\.watch-ticket__team-logo \{[\s\S]*?object-fit:\s*contain/);
});

test("Watch practical information uses three readable columns instead of absolute coordinates", () => {
  const css = source("packages/frontend/src/watch/watch.css");
  const details = cssRule(css, ".watch-ticket__details");
  const detail = cssRule(css, ".watch-ticket__detail");
  const primary = cssRule(css, ".watch-ticket__detail-copy > strong");
  const secondary = cssRule(css, ".watch-ticket__detail-copy > span:not(.watch-ticket__status)");

  assert.match(
    details,
    /grid-template-columns:\s*minmax\(0, 1\.22fr\) minmax\(0, 0\.95fr\) minmax\(0, 0\.9fr\)/,
  );
  assert.match(detail, /align-items:\s*center/);
  assert.match(primary, /font-size:\s*clamp\(0\.82rem, 3\.65cqw, 1\.7rem\)/);
  assert.match(primary, /font-weight:\s*950/);
  assert.match(secondary, /font-size:\s*clamp\(0\.66rem, 2\.55cqw, 1\.15rem\)/);
  assert.doesNotMatch(cssRule(css, ".watch-ticket__venue"), /position:\s*absolute|top:|left:/);
  assert.doesNotMatch(cssRule(css, ".watch-ticket__date"), /position:\s*absolute|top:|left:/);
});

test("Watch side stub contains only collector branding below its football emblem", () => {
  const ticket = source("packages/frontend/src/watch/WatchTicket.tsx");
  const css = source("packages/frontend/src/watch/watch.css");
  const stub = cssRule(css, ".watch-ticket__stub");
  const branding = cssRule(css, ".watch-ticket__stub strong");
  const visibleStub =
    ticket.match(/<span className="watch-ticket__stub-ball"[\s\S]*?<strong>HOOMA<\/strong>/)?.[0] ??
    "";

  assert.match(ticket, /watch-ticket__stub-ball/);
  assert.match(visibleStub, /⚽/);
  assert.match(visibleStub, /<strong>HOOMA<\/strong>/);
  assert.doesNotMatch(visibleStub, /event\.title|\{date\}|\{time\}|status|place\.name/);
  assert.match(stub, /border-left:\s*2px dashed/);
  assert.match(branding, /color:\s*var\(--watch-ticket-gold\)/);
  assert.match(branding, /writing-mode:\s*vertical-rl/);
  assert.match(branding, /font-size:\s*clamp\(0\.78rem, 2\.8cqw, 1\.35rem\)/);
});
