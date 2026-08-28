import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Pitch discovery exposes the Pitch action bar", () => {
  const page = source("packages/frontend/src/pitch/PitchPage.tsx");

  assert.match(page, /aria-label="Pitch sections"/);
  assert.match(page, /href="\/pitch"/);
  assert.match(page, /href="\/places\/new\?kind=PITCH"/);
  assert.match(page, />Pitches</);
  assert.match(page, />Suggest a Pitch</);
});

test("Pitch detail follows the shared Place detail composition", () => {
  const detail = source("packages/frontend/src/pitch/PitchDetailPage.tsx");

  assert.match(detail, /<PlaceGallery place=\{place\} \/>/);
  assert.match(detail, /className="place-info-grid pitch-info-grid"/);
  assert.match(detail, />Address</);
  assert.match(detail, />Houma</);
  assert.match(detail, />Contact</);
  assert.match(detail, />About</);
  assert.match(detail, /View on map/);
  assert.match(detail, /formatPitchHourlyRate\(item\.hourlyRateMinor, item\.currency\)/);
  assert.match(detail, /href=\{`\/pitch\/manage\?placeId=/);
  assert.doesNotMatch(detail, /pitch-detail-card/);
});

test("Pitch detail keeps Pitch-only navigation and ownership actions", () => {
  const detail = source("packages/frontend/src/pitch/PitchDetailPage.tsx");

  assert.match(detail, /aria-label="Pitch sections"/);
  assert.match(detail, /Own this pitch\?/);
  assert.match(detail, /CLAIM THIS PITCH/);
  assert.doesNotMatch(detail, /Back to Watch|Upcoming Watch events|WatchTicket|CulturalEventCard/);
});
