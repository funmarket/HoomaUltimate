import type {
  AdminPitchReviewQueueItem,
  AdminPlaceOwnershipReviewQueueItem,
  AdminPlaceReviewQueueItem,
} from "@hooma/contracts/platform-admin";
import { formatPitchHourlyRate } from "@hooma/frontend";
import { AdminIcon } from "./AdminIcons";

type QueueName = "places" | "place-ownership" | "pitch";
export type QueueLoadState = "loading" | "ready" | "error";
type AdminQueueDisplayItem =
  AdminPlaceReviewQueueItem | AdminPlaceOwnershipReviewQueueItem | AdminPitchReviewQueueItem;

export interface AdminQueues {
  places: AdminPlaceReviewQueueItem[];
  "place-ownership": AdminPlaceOwnershipReviewQueueItem[];
  pitch: AdminPitchReviewQueueItem[];
}

export type AdminQueueStates = Record<QueueName, QueueLoadState>;

function QueueSection({
  id,
  title,
  eyebrow,
  items,
  loadState,
  pendingId,
  decisionsDisabled,
  onDecision,
}: {
  readonly id: string;
  readonly title: string;
  readonly eyebrow: string;
  readonly items: readonly AdminQueueDisplayItem[];
  readonly loadState: QueueLoadState;
  readonly pendingId: string | null;
  readonly decisionsDisabled: boolean;
  readonly onDecision: (id: string, decision: "APPROVE" | "REJECT") => void;
}) {
  return (
    <section className="admin-panel admin-review-section" id={id}>
      <div className="section-heading admin-toolbar">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span className="admin-chip">
          <AdminIcon name="filter" />
          {loadState === "ready" ? `${items.length} queued` : "—"}
        </span>
      </div>
      <div className="admin-review-list admin-row-list">
        {loadState === "loading" ? <p className="muted admin-empty-state">Loading queue…</p> : null}
        {loadState === "error" ? (
          <p className="muted admin-empty-state">This queue is unavailable.</p>
        ) : null}
        {loadState === "ready"
          ? items.map((item) => (
              <article className="admin-review-row admin-data-row" key={item.id}>
                <div>
                  <strong>{item.place.name}</strong>
                  <span>{item.place.houma || item.place.city || item.place.address}</span>
                  <span>
                    Submitted by {item.applicant.displayName} · @{item.applicant.username}
                  </span>
                  {"hourlyRateMinor" in item && item.hourlyRateMinor !== null && item.currency ? (
                    <p>
                      {formatPitchHourlyRate(item.hourlyRateMinor, item.currency)} {item.currency} /
                      hour
                    </p>
                  ) : null}
                  {"summary" in item && item.summary ? <p>{item.summary}</p> : null}
                  {"evidence" in item && item.evidence ? (
                    <p className="admin-review-evidence">{item.evidence}</p>
                  ) : null}
                </div>
                <div className="admin-review-actions" aria-busy={decisionsDisabled}>
                  <button
                    className="admin-primary-action"
                    type="button"
                    disabled={decisionsDisabled}
                    onClick={() => onDecision(item.id, "APPROVE")}
                  >
                    <AdminIcon name="check" />
                    {pendingId === item.id ? "Saving decision…" : "Approve"}
                  </button>
                  <button
                    className="admin-danger-action"
                    type="button"
                    disabled={decisionsDisabled}
                    onClick={() => onDecision(item.id, "REJECT")}
                  >
                    <AdminIcon name="clear" />
                    Reject
                  </button>
                </div>
              </article>
            ))
          : null}
        {loadState === "ready" && !items.length ? (
          <p className="muted admin-empty-state">Queue is clear.</p>
        ) : null}
      </div>
    </section>
  );
}

export function ReviewQueues({
  queues,
  queueStates,
  showPlaceQueues,
  showPitchQueue,
  pendingDecision,
  onDecision,
}: {
  readonly queues: AdminQueues;
  readonly queueStates: AdminQueueStates;
  readonly showPlaceQueues: boolean;
  readonly showPitchQueue: boolean;
  readonly pendingDecision: { readonly queue: QueueName; readonly id: string } | null;
  readonly onDecision: (queue: QueueName, id: string, decision: "APPROVE" | "REJECT") => void;
}) {
  const decisionsDisabled = pendingDecision !== null;
  return (
    <>
      {showPlaceQueues ? (
        <QueueSection
          id="places"
          eyebrow="PLACES"
          title="Place submissions"
          items={queues.places}
          loadState={queueStates.places}
          pendingId={pendingDecision?.queue === "places" ? pendingDecision.id : null}
          decisionsDisabled={decisionsDisabled}
          onDecision={(id, decision) => onDecision("places", id, decision)}
        />
      ) : null}
      {showPlaceQueues ? (
        <QueueSection
          id="place-ownership"
          eyebrow="OWNERSHIP"
          title="Place ownership claims"
          items={queues["place-ownership"]}
          loadState={queueStates["place-ownership"]}
          pendingId={pendingDecision?.queue === "place-ownership" ? pendingDecision.id : null}
          decisionsDisabled={decisionsDisabled}
          onDecision={(id, decision) => onDecision("place-ownership", id, decision)}
        />
      ) : null}
      {showPitchQueue ? (
        <QueueSection
          id="pitch"
          eyebrow="PITCH"
          title="Pitch business applications"
          items={queues.pitch}
          loadState={queueStates.pitch}
          pendingId={pendingDecision?.queue === "pitch" ? pendingDecision.id : null}
          decisionsDisabled={decisionsDisabled}
          onDecision={(id, decision) => onDecision("pitch", id, decision)}
        />
      ) : null}
    </>
  );
}
