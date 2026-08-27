import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Watch event detail is an informative card instead of form-like fact boxes", () => {
  const page = source("packages/frontend/src/events/EventDetailPage.tsx");

  assert.match(page, /className="watch-event-detail"/);
  assert.match(page, /className="watch-event-detail__venue"/);
  assert.match(page, /event\.place\.imageUrl/);
  assert.match(page, /watchAuthority/);
  assert.match(page, /Official venue/);
  assert.match(page, /Suggested by community/);
  assert.doesNotMatch(
    page,
    /isWatch \? \([\s\S]*?<div className="play-event-card__facts">[\s\S]*?<span>Place<\/span>/,
  );
});

test("Creator-only Event edit authority remains capability-driven", () => {
  const page = source("packages/frontend/src/events/EventDetailPage.tsx");

  assert.match(page, /eventApi\s*\.manage\(eventId\)/);
  assert.match(page, /setCanManage\(true\)/);
  assert.match(page, /\{canManage \? \(/);
  assert.match(page, /href=\{`\/events\/\$\{event\.id\}\/edit`\}/);
  assert.match(page, />\s*Edit event\s*<\/a>/);
});

test("Watch detail remains compact and responsive on phone-width layouts", () => {
  const css = source("packages/frontend/src/events/watch-event-detail.css");
  const playCss = source("packages/frontend/src/events/play.css");

  assert.match(playCss, /^@import "\.\/watch-event-detail\.css";/);
  assert.match(css, /\.watch-event-detail__action \{[\s\S]*?min-height:\s*42px/);
  assert.doesNotMatch(css, /\.watch-event-detail__action \{[\s\S]*?width:\s*100%/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(
    css,
    /@media \(max-width: 520px\)[\s\S]*?\.watch-event-detail__meta \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 0\.95fr\)/,
  );
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(
    css,
    /@media \(max-width: 360px\)[\s\S]*?\.watch-event-detail__meta \{[\s\S]*?grid-template-columns:\s*1fr/,
  );
});

test("Play event detail keeps its existing domain presentation", () => {
  const page = source("packages/frontend/src/events/EventDetailPage.tsx");

  assert.match(page, /<span>Format<\/span>/);
  assert.match(page, /<span>Pitch<\/span>/);
  assert.match(page, /<span>Level<\/span>/);
  assert.match(page, /<span>Community<\/span>/);
  assert.match(page, /Formation builder/);
  assert.match(page, /Temporary event chat/);
  assert.match(page, /Check in/);
});
