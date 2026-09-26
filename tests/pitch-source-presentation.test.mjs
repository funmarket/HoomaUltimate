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

test("Pitch add flow exposes provenance choice and the required owner-review notice", () => {
  const add = source("packages/frontend/src/places/PlacesPages.tsx");

  assert.match(add, /isPitchSuggestion \? "OWNER" : "FANHUB"/);
  assert.match(add, /WHO IS ADDING THIS PITCH\?/);
  assert.match(add, />\s*By Owner\s*</);
  assert.match(add, />\s*FanHub\s*</);
  assert.match(
    add,
    /Admin review required — A Pitch submitted By Owner and its ownership claim are reviewed separately\. Submitting as owner does not grant verified ownership or management access until approved\./,
  );
  assert.match(add, /place: \{ \.\.\.input, submissionOrigin \}/);
  assert.match(add, /ADD A PITCH/);
  assert.match(add, /Add a football pitch/);
  assert.match(add, /submitLabel=\{isPitchSuggestion \? "Add Pitch" : "Submit Place"\}/);
  assert.doesNotMatch(add, /Suggest a football pitch|Suggest Pitch|Pitch suggested/);
});
