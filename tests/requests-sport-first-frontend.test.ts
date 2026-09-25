import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("standalone Requests uses one SPORT or COMMUNITY taxonomy flow", async () => {
  const page = await readFile("packages/frontend/src/requests/RequestsPage.tsx", "utf8");
  const create = await readFile("packages/frontend/src/requests/RequestCreatePage.tsx", "utf8");
  const filters = await readFile(
    "packages/frontend/src/requests/RequestTaxonomyFilters.tsx",
    "utf8",
  );
  const api = await readFile("packages/frontend/src/requests/api.ts", "utf8");

  assert.match(page, /RequestTaxonomyFilters/);
  assert.match(page, /surface: "REQUESTS"/);
  assert.match(page, /filters\.requestType/);
  assert.match(page, /RequestFeed/);

  assert.match(create, /Request Type/);
  assert.match(create, /SPORT/);
  assert.match(create, /COMMUNITY/);
  assert.match(create, /Category/);
  assert.match(create, /Specific need/);
  assert.match(create, /Full address/);
  assert.match(create, /selectedNeed\?\.kind === "PRODUCT"/);
  assert.match(create, /selectedNeed\?\.allowsCustomText/);
  assert.doesNotMatch(create, /HELP_CATEGORIES|HELP_ITEM_KINDS/);
  assert.doesNotMatch(create, />Item kind</);

  assert.match(filters, /All request types/);
  assert.match(filters, /All sports/);
  assert.match(filters, /All categories/);
  assert.match(filters, /All needs/);
  assert.doesNotMatch(filters, /HELP_CATEGORIES/);

  assert.match(api, /requestType/);
  assert.match(api, /subcategoryId/);
  assert.match(api, /needId/);
  assert.match(api, /surface/);
  assert.match(api, /\/api\/public\/v1\/help\/taxonomy/);
});
