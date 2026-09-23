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
          {
            id: "htn-community-lost-found-other",
            slug: "other",
            label: "Other",
            kind: "COMMUNITY_SUPPORT",
            allowsCustomText: true,
            sortOrder: 90,
          },
        ],
      },
    ],
  },
} satisfies HelpTaxonomyResponse;
