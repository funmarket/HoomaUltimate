import type { AthletesSport } from "@hooma/contracts/athletes";
import type {
  HelpRequestType,
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
  readonly requestType: HelpRequestType;
  readonly sport: AthletesSport | null;
  readonly slug: string;
  readonly label: string;
  readonly sortOrder: number;
  readonly needs: readonly HelpTaxonomyNeedRecord[];
}

export interface HelpTaxonomySelection {
  readonly subcategory: {
    readonly id: string;
    readonly requestType: HelpRequestType;
    readonly sport: AthletesSport | null;
    readonly slug: string;
    readonly label: string;
  };
  readonly need: {
    readonly id: string;
    readonly subcategoryId: string;
    readonly slug: string;
    readonly label: string;
    readonly kind: HelpTaxonomyNeedKind;
    readonly allowsCustomText: boolean;
  };
}

export interface HelpTaxonomySelectionReader {
  findActiveSelection(input: {
    readonly requestType: HelpRequestType;
    readonly sport?: AthletesSport | null;
    readonly subcategoryId: string;
    readonly needId: string;
  }): Promise<HelpTaxonomySelection | null>;
}

export interface HelpTaxonomyRepository extends HelpTaxonomySelectionReader {
  listActiveBySurface(
    surface: HelpTaxonomySurface,
  ): Promise<readonly HelpTaxonomySubcategoryRecord[]>;
}
