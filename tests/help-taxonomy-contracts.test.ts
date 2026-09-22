import assert from "node:assert/strict";
import test from "node:test";
import {
  HELP_REQUEST_TYPES,
  HELP_TAXONOMY_NEED_KINDS,
  HELP_TAXONOMY_SURFACES,
  helpTaxonomyQuerySchema,
  helpTaxonomyResponseSchema,
} from "@hooma/contracts/help-taxonomy";

test("Help taxonomy contracts expose Request roots, kinds and surfaces", () => {
  assert.deepEqual(HELP_REQUEST_TYPES, ["SPORT", "COMMUNITY"]);
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

test("Help taxonomy response keeps Sport and Community as parallel roots", () => {
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
    community: {
      label: "Community",
      subcategories: [
        {
          id: "hts-community-lost-found",
          slug: "lost-found",
          label: "Lost & Found",
          sortOrder: 10,
          needs: [
            {
              id: "htn-community-lost-item",
              slug: "lost-item",
              label: "Lost item",
              kind: "COMMUNITY_SUPPORT",
              allowsCustomText: false,
              sortOrder: 10,
            },
          ],
        },
      ],
    },
  });

  assert.equal(parsed.sports[0]?.sport, "FOOTBALL");
  assert.equal(parsed.community.subcategories[0]?.label, "Lost & Found");
});
