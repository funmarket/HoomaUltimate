import type { HelpRequest } from "@hooma/contracts/requests";
import { RequestIcon } from "../help/HelpIcons";
import { RequestCard } from "./RequestCard";

export function RequestFeed({
  items,
  loading,
  error,
  nextCursor,
  loadingMore,
  onLoadMore,
  memberView = false,
}: {
  readonly items: readonly HelpRequest[];
  readonly loading: boolean;
  readonly error: string;
  readonly nextCursor: string | null;
  readonly loadingMore: boolean;
  readonly onLoadMore: () => void;
  /** True when this feed is the authenticated member list, where scoped Requests are rendered. */
  readonly memberView?: boolean;
}) {
  if (error) return <p className="status request-error">{error}</p>;
  if (loading) return <p className="status">Loading Requests…</p>;

  if (items.length === 0) {
    return (
      <section className="requests-empty panel">
        <RequestIcon className="requests-empty__icon" />
        <h2>No Requests match these filters.</h2>
        <p className="muted">Create one if there is something your sports community needs.</p>
      </section>
    );
  }

  return (
    <>
      <section className="request-list" aria-label="Requests">
        {items.map((item) => (
          <RequestCard key={item.id} item={item} memberView={memberView} />
        ))}
      </section>
      {nextCursor ? (
        <button type="button" className="help-action" disabled={loadingMore} onClick={onLoadMore}>
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </>
  );
}
