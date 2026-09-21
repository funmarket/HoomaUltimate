import { useEffect, useMemo, useState } from "react";
import type { HelpRequest } from "@hooma/contracts/requests";
import { useHoomaFrontend } from "../context";
import { FundMeIcon, PlusIcon, RequestIcon } from "../help/HelpIcons";
import { createRequestsApi, type RequestsListQuery } from "./api";
import { HelpTabs } from "./HelpTabs";
import { RequestCard } from "./RequestCard";
import { RequestFilters } from "./RequestFilters";

export type RequestsPageTab = "requests" | "fundme";

/**
 * Orchestrates the Help Requests surface: identity, list loading, filters and
 * loading/error/empty/list states. Card, filter and tab rendering belongs to
 * their own focused units; the backend stays authoritative for visibility.
 */
export function RequestsPage({ tab = "requests" }: { readonly tab?: RequestsPageTab }) {
  const { api, transport, protectedError } = useHoomaFrontend();
  const requestsApi = useMemo(() => createRequestsApi(transport), [transport]);
  const [items, setItems] = useState<HelpRequest[]>([]);
  const [filters, setFilters] = useState<RequestsListQuery>({});
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
        <div className="help-hero__copy">
          <span className="eyebrow">HOOMA HELP</span>
          <h1>{fundmeActive ? "FundMe" : "Requests"}</h1>
          <p>
            {fundmeActive
              ? "FundMe will carry contributions for community needs once its own slice exists."
              : "Ask for people, gear, places, transport, services, or other support around real HOOMA activity."}
          </p>
        </div>
        {fundmeActive ? null : (
          <a className="help-action" href="/requests/new">
            <PlusIcon />
            <span>Create request</span>
          </a>
        )}
      </header>

      <HelpTabs tab={tab} />

      {fundmeActive ? (
        <section className="requests-empty panel">
          <FundMeIcon className="requests-empty__icon" />
          <span className="eyebrow">FUNDME</span>
          <h2>FundMe is not taking contributions yet.</h2>
          <p className="muted">
            The surface is reserved. There is no campaign, donation form, payment intent or provider
            integration until the later FundMe slices own that behavior.
          </p>
        </section>
      ) : (
        <>
          <RequestFilters value={filters} onChange={setFilters} />
          {loading ? <p className="status">Loading Requests…</p> : null}
          {error ? <p className="status request-error">{error}</p> : null}
          {!loading && !error && items.length === 0 ? (
            <section className="requests-empty panel">
              <RequestIcon className="requests-empty__icon" />
              <h2>No Requests match these filters.</h2>
              <p className="muted">
                Create one if there is something your football community needs.
              </p>
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
