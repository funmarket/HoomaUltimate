import { ATHLETES_SPORTS, type AthletesSport } from "@hooma/contracts/athletes";
import type {
  HelpTaxonomyQuery,
  HelpTaxonomyResponse,
  HelpTaxonomySubcategory,
} from "@hooma/contracts/help-taxonomy";
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

function project(subcategory: HelpTaxonomySubcategoryRecord): HelpTaxonomySubcategory {
  return {
    id: subcategory.id,
    requestType: subcategory.requestType,
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
    const sportRows = rows.filter((row) => row.requestType === "SPORT" && row.sport !== null);
    const communityRows = rows.filter((row) => row.requestType === "COMMUNITY");

    const bySport = new Map<AthletesSport, HelpTaxonomySubcategoryRecord[]>();
    for (const row of sportRows) {
      const sport = row.sport as AthletesSport;
      const current = bySport.get(sport) ?? [];
      current.push(row);
      bySport.set(sport, current);
    }

    return {
      sports: ATHLETES_SPORTS.filter((sport) => bySport.has(sport)).map((sport) => ({
        sport,
        label: sportLabels[sport],
        subcategories: (bySport.get(sport) ?? []).map(project),
      })),
      community: communityRows.map(project),
    };
  }
}
