import { ATHLETES_SPORTS } from "@hooma/contracts/athletes";
import { HELP_CATEGORIES } from "@hooma/contracts/help";
import { FilterIcon } from "../help/HelpIcons";
import type { RequestsListQuery } from "./api";

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const FIELD_CLASS = "request-field__control";

export function RequestFilters({
  value,
  onChange,
}: {
  readonly value: RequestsListQuery;
  readonly onChange: (next: RequestsListQuery) => void;
}) {
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
        <div className="request-field">
          <label className="request-field__label" htmlFor="request-filter-category">
            Category
          </label>
          <select
            id="request-filter-category"
            className={FIELD_CLASS}
            value={value.category ?? ""}
            onChange={(event) =>
              patch({
                category: (event.target.value || undefined) as RequestsListQuery["category"],
              })
            }
          >
            <option value="">All categories</option>
            {HELP_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {titleCase(category)}
              </option>
            ))}
          </select>
        </div>

        <div className="request-field">
          <label className="request-field__label" htmlFor="request-filter-sport">
            Sport
          </label>
          <select
            id="request-filter-sport"
            className={FIELD_CLASS}
            value={value.sport ?? ""}
            onChange={(event) =>
              patch({ sport: (event.target.value || undefined) as RequestsListQuery["sport"] })
            }
          >
            <option value="">All sports</option>
            {ATHLETES_SPORTS.map((sport) => (
              <option key={sport} value={sport}>
                {titleCase(sport)}
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
