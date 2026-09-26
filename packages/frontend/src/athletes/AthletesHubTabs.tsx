import { Link } from "react-router-dom";

export type AthletesHubDestination = "communities" | "gear-up" | "requests";

function destinationClass(active: boolean): string {
  return active ? "athletes-view-tab is-active" : "athletes-view-tab";
}

export function AthletesHubTabs({ active }: { readonly active: AthletesHubDestination }) {
  return (
    <nav className="athletes-view-tabs" aria-label="Athletes sections">
      <Link
        className={destinationClass(active === "communities")}
        to="/athletes"
        aria-current={active === "communities" ? "page" : undefined}
      >
        Communities
      </Link>
      <Link
        className={destinationClass(active === "gear-up")}
        to="/athletes/gear-up"
        aria-current={active === "gear-up" ? "page" : undefined}
      >
        Gear Up
      </Link>
      <Link
        className={destinationClass(active === "requests")}
        to="/athletes?tab=requests"
        aria-current={active === "requests" ? "page" : undefined}
      >
        Requests
      </Link>
    </nav>
  );
}
