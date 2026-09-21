import type { AthletesSport } from "@hooma/contracts/athletes";
import type {
  HelpTaxonomyNeedKind,
  HelpTaxonomySurface,
} from "@hooma/contracts/help-taxonomy";

export interface HelpTaxonomyNeedRecord {
  readonly id: string;
  readonly slug: string;
  readonly label: string;
  readonly kind: HelpTaxonomyNeedKind;
  readonly allowsCustomText: boolean;
  readonly sortOrder: number;
}

export interface HelpTaxonomySubcategoryRecord {
  readonly id: string;
  readonly sport: AthletesSport;
  readonly slug: string;
  readonly label: string;
  readonly sortOrder: number;
  readonly needs: readonly HelpTaxonomyNeedRecord[];
}

export interface HelpTaxonomyRepository {
  listActiveBySurface(
    surface: HelpTaxonomySurface,
  ): Promise<readonly HelpTaxonomySubcategoryRecord[]>;
}
