import { useEffect, useState, type FormEvent } from "react";
import type { PlatformAuditEntry } from "@hooma/frontend";

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

  return (
    <section className="panel admin-audit-section" id="audit-archive">
      <div className="section-heading">
        <div>
          <p className="eyebrow">EVIDENCE</p>
          <h2>Audit Archive</h2>
        </div>
        <span>{loadState === "ready" ? entries.length : "—"}</span>
      </div>

      <form className="admin-manager-form" onSubmit={submitFilters}>
        <label>
          <span>Actor user id</span>
          <input
            name="actor"
            value={draftFilters.actor}
            onChange={(event) => updateDraftFilter("actor", event.currentTarget.value)}
            placeholder="Filter by actor user id"
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
          <span>Entity type</span>
          <input
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
        <button type="submit" disabled={loadState === "loading"}>
          {loadState === "loading" ? "Applying audit filters…" : "Apply audit filters"}
        </button>
      </form>

      {loadState === "loading" ? <p className="muted">Loading audit archive…</p> : null}
      {loadState === "error" ? (
        <div>
          <p className="muted">Audit archive is unavailable.</p>
          <button type="button" onClick={onRetry}>
            Retry audit archive
          </button>
        </div>
      ) : null}
      {loadState === "ready" && !entries.length ? (
        <p className="muted">
          {isFiltered ? "No audit entries match these filters." : "No audit entries are available."}
        </p>
      ) : null}
      {loadState === "ready" && entries.length ? (
        <div className="admin-audit-list">
          {entries.map((entry) => (
            <article key={entry.id}>
              <strong>{entry.action}</strong>
              <span>
                {entry.entityType}
                {entry.entityId ? ` · ${entry.entityId}` : ""}
              </span>
              <small>{entry.actorUserId ? `Actor ${entry.actorUserId}` : "System actor"}</small>
              <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
            </article>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        disabled={!hasMore || isLoadingMore || loadState !== "ready"}
        onClick={onLoadMore}
      >
        {isLoadingMore
          ? "Loading more audit entries…"
          : hasMore
            ? "Load more audit entries"
            : "No more audit entries"}
      </button>
    </section>
  );
}
