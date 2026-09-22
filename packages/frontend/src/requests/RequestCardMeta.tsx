import type { ReactNode } from "react";
import type { HelpRequest } from "@hooma/contracts/requests";
import { PinIcon } from "../ui/HoomaIcons";
import { ClockIcon } from "../help/HelpIcons";
import { UsersIcon } from "../ui/HoomaIcons";

/**
 * Compact icon + value metadata. Only values that exist in the canonical
 * Request are rendered: no placeholder counts, no invented availability.
 */
export function RequestCardMeta({ item }: { readonly item: HelpRequest }) {
  const facts: { readonly key: string; readonly icon: ReactNode; readonly value: string }[] = [];

  if (item.neededByAt) {
    facts.push({
      key: "neededBy",
      icon: <ClockIcon />,
      value: `Needed by ${new Date(item.neededByAt).toLocaleDateString()}`,
    });
  }
  if (item.quantityNeeded) {
    facts.push({
      key: "quantity",
      icon: <UsersIcon />,
      value: `${item.quantityNeeded} needed`,
    });
  }
  if (item.fullAddress) {
    facts.push({ key: "fullAddress", icon: <PinIcon />, value: item.fullAddress });
  }

  if (facts.length === 0) return null;

  return (
    <div className="request-card__meta">
      {facts.map((fact) => (
        <span key={fact.key}>
          {fact.icon}
          {fact.value}
        </span>
      ))}
    </div>
  );
}
