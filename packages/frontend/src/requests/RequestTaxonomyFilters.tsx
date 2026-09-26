import { useState } from "react";
import type { HelpTaxonomyResponse } from "@hooma/contracts/help-taxonomy";
import { CloseIcon, FilterIcon, SearchIcon } from "../help/HelpIcons";
import type { RequestsListQuery } from "./api";

const FIELD_CLASS = "request-field__control";

type AdvancedFilters = Pick<
  RequestsListQuery,
  "subcategoryId" | "needId" | "city" | "houma" | "status"
>;

function advancedFrom(value: RequestsListQuery): AdvancedFilters {
  return {
    subcategoryId: value.subcategoryId,
    needId: value.needId,
    city: value.city,
    houma: value.houma,
    status: value.status,
  };
}

export function RequestTaxonomyFilters({
  taxonomy,
  value,
  onChange,
  sportOnly = false,
}: {
  readonly taxonomy: HelpTaxonomyResponse;
  readonly value: RequestsListQuery;
  readonly onChange: (next: RequestsListQuery) => void;
  readonly sportOnly?: boolean;
}) {
  const root = sportOnly ? "SPORT" : (value.requestType ?? "SPORT");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<AdvancedFilters>(() => advancedFrom(value));
  const selectedSport =
    root === "SPORT" ? taxonomy.sports.find((entry) => entry.sport === value.sport) : undefined;
  const sportSubcategories = selectedSport
    ? selectedSport.subcategories
    : taxonomy.sports.flatMap((entry) => entry.subcategories);
  const subcategories =
    root === "COMMUNITY" ? taxonomy.community.subcategories : sportSubcategories;
  const selectedSubcategory = subcategories.find((entry) => entry.id === draft.subcategoryId);
  const activeAdvancedCount = [
    root === "SPORT" && value.subcategoryId,
    value.needId,
    value.city,
    value.houma,
    value.status,
  ].filter(Boolean).length;

  function selectRoot(nextRoot: "SPORT" | "COMMUNITY") {
    if (sportOnly || root === nextRoot) return;
    setDraft((current) => ({ ...current, subcategoryId: undefined, needId: undefined }));
    onChange({
      ...value,
      requestType: nextRoot,
      sport: undefined,
      subcategoryId: undefined,
      needId: undefined,
    });
  }

  function selectQuick(valueId?: string) {
    if (root === "SPORT") {
      onChange({
        ...value,
        requestType: "SPORT",
        sport: valueId as RequestsListQuery["sport"],
        subcategoryId: undefined,
        needId: undefined,
      });
      setDraft((current) => ({ ...current, subcategoryId: undefined, needId: undefined }));
      return;
    }
    onChange({ ...value, subcategoryId: valueId, needId: undefined });
    setDraft((current) => ({ ...current, subcategoryId: valueId, needId: undefined }));
  }

  function toggleFilters() {
    setDraft(advancedFrom(value));
    setFiltersOpen((current) => !current);
  }

  function applyFilters() {
    onChange({
      ...value,
      subcategoryId: draft.subcategoryId,
      needId: draft.needId,
      city: draft.city?.trim() || undefined,
      houma: draft.houma?.trim() || undefined,
      status: draft.status,
    });
    setFiltersOpen(false);
  }

  function resetFilters() {
    const subcategoryId = root === "COMMUNITY" ? value.subcategoryId : undefined;
    const cleared: AdvancedFilters = { subcategoryId };
    setDraft(cleared);
    onChange({
      ...value,
      subcategoryId,
      needId: undefined,
      city: undefined,
      houma: undefined,
      status: undefined,
    });
    setFiltersOpen(false);
  }

  const quickOptions =
    root === "SPORT"
      ? taxonomy.sports.map((entry) => ({ id: entry.sport, label: entry.label }))
      : taxonomy.community.subcategories.map((entry) => ({ id: entry.id, label: entry.label }));
  const quickValue = root === "SPORT" ? value.sport : value.subcategoryId;

  return (
    <section className="request-discovery" aria-label="Request discovery">
      {sportOnly ? null : (
        <div className="request-root-switch" aria-label="Request type">
          <button type="button" aria-pressed={root === "SPORT"} onClick={() => selectRoot("SPORT")}>
            Sport
          </button>
          <button
            type="button"
            aria-pressed={root === "COMMUNITY"}
            onClick={() => selectRoot("COMMUNITY")}
          >
            Community
          </button>
        </div>
      )}

      <div className="request-search-row">
        <label className="request-search">
          <span className="sr-only">Search Requests</span>
          <SearchIcon className="request-search__icon" />
          <input
            className={FIELD_CLASS}
            type="search"
            value={value.q ?? ""}
            placeholder="Search requests…"
            onChange={(event) => onChange({ ...value, q: event.target.value || undefined })}
          />
        </label>
        <button
          type="button"
          className="request-filter-trigger"
          aria-expanded={filtersOpen}
          aria-controls="request-advanced-filters"
          onClick={toggleFilters}
        >
          <FilterIcon />
          <span>Filters</span>
          {activeAdvancedCount ? (
            <span className="request-filter-trigger__count">{activeAdvancedCount}</span>
          ) : null}
        </button>
      </div>

      <div
        className="request-quick-rail"
        aria-label={`${root === "SPORT" ? "Sport" : "Community"} categories`}
      >
        <button
          type="button"
          className={!quickValue ? "is-active" : undefined}
          aria-pressed={!quickValue}
          onClick={() => selectQuick()}
        >
          All
        </button>
        {quickOptions.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={quickValue === entry.id ? "is-active" : undefined}
            aria-pressed={quickValue === entry.id}
            onClick={() => selectQuick(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {filtersOpen ? (
        <div id="request-advanced-filters" className="request-filters panel">
          <div className="request-filters__heading">
            <span className="request-filters__title">
              <FilterIcon />
              <h2>Filters</h2>
            </span>
            <button type="button" className="request-filters__close" onClick={toggleFilters}>
              <CloseIcon />
              <span className="sr-only">Close filters</span>
            </button>
          </div>
          <div className="request-filters__fields">
            <div className="request-field">
              <label className="request-field__label" htmlFor="request-filter-subcategory">
                Category
              </label>
              <select
                id="request-filter-subcategory"
                className={FIELD_CLASS}
                value={draft.subcategoryId ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    subcategoryId: event.target.value || undefined,
                    needId: undefined,
                  }))
                }
              >
                <option value="">All categories</option>
                {subcategories.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="request-field">
              <label className="request-field__label" htmlFor="request-filter-need">
                Specific need
              </label>
              <select
                id="request-filter-need"
                className={FIELD_CLASS}
                value={draft.needId ?? ""}
                disabled={!selectedSubcategory}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, needId: event.target.value || undefined }))
                }
              >
                <option value="">All needs</option>
                {(selectedSubcategory?.needs ?? []).map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="request-field">
              <label className="request-field__label" htmlFor="request-filter-city">
                City
              </label>
              <input
                id="request-filter-city"
                className={FIELD_CLASS}
                value={draft.city ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, city: event.target.value || undefined }))
                }
              />
            </div>
            <div className="request-field">
              <label className="request-field__label" htmlFor="request-filter-houma">
                Houma
              </label>
              <input
                id="request-filter-houma"
                className={FIELD_CLASS}
                value={draft.houma ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, houma: event.target.value || undefined }))
                }
              />
            </div>
            <div className="request-field">
              <label className="request-field__label" htmlFor="request-filter-status">
                Status
              </label>
              <select
                id="request-filter-status"
                className={FIELD_CLASS}
                value={draft.status ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: (event.target.value || undefined) as RequestsListQuery["status"],
                  }))
                }
              >
                <option value="">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="FULFILLED">Fulfilled</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
          </div>
          <div className="request-filters__actions">
            <button type="button" className="help-action help-action--quiet" onClick={resetFilters}>
              Reset
            </button>
            <button
              type="button"
              className="help-action help-action--primary"
              onClick={applyFilters}
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
