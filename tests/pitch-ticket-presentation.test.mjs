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

test("Pitch ticket uses canonical ordered Place images and supplied Pitch branding", () => {
  const ticket = source("packages/frontend/src/pitch/PitchTicket.tsx");
  const css = source("packages/frontend/src/pitch/pitch.css");

  assert.match(ticket, /item\.place\.images\.map\(\(image\) => image\.imageUrl\)/);
  assert.match(ticket, /item\.place\.imageUrl/);
  assert.match(ticket, /referrerPolicy="no-referrer"/);
  assert.match(ticket, /onError=\{showNextImage\}/);
  assert.match(ticket, /\/brand\/hooma-pitch-stub\.svg/);
  assert.doesNotMatch(ticket, /hooma-watch-stub/);
  assert.match(css, /\.pitch-ticket__stub img \{[\s\S]*?object-fit:\s*contain/);
  assert.match(css, /\.pitch-ticket__photo > img \{[\s\S]*?object-fit:\s*contain/);
});

test("Pitch ticket presents the canonical hourly rental rate without fallback pricing", () => {
  const ticket = source("packages/frontend/src/pitch/PitchTicket.tsx");
  const pricing = source("packages/frontend/src/pitch/pricing.ts");

  assert.match(ticket, /formatPitchHourlyRate\(item\.hourlyRateMinor, item\.currency\)/);
  assert.match(ticket, /HOURLY RATE/);
  assert.match(ticket, /item\.currency/);
  assert.match(ticket, />\/ hour</);
  assert.match(ticket, /FULL PITCH RENTAL/);
  assert.doesNotMatch(ticket, /hasHourlyRate/);
  assert.doesNotMatch(ticket, /45\s*TND|45 TND/);
  assert.doesNotMatch(pricing, /Contact for price/);
});

test(
  "Pitch ticket preserves supplied side artwork and reserves the black resource strip without fabricated facts",
  () => {
    const ticket = source("packages/frontend/src/pitch/PitchTicket.tsx");
    const css = source("packages/frontend/src/pitch/pitch.css");

    assert.match(ticket, /\/brand\/hooma-pitch-stub\.svg/);
    assert.match(ticket, /pitch-ticket__resource-strip/);
    assert.doesNotMatch(ticket, />\s*7v7\s*</);
    assert.doesNotMatch(ticket, />\s*Artificial\s*</);
    assert.doesNotMatch(ticket, />\s*Outdoor\s*</);
    assert.match(css, /\.pitch-ticket__resource-strip/);
    assert.match(
      css,
      /@media \(max-width: 719px\)[\s\S]*?\.pitch-directory \{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
  },
);
