import type { HelpTaxonomyResponse } from "@hooma/contracts/help-taxonomy";
import { FilterIcon } from "../help/HelpIcons";
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
  const selectedSport =
    value.requestType === "SPORT"
      ? taxonomy.sports.find((entry) => entry.sport === value.sport)
      : undefined;
  const subcategories =
    value.requestType === "COMMUNITY"
      ? taxonomy.community.subcategories
      : (selectedSport?.subcategories ?? []);
  const selectedSubcategory = subcategories.find((entry) => entry.id === value.subcategoryId);

  function patch(change: RequestsListQuery) {
    onChange({ ...value, ...change });
  }

  return (
    <section className="request-filters panel" aria-label="Request filters">
      <div className="request-filters__heading">
        <FilterIcon />
        <h2>Find a need</h2>
      </div>
      <div className="request-filters__fields">
        {sportOnly ? null : (
          <div className="request-field">
            <label className="request-field__label" htmlFor="request-filter-type">
              Request Type
            </label>
            <select
              id="request-filter-type"
              className={FIELD_CLASS}
              value={value.requestType ?? ""}
              onChange={(event) =>
                patch({
                  requestType: (event.target.value ||
                    undefined) as RequestsListQuery["requestType"],
                  sport: undefined,
                  subcategoryId: undefined,
                  needId: undefined,
                })
              }
            >
              <option value="">All request types</option>
              <option value="SPORT">Sport</option>
              <option value="COMMUNITY">Community</option>
            </select>
          </div>
        )}

        {value.requestType === "SPORT" ? (
          <div className="request-field">
            <label className="request-field__label" htmlFor="request-filter-sport">
              Sport
            </label>
            <select
              id="request-filter-sport"
              className={FIELD_CLASS}
              value={value.sport ?? ""}
              onChange={(event) =>
                patch({
                  sport: (event.target.value || undefined) as RequestsListQuery["sport"],
                  subcategoryId: undefined,
                  needId: undefined,
                })
              }
            >
              <option value="">All sports</option>
              {taxonomy.sports.map((entry) => (
                <option key={entry.sport} value={entry.sport}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="request-field">
          <label className="request-field__label" htmlFor="request-filter-subcategory">
            Category
          </label>
          <select
            id="request-filter-subcategory"
            className={FIELD_CLASS}
            value={value.subcategoryId ?? ""}
            disabled={
              value.requestType === "SPORT" ? !selectedSport : value.requestType !== "COMMUNITY"
            }
            onChange={(event) =>
              patch({
                subcategoryId: event.target.value || undefined,
                needId: undefined,
              })
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
    </section>
  );
}
