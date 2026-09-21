import { FundMeIcon, RequestIcon } from "../help/HelpIcons";

export type HelpTab = "requests" | "fundme";

const HELP_TABS = [
  { key: "requests", label: "Requests", href: "/requests", Icon: RequestIcon },
  { key: "fundme", label: "FundMe", href: "/requests/fundme", Icon: FundMeIcon },
] as const;

/**
 * Navigation for the Help surface. Only tabs whose slice exists are shown, so
 * hidden Help sections stay absent until their own domain and frontend slice
 * are real.
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
