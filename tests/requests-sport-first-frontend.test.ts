import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("standalone Requests truthfully defaults to all canonical Request roots", async () => {
  const page = await readFile("packages/frontend/src/requests/RequestsPage.tsx", "utf8");
  const create = await readFile("packages/frontend/src/requests/RequestCreatePage.tsx", "utf8");
  const filters = await readFile(
    "packages/frontend/src/requests/RequestTaxonomyFilters.tsx",
    "utf8",
  );
  const styles = await readFile("packages/frontend/src/requests/requests.css", "utf8");
  const api = await readFile("packages/frontend/src/requests/api.ts", "utf8");

  assert.match(page, /RequestTaxonomyFilters/);
  assert.match(page, /useState<RequestsListQuery>\(\{\s*surface: "REQUESTS",?\s*\}\)/);
  assert.doesNotMatch(
    page,
    /useState<RequestsListQuery>\(\{[\s\S]*?surface: "REQUESTS",[\s\S]*?requestType: "SPORT"/,
  );
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

  assert.match(filters, /request-root-switch/);
  assert.match(filters, />\s*All Requests\s*</);
  assert.match(
    styles,
    /\.request-root-switch\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.doesNotMatch(filters, /value\.requestType \?\? "SPORT"/);
  assert.match(filters, /selectRoot\("SPORT"\)/);
  assert.match(filters, /selectRoot\("COMMUNITY"\)/);
  assert.match(filters, /request-quick-rail/);
  assert.match(filters, /All categories/);
  assert.match(filters, /All needs/);
  assert.match(filters, /function patch/);
  assert.doesNotMatch(filters, /AdvancedFilters|advancedFrom|filtersOpen|activeAdvancedCount/);
  assert.doesNotMatch(filters, /applyFilters|resetFilters|request-filter-status/);
  assert.doesNotMatch(filters, /HELP_CATEGORIES/);

  assert.match(api, /requestType/);
  assert.match(api, /subcategoryId/);
  assert.match(api, /needId/);
  assert.match(api, /surface/);
  assert.match(api, /\/api\/public\/v1\/help\/taxonomy/);
});
