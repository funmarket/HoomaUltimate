import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Pitch discovery renders every approved item through one reusable collector ticket", () => {
  const page = source("packages/frontend/src/pitch/PitchPage.tsx");
  const ticket = source("packages/frontend/src/pitch/PitchTicket.tsx");

  assert.match(page, /<PitchTicket item=\{item\}/);
  assert.doesNotMatch(page, /pitch-rental-card/);
  assert.match(ticket, /PITCH RENTAL/);
  assert.match(ticket, /\/pitch\/\$\{item\.place\.id\}/);
});

test("Pitch ticket uses canonical ordered Place images and never borrows Watch branding", () => {
  const ticket = source("packages/frontend/src/pitch/PitchTicket.tsx");

  assert.match(ticket, /item\.place\.images\.map\(\(image\) => image\.imageUrl\)/);
  assert.match(ticket, /item\.place\.imageUrl/);
  assert.match(ticket, /referrerPolicy="no-referrer"/);
  assert.match(ticket, /onError=\{showNextImage\}/);
  assert.match(ticket, /\/brand\/hooma-wordmark\.webp/);
  assert.doesNotMatch(ticket, /hooma-watch-stub/);
});
