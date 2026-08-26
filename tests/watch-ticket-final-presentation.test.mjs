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

test("Watch matchup uses one measured fitter so names expand or shrink without wrapping", () => {
  const ticket = source("packages/frontend/src/watch/WatchTicket.tsx");
  const fitter = source("packages/frontend/src/ui/FitSingleLineText.tsx");
  const css = source("packages/frontend/src/watch/watch.css");
  const matchup = cssRule(css, ".watch-ticket__matchup");
  const title = cssRule(css, ".watch-ticket__matchup-title");
  const teamName = cssRule(css, ".watch-ticket__team-name");

  assert.match(ticket, /import \{ FitSingleLineText \}/);
  assert.match(ticket, /text=\{matchup\.teamOneName\}/);
  assert.match(ticket, /text=\{matchup\.teamTwoName\}/);
  assert.match(ticket, /maxFontSize=\{38\}/);
  assert.match(fitter, /ResizeObserver/);
  assert.match(fitter, /element\.scrollWidth > element\.clientWidth/);
  assert.match(fitter, /maxFontSize \* availableWidth/);
  assert.match(
    matchup,
    /grid-template-columns:\s*clamp\(38px, 9\.5cqw, 82px\) minmax\(0, 1fr\) clamp\(38px, 9\.5cqw, 82px\)/,
  );
  assert.match(title, /grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  assert.match(title, /font-family:\s*var\(--watch-ticket-font-display\)/);
  assert.match(teamName, /font-weight:\s*950/);
  assert.match(teamName, /white-space:\s*nowrap/);
  assert.doesNotMatch(teamName, /text-overflow:\s*ellipsis|overflow-wrap:\s*anywhere/);
  assert.match(css, /\.watch-ticket__team-logo \{[\s\S]*?object-fit:\s*contain/);
});

test("Watch date uses full width without a calendar icon", () => {
  const ticket = source("packages/frontend/src/watch/WatchTicket.tsx");
  const css = source("packages/frontend/src/watch/watch.css");
  const details = cssRule(css, ".watch-ticket__details");
  const date = cssRule(css, ".watch-ticket__detail.watch-ticket__date");
  const primary = cssRule(css, ".watch-ticket__detail-copy > strong");
  const secondary = cssRule(css, ".watch-ticket__detail-copy > span:not(.watch-ticket__status)");
  const dateText = cssRule(css, ".watch-ticket__date-text");
  const status = cssRule(css, ".watch-ticket__status");

  assert.match(
    details,
    /grid-template-columns:\s*minmax\(0, 1\.22fr\) minmax\(0, 0\.95fr\) minmax\(0, 0\.9fr\)/,
  );
  assert.match(date, /grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(date, /gap:\s*0/);
  assert.doesNotMatch(ticket, /CalendarIcon/);
  assert.match(ticket, /className="watch-ticket__date-text"/);
  assert.match(ticket, /text=\{date\}/);
  assert.match(ticket, /minFontSize=\{10\}/);
  assert.match(ticket, /maxFontSize=\{27\}/);
  assert.match(dateText, /width:\s*100%/);
  assert.doesNotMatch(primary, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(secondary, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(status, /text-overflow:\s*ellipsis/);
  assert.match(status, /white-space:\s*normal/);
  assert.match(ticket, /\.slice\(0, 3\)/);
  assert.doesNotMatch(cssRule(css, ".watch-ticket__venue"), /position:\s*absolute|top:|left:/);
  assert.doesNotMatch(cssRule(css, ".watch-ticket__date"), /position:\s*absolute|top:|left:/);
});

test("Watch stub uses only the HOOMA logo at full upper-ticket height", () => {
  const ticket = source("packages/frontend/src/watch/WatchTicket.tsx");
  const css = source("packages/frontend/src/watch/watch.css");
  const stub = cssRule(css, ".watch-ticket__stub");
  const logo = cssRule(css, ".watch-ticket__stub-logo");

  assert.match(ticket, /src="\/brand\/hooma-watch-stub\.webp"/);
  assert.doesNotMatch(ticket, /className="watch-ticket__stub-date"/);
  assert.doesNotMatch(ticket, /watch-ticket__stub-ball|>⚽<|<strong>HOOMA<\/strong>/);
  assert.doesNotMatch(css, /\.watch-ticket__stub-date/);
  assert.match(stub, /border-left:\s*2px dashed/);
  assert.match(stub, /grid-template-rows:\s*minmax\(0, 1fr\)/);
  assert.doesNotMatch(stub, /grid-template-rows:\s*minmax\(0, 1fr\) auto/);
  assert.doesNotMatch(stub, /gap:/);
  assert.match(logo, /width:\s*100%/);
  assert.match(logo, /height:\s*100%/);
  assert.match(logo, /object-fit:\s*contain/);
});
