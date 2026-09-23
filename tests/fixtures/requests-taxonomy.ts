import type { HelpTaxonomyResponse } from "@hooma/contracts/help-taxonomy";

export const requestsTaxonomy = {
  sports: [
    {
      sport: "RUNNING",
      label: "Running",
      subcategories: [
        {
          id: "hts-running-footwear",
          slug: "footwear",
          label: "Footwear",
          sortOrder: 10,
          needs: [
            {
              id: "htn-running-shoes",
              slug: "running-shoes",
              label: "Running shoes",
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
    subcategories: [],
  },
} satisfies HelpTaxonomyResponse;
