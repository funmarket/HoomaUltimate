import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("standalone Requests uses the sport-first taxonomy flow", async () => {
  const page = await readFile("packages/frontend/src/requests/RequestsPage.tsx", "utf8");
  const create = await readFile("packages/frontend/src/requests/RequestCreatePage.tsx", "utf8");
  const filters = await readFile(
    "packages/frontend/src/requests/RequestTaxonomyFilters.tsx",
    "utf8",
  );
  const api = await readFile("packages/frontend/src/requests/api.ts", "utf8");

  assert.match(page, /RequestTaxonomyFilters/);
  assert.match(page, /surface: "REQUESTS"/);
  assert.match(page, /RequestFeed/);

  assert.match(create, /Sport/);
  assert.match(create, /Subcategory/);
  assert.match(create, /Specific item \/ need/);
  assert.match(create, /selectedNeed\?\.kind === "PRODUCT"/);
  assert.match(create, /selectedNeed\?\.allowsCustomText/);
  assert.doesNotMatch(create, /HELP_CATEGORIES|HELP_ITEM_KINDS/);
  assert.doesNotMatch(create, />Category</);
  assert.doesNotMatch(create, />Item kind</);

  assert.match(filters, /All sports/);
  assert.match(filters, /All subcategories/);
  assert.match(filters, /All needs/);
  assert.doesNotMatch(filters, /HELP_CATEGORIES|All categories/);

  assert.match(api, /subcategoryId/);
  assert.match(api, /needId/);
  assert.match(api, /surface/);
  assert.match(api, /\/api\/public\/v1\/help\/taxonomy/);
});
