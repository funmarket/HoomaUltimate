import type { HelpTaxonomyResponse } from "@hooma/contracts/help-taxonomy";
import { FilterIcon, SearchIcon } from "../help/HelpIcons";
import type { RequestsListQuery } from "./api";

const FIELD_CLASS = "request-field__control";

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
  const selectedSport =
    root === "SPORT" ? taxonomy.sports.find((entry) => entry.sport === value.sport) : undefined;
  const subcategories =
    root === "COMMUNITY" ? taxonomy.community.subcategories : (selectedSport?.subcategories ?? []);
  const selectedSubcategory = subcategories.find((entry) => entry.id === value.subcategoryId);

  function patch(change: Partial<RequestsListQuery>) {
    onChange({ ...value, ...change });
  }

  function selectRoot(nextRoot: "SPORT" | "COMMUNITY") {
    if (sportOnly || root === nextRoot) return;
    patch({
      requestType: nextRoot,
      sport: undefined,
      subcategoryId: undefined,
      needId: undefined,
    });
  }

  function selectQuick(valueId?: string) {
    if (root === "SPORT") {
      patch({
        requestType: "SPORT",
        sport: valueId as RequestsListQuery["sport"],
        subcategoryId: undefined,
        needId: undefined,
      });
      return;
    }
    patch({ subcategoryId: valueId, needId: undefined });
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
            onChange={(event) => patch({ q: event.target.value || undefined })}
          />
        </label>
        <span className="request-filter-affordance" aria-hidden="true">
          <FilterIcon />
          <span>Filters</span>
        </span>
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

      <div className="request-filters panel" aria-label="Request filters">
        <div className="request-filters__heading">
          <FilterIcon />
          <h2>Find a need</h2>
        </div>
        <div className="request-filters__fields">
          <div className="request-field">
            <label className="request-field__label" htmlFor="request-filter-subcategory">
              Category
            </label>
            <select
              id="request-filter-subcategory"
              className={FIELD_CLASS}
              value={value.subcategoryId ?? ""}
              disabled={root === "SPORT" && !selectedSport}
              onChange={(event) =>
                patch({ subcategoryId: event.target.value || undefined, needId: undefined })
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
              value={value.needId ?? ""}
              disabled={!selectedSubcategory}
              onChange={(event) => patch({ needId: event.target.value || undefined })}
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
              value={value.city ?? ""}
              onChange={(event) => patch({ city: event.target.value || undefined })}
            />
          </div>
          <div className="request-field">
            <label className="request-field__label" htmlFor="request-filter-houma">
              Houma
            </label>
            <input
              id="request-filter-houma"
              className={FIELD_CLASS}
              value={value.houma ?? ""}
              onChange={(event) => patch({ houma: event.target.value || undefined })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
