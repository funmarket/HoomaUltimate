import type { HelpTaxonomySurface } from "@hooma/contracts/help-taxonomy";
import type { PrismaClient } from "@hooma/database";
import type {
  HelpTaxonomyRepository,
  HelpTaxonomySelectionQuery,
  HelpTaxonomySubcategoryRecord,
} from "../application/help-taxonomy.repository.js";

export class PrismaHelpTaxonomyRepository implements HelpTaxonomyRepository {
  constructor(private readonly db: PrismaClient) {}

  async findActiveSelection(query: HelpTaxonomySelectionQuery) {
    const need = await this.db.helpTaxonomyNeed.findFirst({
      where: {
        id: query.needId,
        active: true,
        subcategoryId: query.subcategoryId,
        subcategory: {
          id: query.subcategoryId,
          requestType: query.requestType,
          active: true,
          ...(query.sport === null ? { sport: null } : { sport: query.sport }),
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
    const needFilter =
      surface === "DONATIONS"
        ? {
            active: true as const,
            kind: "PRODUCT" as const,
            surfaces: { some: { surface } },
          }
        : {
            active: true as const,
            surfaces: { some: { surface } },
          };

    return this.db.helpTaxonomySubcategory.findMany({
      where: {
        active: true,
        needs: { some: needFilter },
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
          where: needFilter,
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
