import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Pitch discovery exposes owner, FanHub, and source-pending provenance states", () => {
  const page = source("packages/frontend/src/pitch/PitchPage.tsx");

  assert.match(page, /By Owner/);
  assert.match(page, /FanHub/);
  assert.match(page, /Source pending/);
  assert.match(page, /submissionOrigin === "OWNER"/);
  assert.match(page, /submissionOrigin === "FANHUB"/);
  assert.match(page, /submissionOrigin == null/);
  assert.match(page, /setActiveSource/);
});

test("Pitch discovery uses Add a Pitch wording and keeps navigation ownership outside the page", () => {
  const page = source("packages/frontend/src/pitch/PitchPage.tsx");

  assert.match(page, /Add a Pitch/);
  assert.doesNotMatch(page, /Suggest a Pitch/);
  assert.doesNotMatch(page, /Home|Play|Events|Teams|Requests|More/);
});

test("Pitch discovery body uses the approved HOOMA body shell without fake future filters", () => {
  const page = source("packages/frontend/src/pitch/PitchPage.tsx");
  const css = source("packages/frontend/src/pitch/pitch.css");

  assert.match(page, /Find your pitch/);
  assert.match(page, /Book football pitches near you/);
  assert.doesNotMatch(page, /Field format|Surface|Date & time/);
  assert.match(css, /\.pitch-discovery-hero/);
  assert.match(css, /\.pitch-source-tabs/);
});
