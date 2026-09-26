import { Link, useInRouterContext } from "react-router-dom";
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
  const inRouterContext = useInRouterContext();

  return (
    <nav className="help-tabs" aria-label="HOOMA Help sections">
      {HELP_TABS.map(({ key, label, href, Icon }) => {
        const className = key === tab ? "help-tab is-active" : "help-tab";
        const content = (
          <>
            <Icon />
            <span>{label}</span>
          </>
        );

        return inRouterContext ? (
          <Link
            key={key}
            className={className}
            to={href}
            aria-current={key === tab ? "page" : undefined}
          >
            {content}
          </Link>
        ) : (
          <a
            key={key}
            className={className}
            href={href}
            aria-current={key === tab ? "page" : undefined}
          >
            {content}
          </a>
        );
      })}
    </nav>
  );
}
