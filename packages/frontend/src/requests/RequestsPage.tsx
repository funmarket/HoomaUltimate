import { useEffect, useMemo, useState } from "react";
import type { HelpTaxonomyResponse } from "@hooma/contracts/help-taxonomy";
import type { HelpRequest } from "@hooma/contracts/requests";
import { useHoomaFrontend } from "../context";
import { DonationIcon, FundMeIcon, PlusIcon } from "../help/HelpIcons";
import { createRequestsApi, type RequestsListQuery } from "./api";
import { HelpTabs } from "./HelpTabs";
import { RequestFeed } from "./RequestFeed";
import { RequestTaxonomyFilters } from "./RequestTaxonomyFilters";

export type RequestsPageTab = "requests" | "fundme" | "donations";

/**
 * Orchestrates the Help Requests surface: identity, list loading, filters and
 * loading/error/empty/list states. Card, filter and tab rendering belongs to
 * their own focused units; the backend stays authoritative for visibility.
 */
export function RequestsPage({ tab = "requests" }: { readonly tab?: RequestsPageTab }) {
  const { api, transport, protectedError } = useHoomaFrontend();
  const requestsApi = useMemo(() => createRequestsApi(transport), [transport]);
  const [items, setItems] = useState<HelpRequest[]>([]);
  const [taxonomy, setTaxonomy] = useState<HelpTaxonomyResponse | null>(null);
  const [filters, setFilters] = useState<RequestsListQuery>({ surface: "REQUESTS" });
  const [debouncedCity, setDebouncedCity] = useState<string | undefined>();
  const [debouncedHouma, setDebouncedHouma] = useState<string | undefined>();
  const [memberViewer, setMemberViewer] = useState<boolean | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(tab === "requests");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const effectiveFilters = useMemo<RequestsListQuery>(
    () => ({
      surface: "REQUESTS",
      ...(filters.sport ? { sport: filters.sport } : {}),
      ...(filters.subcategoryId ? { subcategoryId: filters.subcategoryId } : {}),
      ...(filters.needId ? { needId: filters.needId } : {}),
      ...(debouncedCity ? { city: debouncedCity } : {}),
      ...(debouncedHouma ? { houma: debouncedHouma } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.limit ? { limit: filters.limit } : {}),
    }),
    [
      debouncedCity,
      debouncedHouma,
      filters.limit,
      filters.needId,
      filters.sport,
      filters.status,
      filters.subcategoryId,
    ],
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
    void requestsApi
      .taxonomy("REQUESTS")
      .then((result) => {
        if (active) setTaxonomy(result);
      })
      .catch((reason) => {
        if (active) setError(protectedError(reason, "Unable to load Request categories"));
      });
    return () => {
      active = false;
    };
  }, [protectedError, requestsApi, tab]);

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
  const donationsActive = tab === "donations";

  return (
    <section className="page requests-page">
      <header className="help-hero panel">
        <div className="help-hero__copy">
          <span className="eyebrow">HOOMA HELP</span>
          <h1>{fundmeActive ? "FundMe" : donationsActive ? "Donations" : "Requests"}</h1>
          <p>
            {fundmeActive
              ? "FundMe will carry contributions for community needs once its own slice exists."
              : donationsActive
                ? "Give useful sports gear locally once the Donations domain is ready."
                : "Ask for sports gear, community roles, or local support around real HOOMA activity."}
          </p>
        </div>
        {tab === "requests" ? (
          <a className="help-action" href="/requests/new">
            <PlusIcon />
            <span>Create request</span>
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
            The surface is reserved. There is no campaign, donation form, payment intent or provider
            integration until the later FundMe slices own that behavior.
          </p>
        </section>
      ) : donationsActive ? (
        <section className="requests-empty panel">
          <DonationIcon className="requests-empty__icon" />
          <span className="eyebrow">DONATIONS</span>
          <h2>Donations are not live yet.</h2>
          <p className="muted">
            The Donations area is now part of HOOMA Help navigation. Giving and claiming items will
            stay disabled until the Donations domain, permissions, and lifecycle are implemented.
          </p>
        </section>
      ) : (
        <>
          {taxonomy ? (
            <RequestTaxonomyFilters taxonomy={taxonomy} value={filters} onChange={setFilters} />
          ) : null}
          <RequestFeed
            items={items}
            loading={loading || !taxonomy}
            error={error}
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => void loadMore()}
          />
        </>
      )}
    </section>
  );
}
