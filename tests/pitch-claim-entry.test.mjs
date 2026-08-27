import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Pitch discovery stays consumer-first without ownership onboarding", () => {
  const pitch = source("packages/frontend/src/pitch/PitchPage.tsx");

  assert.match(pitch, /Find your pitch/);
  assert.doesNotMatch(pitch, /List a pitch|Verify Place ownership|PitchCapabilityOnboarding/);
  assert.doesNotMatch(pitch, /href="\/pitch\/manage"/);
});

test("Pitch detail owns the contextual claim and verified-owner management entry", () => {
  const detail = source("packages/frontend/src/pitch/PitchDetailPage.tsx");
  const css = source("packages/frontend/src/pitch/pitch.css");

  assert.match(detail, /api\.places\.claimOwnership\(placeId/);
  assert.match(detail, />\s*Own this pitch\?\s*</);
  assert.match(detail, /api\.places\s*\.ownershipStatus\(placeId\)/);
  assert.doesNotMatch(detail, /api\.places\s*\.manage\(placeId\)/);
  assert.match(detail, /status\.verified/);
  assert.match(detail, /Manage pitch/);
  assert.match(detail, /\/pitch\/manage\?placeId=/);
  assert.match(css, /\.pitch-claim-link/);
  assert.match(css, /\.pitch-owner-link/);
});

test("Pitch management is contextual and does not contain a second ownership system", () => {
  const manage = source("packages/frontend/src/pitch/PitchManagePage.tsx");
  const onboarding = source("packages/frontend/src/pitch/PitchCapabilityOnboarding.tsx");

  assert.match(manage, /new URLSearchParams\(window\.location\.search\)\.get\("placeId"\)/);
  assert.match(manage, /api\.places\.get\(placeId\)/);
  assert.match(manage, /api\.places\.ownershipStatus\(placeId\)/);
  assert.match(manage, /ownership\.verified/);
  assert.doesNotMatch(manage, /api\.places\.manage\(placeId\)/);
  assert.match(manage, /<PitchCapabilityOnboarding place=\{place\}/);
  assert.doesNotMatch(onboarding, /claimOwnership|Verify Place ownership|STEP 1|STEP 2/);
  assert.match(onboarding, /api\.capability\.submit\("PITCH", place\.id/);
});
