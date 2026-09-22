import { ATHLETES_SPORTS, type AthletesSport } from "@hooma/contracts/athletes";
import type { HelpTaxonomyQuery, HelpTaxonomyResponse } from "@hooma/contracts/help-taxonomy";
import type {
  HelpTaxonomyRepository,
  HelpTaxonomySubcategoryRecord,
} from "./help-taxonomy.repository.js";

const sportLabels: Record<AthletesSport, string> = {
  CYCLING: "Cycling",
  RUNNING: "Running",
  SWIMMING: "Swimming",
  FOOTBALL: "Football",
  BASKETBALL: "Basketball",
  TENNIS: "Tennis",
  PADEL: "Padel",
  GYM_FITNESS: "Gym & Fitness",
  OTHER: "Other",
};

function projectSubcategory(subcategory: HelpTaxonomySubcategoryRecord) {
  return {
    id: subcategory.id,
    slug: subcategory.slug,
    label: subcategory.label,
    sortOrder: subcategory.sortOrder,
    needs: subcategory.needs.map((need) => ({
      id: need.id,
      slug: need.slug,
      label: need.label,
      kind: need.kind,
      allowsCustomText: need.allowsCustomText,
      sortOrder: need.sortOrder,
    })),
  };
}

export class HelpTaxonomyService {
  constructor(private readonly repository: HelpTaxonomyRepository) {}

  async list(input: HelpTaxonomyQuery): Promise<HelpTaxonomyResponse> {
    const rows = await this.repository.listActiveBySurface(input.surface);
    const bySport = new Map<AthletesSport, HelpTaxonomySubcategoryRecord[]>();
    const community: HelpTaxonomySubcategoryRecord[] = [];

    for (const row of rows) {
      if (row.requestType === "COMMUNITY") {
        community.push(row);
        continue;
      }
      if (!row.sport) continue;
      const current = bySport.get(row.sport) ?? [];
      current.push(row);
      bySport.set(row.sport, current);
    }

    return {
      sports: ATHLETES_SPORTS.filter((sport) => bySport.has(sport)).map((sport) => ({
        sport,
        label: sportLabels[sport],
        subcategories: (bySport.get(sport) ?? []).map(projectSubcategory),
      })),
      community: {
        label: "Community",
        subcategories: community.map(projectSubcategory),
      },
    };
  }
}
