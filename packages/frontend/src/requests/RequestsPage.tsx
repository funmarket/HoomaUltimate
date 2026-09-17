import { useEffect, useMemo, useState } from "react";
import type { HelpRequest, HelpRequestListQuery } from "@hooma/contracts/requests";
import { ATHLETES_SPORTS } from "@hooma/contracts/athletes";
import { HELP_CATEGORIES } from "@hooma/contracts/help";
import { useHoomaFrontend } from "../context";
import { createRequestsApi } from "./api";
import {
  ClockIcon,
  FilterIcon,
  FundMeIcon,
  GiftIcon,
  LocationIcon,
  PlusIcon,
  RequestIcon,
} from "../help/HelpIcons";

export type RequestsPageTab = "requests" | "fundme";

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function HelpTabs({ tab }: { readonly tab: RequestsPageTab }) {
  return (
    <nav className="help-tabs" aria-label="HOOMA Help sections">
      <a
        className={tab === "requests" ? "help-tab is-active" : "help-tab"}
        href="/requests"
        aria-current={tab === "requests" ? "page" : undefined}
      >
        <RequestIcon />
        <span>Requests</span>
      </a>
      <a
        className={tab === "fundme" ? "help-tab is-active" : "help-tab"}
        href="/requests/fundme"
        aria-current={tab === "fundme" ? "page" : undefined}
      >
        <FundMeIcon />
        <span>FundMe</span>
      </a>
      <span className="help-tab is-disabled" aria-disabled="true" title="Donations are a later slice">
        <GiftIcon />
        <span>Donations</span>
      </span>
    </nav>
  );
}

function RequestCard({ item }: { readonly item: HelpRequest }) {
  const place = [item.houma, item.city].filter(Boolean).join(", ");
  return (
    <a className="request-card panel" href={`/requests/${encodeURIComponent(item.id)}`}>
      <div className="request-card__topline">
        <span className="request-chip">{titleCase(item.category)}</span>
        <span className={`request-status request-status--${item.status.toLowerCase()}`}>
          {titleCase(item.status)}
        </span>
      </div>
      <div className="request-card__body">
        <h2>{item.title}</h2>
        <p>{item.description}</p>
      </div>
      <div className="request-card__meta">
        {place ? (
          <span>
            <LocationIcon /> {place}
          </span>
        ) : null}
        {item.neededByAt ? (
          <span>
            <ClockIcon /> Needed {new Date(item.neededByAt).toLocaleDateString()}
          </span>
        ) : null}
        {item.sport ? <span>{titleCase(item.sport)}</span> : null}
        {item.quantityNeeded ? <span>Qty {item.quantityNeeded}</span> : null}
      </div>
    </a>
  );
}

export function RequestsPage({ tab = "requests" }: { readonly tab?: RequestsPageTab }) {
  const { api, transport, protectedError } = useHoomaFrontend();
  const requestsApi = useMemo(() => createRequestsApi(transport), [transport]);
  const [items, setItems] = useState<HelpRequest[]>([]);
  const [filters, setFilters] = useState<HelpRequestListQuery>({ limit: 30 });
  const [loading, setLoading] = useState(tab === "requests");
  const [error, setError] = useState("");

  useEffect(() => {
    if (tab !== "requests") return;
    let active = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const me = await api.identity.meOptional();
        const result = me
          ? await requestsApi.memberList(filters)
          : await requestsApi.publicList(filters);
        if (active) setItems(result.items);
      } catch (reason) {
        if (active) setError(protectedError(reason, "Unable to load Requests"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [api, filters, protectedError, requestsApi, tab]);

  const fundmeActive = tab === "fundme";

  return (
    <section className="page requests-page">
      <header className="help-hero panel">
        <div>
          <span className="eyebrow">HOOMA HELP</span>
          <h1>{fundmeActive ? "FundMe" : "Requests"}</h1>
          <p>
            {fundmeActive
              ? "FundMe will connect community needs to fundraising after its owning backend slice is built."
              : "Ask for people, gear, places, transport, services, or other support around real HOOMA activity."}
          </p>
        </div>
        {!fundmeActive ? (
          <a className="help-primary-action" href="/requests/new">
            <PlusIcon /> Create request
          </a>
        ) : null}
      </header>

      <HelpTabs tab={tab} />

      {fundmeActive ? (
        <section className="requests-empty panel">
          <FundMeIcon className="requests-empty__icon" />
          <span className="eyebrow">FUNDME</span>
          <h2>FundMe is not taking contributions yet.</h2>
          <p className="muted">
            The surface is reserved, but there is no fundraising campaign, donation form, payment
            intent, or provider integration until the later FundMe slices own that behavior.
          </p>
        </section>
      ) : (
        <>
          <section className="request-filters panel" aria-label="Request filters">
            <div className="request-filters__title">
              <FilterIcon />
              <strong>Find support needs</strong>
            </div>
            <div className="request-filters__fields">
              <label>
                Category
                <select
                  value={filters.category ?? ""}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      category: (event.target.value || undefined) as HelpRequestListQuery["category"],
                    }))
                  }
                >
                  <option value="">All categories</option>
                  {HELP_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {titleCase(category)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sport
                <select
                  value={filters.sport ?? ""}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      sport: (event.target.value || undefined) as HelpRequestListQuery["sport"],
                    }))
                  }
                >
                  <option value="">All sports</option>
                  {ATHLETES_SPORTS.map((sport) => (
                    <option key={sport} value={sport}>
                      {titleCase(sport)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                City
                <input
                  value={filters.city ?? ""}
                  placeholder="Tunis"
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, city: event.target.value || undefined }))
                  }
                />
              </label>
              <label>
                Houma
                <input
                  value={filters.houma ?? ""}
                  placeholder="Neighborhood"
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, houma: event.target.value || undefined }))
                  }
                />
              </label>
            </div>
          </section>

          {loading ? <p className="status">Loading Requests…</p> : null}
          {error ? <p className="status status--error">{error}</p> : null}
          {!loading && !error && items.length === 0 ? (
            <section className="requests-empty panel">
              <RequestIcon className="requests-empty__icon" />
              <h2>No Requests match these filters.</h2>
              <p className="muted">Create one if there is something your football community needs.</p>
            </section>
          ) : null}
          {!loading && !error && items.length > 0 ? (
            <section className="request-list" aria-label="Requests">
              {items.map((item) => (
                <RequestCard key={item.id} item={item} />
              ))}
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
