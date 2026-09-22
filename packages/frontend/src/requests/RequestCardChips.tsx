import type { HelpRequest } from "@hooma/contracts/requests";

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type Chip = {
  readonly key: string;
  readonly tone: "identity" | "category" | "need";
  readonly label: string;
};

/**
 * The taxonomy chips row. The locked reference shows three outlined pills whose
 * colour carries meaning — identity, activity, intent — so each chip here keeps
 * that role: the root/sport (identity), the chosen subcategory (activity) and
 * the chosen need, or the requester's own words when the need allowed custom
 * input (intent). Every label is a canonical value; a chip with no value is not
 * rendered rather than filled with a placeholder.
 */
export function RequestCardChips({ item }: { readonly item: HelpRequest }) {
  const chips: Chip[] = [];
  const communityRequest =
    item.taxonomy?.requestType === "COMMUNITY" || item.requestType === "COMMUNITY";
  const needLabel = item.taxonomy?.need.label ?? null;

  const identityLabel = communityRequest
    ? "Community"
    : (item.taxonomy?.sportLabel ?? (item.sport ? titleCase(item.sport) : null));
  if (identityLabel) chips.push({ key: "identity", tone: "identity", label: identityLabel });

  if (item.taxonomy?.subcategory.label) {
    chips.push({ key: "category", tone: "category", label: item.taxonomy.subcategory.label });
  }

  const intentLabel = item.customNeed ?? needLabel;
  if (intentLabel) {
    chips.push({ key: "need", tone: "need", label: intentLabel });
  } else if (!item.taxonomy) {
    // Legacy category-only Requests keep one meaningful chip instead of none.
    chips.push({ key: "legacy-category", tone: "need", label: titleCase(item.category) });
  }

  if (chips.length === 0) return null;

  return (
    <ul className="request-card__chips">
      {chips.map((chip) => (
        <li className={`request-card__chip request-card__chip--${chip.tone}`} key={chip.key}>
          {chip.label}
        </li>
      ))}
    </ul>
  );
}
