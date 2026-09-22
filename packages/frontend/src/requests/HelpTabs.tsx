import { DonationIcon, FundMeIcon, RequestIcon } from "../help/HelpIcons";

export type HelpTab = "requests" | "fundme" | "donations";

const HELP_TABS = [
  { key: "requests", label: "Requests", href: "/requests", Icon: RequestIcon },
  { key: "fundme", label: "FundMe", href: "/requests/fundme", Icon: FundMeIcon },
  { key: "donations", label: "Donations", href: "/requests/donations", Icon: DonationIcon },
] as const;

/**
 * Navigation for the Help surface. Requests is functional; FundMe and Donations
 * may render honest reserved states until their domain slices are implemented.
 */
export function HelpTabs({ tab }: { readonly tab: HelpTab }) {
  return (
    <nav className="help-tabs" aria-label="HOOMA Help sections">
      {HELP_TABS.map(({ key, label, href, Icon }) => (
        <a
          key={key}
          className={key === tab ? "help-tab is-active" : "help-tab"}
          href={href}
          aria-current={key === tab ? "page" : undefined}
        >
          <Icon />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
