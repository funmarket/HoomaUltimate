import type { HelpTaxonomySurface } from "@hooma/contracts/help-taxonomy";
import type { PrismaClient } from "@hooma/database";
import type {
  HelpTaxonomyRepository,
  HelpTaxonomySubcategoryRecord,
} from "../application/help-taxonomy.repository.js";

export class PrismaHelpTaxonomyRepository implements HelpTaxonomyRepository {
  constructor(private readonly db: PrismaClient) {}

  async listActiveBySurface(
    surface: HelpTaxonomySurface,
  ): Promise<readonly HelpTaxonomySubcategoryRecord[]> {
    return this.db.helpTaxonomySubcategory.findMany({
      where: {
        active: true,
        needs: {
          some: {
            active: true,
            surfaces: { some: { surface } },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }, { id: "asc" }],
      select: {
        id: true,
        sport: true,
        slug: true,
        label: true,
        sortOrder: true,
        needs: {
          where: {
            active: true,
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
