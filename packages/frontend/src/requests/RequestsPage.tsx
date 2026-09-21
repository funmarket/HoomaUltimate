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
  const [debouncedCity, setDebouncedCity] = useState<string | undefined>();
  const [debouncedHouma, setDebouncedHouma] = useState<string | undefined>();
  const [memberViewer, setMemberViewer] = useState<boolean | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(tab === "requests");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const effectiveFilters = useMemo<RequestsListQuery>(
    () => ({
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.sport ? { sport: filters.sport } : {}),
      ...(debouncedCity ? { city: debouncedCity } : {}),
      ...(debouncedHouma ? { houma: debouncedHouma } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.limit ? { limit: filters.limit } : {}),
    }),
    [debouncedCity, debouncedHouma, filters.category, filters.limit, filters.sport, filters.status],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedCity(filters.city);
      setDebouncedHouma(filters.houma);
    }, 300);
    return () => clearTimeout(handle);
  }, [filters.city, filters.houma]);

  useEffect(() => {
    if (tab !== "requests") return;
    let active = true;
    setError("");
    void api.identity
      .meOptional()
      .then((me) => {
        if (active) setMemberViewer(Boolean(me));
      })
      .catch((reason) => {
        if (active) {
          setError(protectedError(reason, "Unable to load Requests"));
          setMemberViewer(null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [api, protectedError, tab]);

  useEffect(() => {
    if (tab !== "requests" || memberViewer === null) return;
    let active = true;
    setLoading(true);
    setError("");
    setNextCursor(null);
    void (async () => {
      try {
        const result = memberViewer
          ? await requestsApi.memberList(effectiveFilters)
          : await requestsApi.publicList(effectiveFilters);
        if (active) {
          setItems(result.items);
          setNextCursor(result.nextCursor);
        }
      } catch (reason) {
        if (active) setError(protectedError(reason, "Unable to load Requests"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [effectiveFilters, memberViewer, protectedError, requestsApi, tab]);

  async function loadMore() {
    if (!nextCursor || memberViewer === null || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const input = { ...effectiveFilters, cursor: nextCursor };
      const result = memberViewer
        ? await requestsApi.memberList(input)
        : await requestsApi.publicList(input);
      setItems((current) => [
        ...current,
        ...result.items.filter((item) => !current.some((existing) => existing.id === item.id)),
      ]);
      setNextCursor(result.nextCursor);
    } catch (reason) {
      setError(protectedError(reason, "Unable to load more Requests"));
    } finally {
      setLoadingMore(false);
    }
  }

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
            <>
              <section className="request-list" aria-label="Requests">
                {items.map((item) => (
                  <RequestCard key={item.id} item={item} />
                ))}
              </section>
              {nextCursor ? (
                <button
                  type="button"
                  className="help-action"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
