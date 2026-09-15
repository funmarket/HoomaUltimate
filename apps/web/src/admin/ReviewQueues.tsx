import type {
  AdminPitchReviewQueueItem,
  AdminPlaceOwnershipReviewQueueItem,
  AdminPlaceReviewQueueItem,
} from "@hooma/contracts/platform-admin";
import { formatPitchHourlyRate } from "@hooma/frontend";

type QueueName = "places" | "place-ownership" | "pitch";
export type QueueLoadState = "loading" | "ready" | "error";
type AdminQueueDisplayItem =
  | AdminPlaceReviewQueueItem
  | AdminPlaceOwnershipReviewQueueItem
  | AdminPitchReviewQueueItem;

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
  onDecision,
}: {
  readonly id: string;
  readonly title: string;
  readonly eyebrow: string;
  readonly items: readonly AdminQueueDisplayItem[];
  readonly loadState: QueueLoadState;
  readonly onDecision: (id: string, decision: "APPROVE" | "REJECT") => void;
}) {
  return (
    <section className="panel admin-review-section" id={id}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span>{loadState === "ready" ? items.length : "—"}</span>
      </div>
      <div className="admin-review-list">
        {loadState === "loading" ? <p className="muted">Loading queue…</p> : null}
        {loadState === "error" ? <p className="muted">This queue is unavailable.</p> : null}
        {loadState === "ready"
          ? items.map((item) => (
              <article className="admin-review-row" key={item.id}>
                <div>
                  <strong>{item.place.name}</strong>
                  <span>{item.place.houma || item.place.city || item.place.address}</span>
                  <span>
                    Submitted by {item.applicant.displayName} · @{item.applicant.username}
                  </span>
                  {"hourlyRateMinor" in item && item.hourlyRateMinor !== null && item.currency ? (
                    <p>
                      {formatPitchHourlyRate(item.hourlyRateMinor, item.currency)} {" "}
                      {item.currency} / hour
                    </p>
                  ) : null}
                  {"summary" in item && item.summary ? <p>{item.summary}</p> : null}
                  {"evidence" in item && item.evidence ? (
                    <p className="admin-review-evidence">{item.evidence}</p>
                  ) : null}
                </div>
                <div className="admin-review-actions">
                  <button type="button" onClick={() => onDecision(item.id, "APPROVE")}>
                    Approve
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onDecision(item.id, "REJECT")}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))
          : null}
        {loadState === "ready" && !items.length ? <p className="muted">Queue is clear.</p> : null}
      </div>
    </section>
  );
}

export function ReviewQueues({
  queues,
  queueStates,
  showPlaceQueues,
  showPitchQueue,
  onDecision,
}: {
  readonly queues: AdminQueues;
  readonly queueStates: AdminQueueStates;
  readonly showPlaceQueues: boolean;
  readonly showPitchQueue: boolean;
  readonly onDecision: (
    queue: QueueName,
    id: string,
    decision: "APPROVE" | "REJECT",
  ) => void;
}) {
  return (
    <>
      {showPlaceQueues ? (
        <QueueSection
          id="places"
          eyebrow="PLACES"
          title="Place submissions"
          items={queues.places}
          loadState={queueStates.places}
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
          onDecision={(id, decision) => onDecision("pitch", id, decision)}
        />
      ) : null}
    </>
  );
}
