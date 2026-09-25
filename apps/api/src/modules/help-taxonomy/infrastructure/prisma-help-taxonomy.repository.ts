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
    const subcategory = await this.db.helpTaxonomySubcategory.findFirst({
      where: {
        id: input.subcategoryId,
        requestType: input.requestType,
        active: true,
        ...(input.requestType === "SPORT" ? { sport: input.sport ?? null } : { sport: null }),
        needs: {
          some: {
            id: input.needId,
            active: true,
          },
        },
      },
      select: {
        id: true,
        requestType: true,
        sport: true,
        slug: true,
        label: true,
        needs: {
          where: {
            id: input.needId,
            active: true,
          },
          take: 1,
          select: {
            id: true,
            subcategoryId: true,
            slug: true,
            label: true,
            kind: true,
            allowsCustomText: true,
          },
        },
      },
    });
    const need = subcategory?.needs[0];
    if (!subcategory || !need) return null;
    return {
      subcategory: {
        id: subcategory.id,
        requestType: subcategory.requestType,
        sport: subcategory.sport,
        slug: subcategory.slug,
        label: subcategory.label,
      },
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
