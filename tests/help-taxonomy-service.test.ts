import assert from "node:assert/strict";
import test from "node:test";
import { HelpTaxonomyService } from "../apps/api/src/modules/help-taxonomy/application/help-taxonomy.service.js";
import type {
  HelpTaxonomyRepository,
  HelpTaxonomySubcategoryRecord,
} from "../apps/api/src/modules/help-taxonomy/application/help-taxonomy.repository.js";

function subcategory(
  sport: HelpTaxonomySubcategoryRecord["sport"],
  slug: string,
  label: string,
  kind: "PRODUCT" | "COMMUNITY_ROLE" | "COMMUNITY_SUPPORT",
): HelpTaxonomySubcategoryRecord {
  return {
    id: `sub-${sport.toLowerCase()}-${slug}`,
    sport,
    slug,
    label,
    sortOrder: 10,
    needs: [
      {
        id: `need-${sport.toLowerCase()}-${slug}`,
        slug,
        label,
        kind,
        allowsCustomText: false,
        sortOrder: 10,
      },
    ],
  };
}

test("Help taxonomy service preserves canonical sport order with OTHER last", async () => {
  const repository: HelpTaxonomyRepository = {
    async listActiveBySurface() {
      return [
        subcategory("OTHER", "other-need", "Other Need", "COMMUNITY_SUPPORT"),
        subcategory("FOOTBALL", "turf-shoes", "Turf Shoes", "PRODUCT"),
        subcategory("RUNNING", "pace-partner", "Pace Partner", "COMMUNITY_ROLE"),
      ];
    },
  };

  const result = await new HelpTaxonomyService(repository).list({ surface: "REQUESTS" });
  assert.deepEqual(
    result.sports.map((sport) => sport.sport),
    ["RUNNING", "FOOTBALL", "OTHER"],
  );
  assert.equal(result.sports.at(-1)?.sport, "OTHER");
});

test("Help taxonomy service does not invent or post-filter repository eligibility", async () => {
  let requestedSurface = "";
  const repository: HelpTaxonomyRepository = {
    async listActiveBySurface(surface) {
      requestedSurface = surface;
      return [subcategory("FOOTBALL", "goalkeeper", "Goalkeeper", "COMMUNITY_ROLE")];
    },
  };

  const result = await new HelpTaxonomyService(repository).list({ surface: "PLAY" });
  assert.equal(requestedSurface, "PLAY");
  assert.equal(result.sports[0]?.subcategories[0]?.needs[0]?.label, "Goalkeeper");
});
