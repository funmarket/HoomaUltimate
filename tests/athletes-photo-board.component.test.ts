import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ATHLETES_PHOTO_MAX_BYTES } from "@hooma/contracts/athletes";
import { validateAthletesPhotoUpload } from "../packages/frontend/src/athletes/AthletesPhotoBoard";

const component = readFileSync("packages/frontend/src/athletes/AthletesPhotoBoard.tsx", "utf8");
const css = readFileSync("packages/frontend/src/athletes/athletes-photo-board.css", "utf8");
const index = readFileSync("packages/frontend/src/index.ts", "utf8");
const athletesPages = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");

test("Photo Board upload validation accepts only canonical non-empty images up to 5 MiB", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(validateAthletesPhotoUpload({ size: 1, type }), null);
    assert.equal(validateAthletesPhotoUpload({ size: ATHLETES_PHOTO_MAX_BYTES, type }), null);
  }

  assert.equal(
    validateAthletesPhotoUpload({ size: 100, type: "image/gif" }),
    "Choose a JPEG, PNG, or WebP image.",
  );
  assert.equal(
    validateAthletesPhotoUpload({ size: 0, type: "image/jpeg" }),
    "Choose a non-empty image.",
  );
  assert.equal(
    validateAthletesPhotoUpload({
      size: ATHLETES_PHOTO_MAX_BYTES + 1,
      type: "image/webp",
    }),
    "Photo must be 5 MiB or smaller.",
  );
});

test("Photo Board gates viewing to active Athletes members and curation to Founder", () => {
  assert.match(
    component,
    /communityStatus === "ACTIVE" && viewerRole !== null && viewerRole !== undefined/,
  );
  assert.match(
    component,
    /const canCurate = communityStatus === "ACTIVE" && viewerRole === "FOUNDER"/,
  );
  assert.match(component, /if \(!isActiveMember\) return null/);
  assert.match(component, /\{canCurate \? \(/);
  assert.doesNotMatch(component, /viewerRole === "MODERATOR"[^\n]*(upload|delete)/i);
  assert.doesNotMatch(component, /viewerRole === "MEMBER"[^\n]*(upload|delete)/i);
});

test("Photo Board uses the typed authenticated API for list, read, upload, and delete", () => {
  assert.match(component, /api\.athletes\.listPhotos\(athletesCommunityId, cursor\)/);
  assert.match(
    component,
    /fetchPhotoContent\(athletesCommunityId, photo\.id, controller\.signal\)/,
  );
  assert.match(component, /api\.athletes\.uploadPhoto\(athletesCommunityId, file, contentType\)/);
  assert.match(component, /api\.athletes\.deletePhoto\(athletesCommunityId, photo\.id\)/);
  assert.match(component, /URL\.createObjectURL\(blob\)/);
  assert.match(component, /URL\.revokeObjectURL/);
  assert.doesNotMatch(component, /objectKey|storageUrl|s3|presign/i);
});

test("Photo Board presents loading, empty, upload, validation, delete confirmation, and error states", () => {
  assert.match(component, /Loading Photo Board…/);
  assert.match(component, /No photos yet\./);
  assert.match(component, /Uploading photo…/);
  assert.match(component, /Delete this photo\?/);
  assert.match(component, /Unable to delete photo/);
  assert.match(component, /validationError/);
  assert.match(component, /serverError/);
  assert.match(component, /protectedError\(reason, "Unable to load Photo Board"\)/);
  assert.match(component, /protectedError\(reason, "Unable to upload photo"\)/);
});

test("Photo Board stays mobile-first and gives the Founder delete control a safe touch target", () => {
  assert.match(component, /athletes-surface athletes-section athletes-photo-board/);
  assert.match(component, /aria-label=\{`Delete photo \$\{index \+ 1\}`\}/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(
    css,
    /\.athletes-photo-board__delete[\s\S]*width: 44px;[\s\S]*height: 44px;/,
  );
  assert.match(css, /object-fit: cover/);
  assert.match(css, /@media \(min-width: 42rem\)/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
});

test("Photo Board remains non-social while adding Founder-only curation deletion", () => {
  assert.doesNotMatch(component, /\blike(s|d)?\b/i);
  assert.doesNotMatch(component, /\bcomment(s|ed|ing)?\b/i);
  assert.doesNotMatch(component, /\brepl(y|ies)\b/i);
  assert.doesNotMatch(component, /\bcaption(s)?\b/i);
  assert.doesNotMatch(component, /\bchat\b/i);
  assert.match(component, /canDelete=\{canCurate\}/);
  assert.match(component, /deletePhoto/);
});

test("Photo Board remains integrated into the member-only Athletes detail surface", () => {
  assert.match(index, /import "\.\/athletes\/athletes-photo-board\.css"/);
  assert.match(index, /export \* from "\.\/athletes\/AthletesPhotoBoard"/);
  assert.match(athletesPages, /import \{ AthletesPhotoBoard \} from "\.\/AthletesPhotoBoard"/);
  assert.match(
    athletesPages,
    /<AthletesPhotoBoard[\s\S]*athletesCommunityId=\{id\}[\s\S]*communityStatus=\{detail\.status\}[\s\S]*viewerRole=\{detail\.viewerRole\}/,
  );
  assert.match(
    athletesPages,
    /detail\.viewerRole \? \([\s\S]*<AthletesWhistleBoard[\s\S]*<AthletesPhotoBoard/,
  );
});
