import assert from "node:assert/strict";
import test from "node:test";
import {
  HELP_TAXONOMY_NEED_KINDS,
  HELP_TAXONOMY_SURFACES,
  helpTaxonomyQuerySchema,
  helpTaxonomyResponseSchema,
} from "@hooma/contracts/help-taxonomy";

test("Help taxonomy contracts expose the authorized kinds and surfaces", () => {
  assert.deepEqual(HELP_TAXONOMY_NEED_KINDS, ["PRODUCT", "COMMUNITY_ROLE", "COMMUNITY_SUPPORT"]);
  assert.deepEqual(HELP_TAXONOMY_SURFACES, ["REQUESTS", "PLAY", "ATHLETES", "DONATIONS"]);
});

test("Help taxonomy query requires one explicit projection surface", () => {
  assert.deepEqual(helpTaxonomyQuerySchema.parse({ surface: "REQUESTS" }), {
    surface: "REQUESTS",
  });
  assert.throws(() => helpTaxonomyQuerySchema.parse({}));
  assert.throws(() => helpTaxonomyQuerySchema.parse({ surface: "RIDES" }));
});

test("Help taxonomy response keeps sport, subcategory and need semantics explicit", () => {
  const parsed = helpTaxonomyResponseSchema.parse({
    sports: [
      {
        sport: "FOOTBALL",
        label: "Football",
        subcategories: [
          {
            id: "hts-football-footwear",
            slug: "footwear-boots",
            label: "Footwear & Boots",
            sortOrder: 10,
            needs: [
              {
                id: "htn-football-turf-shoes",
                slug: "turf-shoes",
                label: "Turf Shoes",
                kind: "PRODUCT",
                allowsCustomText: false,
                sortOrder: 10,
              },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(parsed.sports[0]?.sport, "FOOTBALL");
  assert.equal(parsed.sports[0]?.subcategories[0]?.needs[0]?.kind, "PRODUCT");
});
