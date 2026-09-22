import assert from "node:assert/strict";
import test from "node:test";
import { HelpTaxonomyService } from "../apps/api/src/modules/help-taxonomy/application/help-taxonomy.service.js";
import type {
  HelpTaxonomyRepository,
  HelpTaxonomySubcategoryRecord,
} from "../apps/api/src/modules/help-taxonomy/application/help-taxonomy.repository.js";

type TaxonomyLister = Pick<HelpTaxonomyRepository, "listActiveBySurface">;

function subcategory(
  sport: HelpTaxonomySubcategoryRecord["sport"],
  slug: string,
  label: string,
  kind: "PRODUCT" | "COMMUNITY_ROLE" | "COMMUNITY_SUPPORT",
): HelpTaxonomySubcategoryRecord {
  const prefix = (sport ?? "community").toLowerCase();
  return {
    id: `sub-${prefix}-${slug}`,
    requestType: sport ? "SPORT" : "COMMUNITY",
    sport,
    slug,
    label,
    sortOrder: 10,
    needs: [
      {
        id: `need-${prefix}-${slug}`,
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
  const repository: TaxonomyLister = {
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
  assert.deepEqual(result.community, []);
});

test("Help taxonomy service does not invent or post-filter repository eligibility", async () => {
  let requestedSurface = "";
  const repository: TaxonomyLister = {
    async listActiveBySurface(surface) {
      requestedSurface = surface;
      return [subcategory("FOOTBALL", "goalkeeper", "Goalkeeper", "COMMUNITY_ROLE")];
    },
  };

  const result = await new HelpTaxonomyService(repository).list({ surface: "PLAY" });
  assert.equal(requestedSurface, "PLAY");
  assert.equal(result.sports[0]?.subcategories[0]?.needs[0]?.label, "Goalkeeper");
});

test("community subcategories are grouped under the community root, never under a sport", async () => {
  const repository: TaxonomyLister = {
    async listActiveBySurface() {
      return [
        subcategory("FOOTBALL", "goalkeeper", "Goalkeeper", "COMMUNITY_ROLE"),
        subcategory(null, "lost-found", "Lost & Found", "COMMUNITY_SUPPORT"),
        subcategory(null, "questions-advice", "Questions & Advice", "COMMUNITY_SUPPORT"),
      ];
    },
  };

  const result = await new HelpTaxonomyService(repository).list({ surface: "REQUESTS" });

  assert.deepEqual(
    result.sports.map((sport) => sport.sport),
    ["FOOTBALL"],
  );
  assert.deepEqual(
    result.community.map((group) => [group.label, group.requestType]),
    [
      ["Lost & Found", "COMMUNITY"],
      ["Questions & Advice", "COMMUNITY"],
    ],
  );
  assert.equal(result.community[0]?.needs[0]?.label, "Lost & Found");
  assert.equal(
    result.sports
      .flatMap((sport) => sport.subcategories)
      .some((entry) => entry.label === "Lost & Found"),
    false,
  );
});
