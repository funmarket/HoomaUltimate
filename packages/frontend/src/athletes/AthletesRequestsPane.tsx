import { useEffect, useMemo, useState } from "react";
import type { HelpTaxonomyResponse } from "@hooma/contracts/help-taxonomy";
import type { HelpRequest } from "@hooma/contracts/requests";
import { useHoomaFrontend } from "../context";
import { createRequestsApi, type RequestsListQuery } from "../requests/api";
import { RequestFeed } from "../requests/RequestFeed";
import { RequestTaxonomyFilters } from "../requests/RequestTaxonomyFilters";

export function AthletesRequestsPane() {
  const { api, transport, protectedError } = useHoomaFrontend();
  const requestsApi = useMemo(() => createRequestsApi(transport), [transport]);
  const [taxonomy, setTaxonomy] = useState<HelpTaxonomyResponse | null>(null);
  const [items, setItems] = useState<HelpRequest[]>([]);
  const [filters, setFilters] = useState<RequestsListQuery>({
    surface: "ATHLETES",
    requestType: "SPORT",
  });
  const [debouncedCity, setDebouncedCity] = useState<string | undefined>();
  const [debouncedHouma, setDebouncedHouma] = useState<string | undefined>();
  const [debouncedQuery, setDebouncedQuery] = useState<string | undefined>();
  const [memberViewer, setMemberViewer] = useState<boolean | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const effectiveFilters = useMemo<RequestsListQuery>(
    () => ({
      surface: "ATHLETES",
      requestType: "SPORT",
      ...(filters.sport ? { sport: filters.sport } : {}),
      ...(filters.subcategoryId ? { subcategoryId: filters.subcategoryId } : {}),
      ...(filters.needId ? { needId: filters.needId } : {}),
      ...(debouncedCity ? { city: debouncedCity } : {}),
      ...(debouncedHouma ? { houma: debouncedHouma } : {}),
      ...(debouncedQuery ? { q: debouncedQuery } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.limit ? { limit: filters.limit } : {}),
    }),
    [
      debouncedCity,
      debouncedHouma,
      debouncedQuery,
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
      setDebouncedQuery(filters.q?.trim() || undefined);
    }, 300);
    return () => clearTimeout(handle);
  }, [filters.city, filters.houma, filters.q]);

  useEffect(() => {
    let active = true;
    setError("");
    void Promise.all([requestsApi.taxonomy("ATHLETES"), api.identity.meOptional()])
      .then(([currentTaxonomy, me]) => {
        if (!active) return;
        setTaxonomy(currentTaxonomy);
        setMemberViewer(Boolean(me));
      })
      .catch((reason) => {
        if (!active) return;
        setError(protectedError(reason, "Unable to load Athletes Requests"));
        setMemberViewer(null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, protectedError, requestsApi]);

  useEffect(() => {
    if (memberViewer === null || !taxonomy) return;
    let active = true;
    setLoading(true);
    setError("");
    setNextCursor(null);
    void (async () => {
      try {
        const result = memberViewer
          ? await requestsApi.memberList(effectiveFilters)
          : await requestsApi.publicList(effectiveFilters);
        if (!active) return;
        setItems(result.items);
        setNextCursor(result.nextCursor);
      } catch (reason) {
        if (active) setError(protectedError(reason, "Unable to load Athletes Requests"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [effectiveFilters, memberViewer, protectedError, requestsApi, taxonomy]);

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
      setError(protectedError(reason, "Unable to load more Athletes Requests"));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="athletes-requests" aria-labelledby="athletes-requests-title">
      <div className="athletes-requests__heading">
        <div>
          <p className="eyebrow">Requests</p>
          <h2 id="athletes-requests-title">What athletes need</h2>
        </div>
        <a
          className="button athletes-action athletes-action--primary"
          href="/requests/new?surface=ATHLETES"
        >
          Create Request
        </a>
      </div>

      {taxonomy ? (
        <RequestTaxonomyFilters
          taxonomy={taxonomy}
          value={filters}
          onChange={(next) => setFilters({ ...next, surface: "ATHLETES", requestType: "SPORT" })}
          sportOnly
        />
      ) : null}

      <RequestFeed
        items={items}
        loading={loading || !taxonomy}
        error={error}
        nextCursor={nextCursor}
        loadingMore={loadingMore}
        onLoadMore={() => void loadMore()}
      />
    </section>
  );
}
