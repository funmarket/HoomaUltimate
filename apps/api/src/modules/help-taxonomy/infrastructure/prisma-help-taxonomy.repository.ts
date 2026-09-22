import type { AthletesSport } from "@hooma/contracts/athletes";
import type { HelpRequestType, HelpTaxonomySurface } from "@hooma/contracts/help-taxonomy";
import type { PrismaClient } from "@hooma/database";
import type {
  HelpTaxonomyRepository,
  HelpTaxonomySubcategoryRecord,
} from "../application/help-taxonomy.repository.js";

export class PrismaHelpTaxonomyRepository implements HelpTaxonomyRepository {
  constructor(private readonly db: PrismaClient) {}

  async findActiveSelection(input: {
    readonly requestType: HelpRequestType;
    readonly sport?: AthletesSport | null;
    readonly subcategoryId: string;
    readonly needId: string;
  }) {
    const need = await this.db.helpTaxonomyNeed.findFirst({
      where: {
        id: input.needId,
        active: true,
        subcategoryId: input.subcategoryId,
        subcategory: {
          id: input.subcategoryId,
          requestType: input.requestType,
          active: true,
          ...(input.requestType === "SPORT" ? { sport: input.sport ?? undefined } : { sport: null }),
        },
      },
      select: {
        id: true,
        subcategoryId: true,
        slug: true,
        label: true,
        kind: true,
        allowsCustomText: true,
        subcategory: {
          select: {
            id: true,
            requestType: true,
            sport: true,
            slug: true,
            label: true,
          },
        },
      },
    });
    if (!need) return null;
    return {
      subcategory: need.subcategory,
      need: {
        id: need.id,
        subcategoryId: need.subcategoryId,
        slug: need.slug,
        label: need.label,
        kind: need.kind,
        allowsCustomText: need.allowsCustomText,
      },
    };
  }

  async listActiveBySurface(
    surface: HelpTaxonomySurface,
  ): Promise<readonly HelpTaxonomySubcategoryRecord[]> {
    const kind = surface === "DONATIONS" ? "PRODUCT" : undefined;

    return this.db.helpTaxonomySubcategory.findMany({
      where: {
        active: true,
        needs: {
          some: {
            active: true,
            ...(kind ? { kind } : {}),
            surfaces: { some: { surface } },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }, { id: "asc" }],
      select: {
        id: true,
        requestType: true,
        sport: true,
        slug: true,
        label: true,
        sortOrder: true,
        needs: {
          where: {
            active: true,
            ...(kind ? { kind } : {}),
            surfaces: { some: { surface } },
          },
          orderBy: [{ sortOrder: "asc" }, { label: "asc" }, { id: "asc" }],
          select: {
            id: true,
            slug: true,
            label: true,
            kind: true,
            allowsCustomText: true,
            sortOrder: true,
          },
        },
      },
    });
  }
}
