import { useEffect, useState, type FormEvent } from "react";
import type { PlatformAuditEntry } from "@hooma/frontend";
import { AdminIcon } from "./AdminIcons";

type AuditLoadState = "loading" | "ready" | "error";

export type AuditArchiveFilters = {
  readonly actor: string;
  readonly action: string;
  readonly entityType: string;
  readonly from: string;
  readonly to: string;
};

const EMPTY_FILTERS: AuditArchiveFilters = {
  actor: "",
  action: "",
  entityType: "",
  from: "",
  to: "",
};

function hasActiveFilters(filters: AuditArchiveFilters): boolean {
  return Boolean(
    filters.actor.trim() ||
    filters.action.trim() ||
    filters.entityType.trim() ||
    filters.from.trim() ||
    filters.to.trim(),
  );
}

function normalizeFilters(filters: AuditArchiveFilters): AuditArchiveFilters {
  return {
    actor: filters.actor.trim(),
    action: filters.action.trim(),
    entityType: filters.entityType.trim(),
    from: filters.from.trim(),
    to: filters.to.trim(),
  };
}

export function AuditArchive({
  entries,
  loadState,
  filters = EMPTY_FILTERS,
  hasMore = false,
  isLoadingMore = false,
  onFilterChange = () => undefined,
  onRetry = () => undefined,
  onLoadMore = () => undefined,
}: {
  readonly entries: readonly PlatformAuditEntry[];
  readonly loadState: AuditLoadState;
  readonly filters?: AuditArchiveFilters;
  readonly hasMore?: boolean;
  readonly isLoadingMore?: boolean;
  readonly onFilterChange?: (filters: AuditArchiveFilters) => void;
  readonly onRetry?: () => void;
  readonly onLoadMore?: () => void;
}) {
  const [draftFilters, setDraftFilters] = useState<AuditArchiveFilters>(filters);
  const isFiltered = hasActiveFilters(filters);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  function updateDraftFilter(name: keyof AuditArchiveFilters, value: string) {
    setDraftFilters((current) => ({ ...current, [name]: value }));
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onFilterChange(normalizeFilters(draftFilters));
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS);
    onFilterChange(EMPTY_FILTERS);
  }

  return (
    <section className="admin-panel admin-audit-section" id="audit-archive">
      <div className="section-heading admin-toolbar">
        <div>
          <p className="eyebrow">EVIDENCE BROWSER</p>
          <h2>Audit Archive</h2>
        </div>
        <span className="admin-chip">
          <AdminIcon name="archive" />
          {loadState === "ready" ? `${entries.length} rows` : "syncing"}
        </span>
      </div>

      <form className="admin-filter-toolbar" onSubmit={submitFilters}>
        <label>
          <span>Actor</span>
          <input
            aria-label="Actor user id"
            name="actor"
            value={draftFilters.actor}
            onChange={(event) => updateDraftFilter("actor", event.currentTarget.value)}
            placeholder="Actor user id"
          />
        </label>
        <label>
          <span>Action</span>
          <input
            name="action"
            value={draftFilters.action}
            onChange={(event) => updateDraftFilter("action", event.currentTarget.value)}
            placeholder="USER_SESSION_REVOKED"
          />
        </label>
        <label>
          <span>Entity</span>
          <input
            aria-label="Entity type"
            name="entityType"
            value={draftFilters.entityType}
            onChange={(event) => updateDraftFilter("entityType", event.currentTarget.value)}
            placeholder="User"
          />
        </label>
        <label>
          <span>From</span>
          <input
            name="from"
            type="date"
            value={draftFilters.from}
            onChange={(event) => updateDraftFilter("from", event.currentTarget.value)}
          />
        </label>
        <label>
          <span>To</span>
          <input
            name="to"
            type="date"
            value={draftFilters.to}
            onChange={(event) => updateDraftFilter("to", event.currentTarget.value)}
          />
        </label>
        <div className="admin-toolbar-actions">
          <button
            aria-label="Apply audit filters"
            className="admin-primary-action"
            type="submit"
            disabled={loadState === "loading"}
          >
            <AdminIcon name="filter" />
            {loadState === "loading" ? "Applying…" : "Apply"}
          </button>
          <button className="admin-ghost-action" type="button" onClick={clearFilters}>
            Clear
          </button>
        </div>
      </form>

      {loadState === "loading" ? (
        <p className="muted admin-empty-state">Loading audit archive…</p>
      ) : null}
      {loadState === "error" ? (
        <div className="admin-empty-state">
          <p className="muted">Audit archive is unavailable.</p>
          <button className="admin-ghost-action" type="button" onClick={onRetry}>
            <AdminIcon name="retry" />
            Retry audit archive
          </button>
        </div>
      ) : null}
      {loadState === "ready" && !entries.length ? (
        <p className="muted admin-empty-state">
          {isFiltered ? "No audit entries match these filters." : "No audit entries are available."}
        </p>
      ) : null}
      {loadState === "ready" && entries.length ? (
        <div
          className="admin-table admin-audit-table"
          role="table"
          aria-label="Audit archive entries"
        >
          <div className="admin-table-header" role="row">
            <span role="columnheader">Action</span>
            <span role="columnheader">Entity</span>
            <span role="columnheader">Actor</span>
            <span role="columnheader">Timestamp</span>
          </div>
          {entries.map((entry) => (
            <article className="admin-table-row" role="row" key={entry.id}>
              <strong role="cell">{entry.action}</strong>
              <span role="cell">
                {entry.entityType}
                {entry.entityId ? ` · ${entry.entityId}` : ""}
              </span>
              <small role="cell">
                {entry.actorUserId ? `Actor ${entry.actorUserId}` : "System actor"}
              </small>
              <time role="cell" dateTime={entry.createdAt}>
                {new Date(entry.createdAt).toLocaleString()}
              </time>
            </article>
          ))}
        </div>
      ) : null}
      <footer className="admin-pagination-footer">
        <button
          className="admin-ghost-action"
          type="button"
          disabled={!hasMore || isLoadingMore || loadState !== "ready"}
          onClick={onLoadMore}
        >
          <AdminIcon name={hasMore ? "loadMore" : "check"} />
          {isLoadingMore
            ? "Loading more audit entries…"
            : hasMore
              ? "Load more audit entries"
              : "No more audit entries"}
        </button>
      </footer>
    </section>
  );
}
