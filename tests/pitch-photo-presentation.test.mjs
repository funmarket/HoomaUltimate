import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("By Owner Add Pitch exposes upload plus URL intake capped at three", () => {
  const add = source("packages/frontend/src/places/PlacesPages.tsx");
  const form = source("packages/frontend/src/places/PlaceForm.tsx");

  assert.match(add, /maxImages=\{isPitchSuggestion && submissionOrigin === "OWNER" \? 3 : 4\}/);
  assert.match(add, /allowUploads=\{isPitchSuggestion && submissionOrigin === "OWNER"\}/);
  assert.match(form, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(form, /URL and upload photos share the same \{maxImages\}-photo limit/);
});

test("Pitch Manage uses the same canonical Place gallery for owner and App Admin limits", () => {
  const manage = source("packages/frontend/src/pitch/PitchManagePage.tsx");
  const manager = source("packages/frontend/src/places/PlacePhotoManager.tsx");
  assert.match(source("packages/frontend/src/pitch/PitchPhotoManager.tsx"), /<PlacePhotoManager/);

  assert.match(manage, /<PitchPhotoManager/);
  assert.match(manage, /maxImages=\{management\.verifiedOwnership \? 3 : 6\}/);
  assert.match(manager, /createPlacesApi/);
  assert.match(manager, /addExternalImage/);
  assert.match(manager, /uploadImage/);
  assert.match(manager, /reorderImages/);
  assert.match(manager, /deleteImage/);
});
