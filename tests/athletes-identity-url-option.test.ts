import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { externalIdentityUrl } from "../packages/frontend/src/athletes/identity-url-option.js";

const form = readFileSync("packages/frontend/src/athletes/AthletesCommunityForm.tsx", "utf8");

test("Athletes identity URL selection supports explicit empty and external options", () => {
  assert.equal(externalIdentityUrl("none", "https://example.org/old.png"), null);
  assert.equal(
    externalIdentityUrl("external", "  https://example.org/logo.png  "),
    "https://example.org/logo.png",
  );
  assert.equal(externalIdentityUrl("external", ""), null);
  assert.match(form, /<option value="none">No image URL<\/option>/);
  assert.match(form, /<option value="external">External URL<\/option>/);
  assert.match(form, /logoUrl: externalIdentityUrl\(logoUrlMode, logoUrl\)/);
  assert.match(form, /bannerUrl: externalIdentityUrl\(bannerUrlMode, bannerUrl\)/);
});
