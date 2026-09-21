import type { MeResponse } from "@hooma/contracts";
import type { HelpRequestResponse } from "@hooma/contracts/requests";

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * One-shot coordination responses: compose, list, and the manager or responder
 * actions allowed by the current response status. Never a chat thread.
 */
export function RequestResponses({
  me,
  responses,
  manager,
  pendingAction,
  onAccept,
  onDecline,
  onWithdraw,
}: {
  readonly me: MeResponse;
  readonly responses: readonly HelpRequestResponse[];
  readonly manager: boolean;
  readonly pendingAction: string;
  readonly onAccept: (responseId: string) => void;
  readonly onDecline: (responseId: string) => void;
  readonly onWithdraw: (responseId: string) => void;
}) {
  if (responses.length === 0) return null;

  return (
    <section className="request-responses panel">
      <div className="request-responses__heading">
        <h2>{manager ? "Responses" : "Your responses"}</h2>
        <span className="request-responses__count">{responses.length}</span>
      </div>
      <div className="request-responses__list">
        {responses.map((response) => {
          const own = response.responderUserId === me.id;
          return (
            <article className="request-response" key={response.id}>
              <div className="request-card__topline">
                <span className="request-response__author">
                  {own ? "Your response" : "Player response"}
                </span>
                <span className={`request-status request-status--${response.status.toLowerCase()}`}>
                  <span className="request-status__dot" aria-hidden="true" />
                  {titleCase(response.status)}
                </span>
              </div>
              <p>{response.message}</p>
              {manager && response.status === "PENDING" ? (
                <div className="request-action-row">
                  <button
                    type="button"
                    className="help-action"
                    disabled={Boolean(pendingAction)}
                    onClick={() => onAccept(response.id)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="help-action help-action--quiet"
                    disabled={Boolean(pendingAction)}
                    onClick={() => onDecline(response.id)}
                  >
                    Decline
                  </button>
                </div>
              ) : null}
              {own && (response.status === "PENDING" || response.status === "ACCEPTED") ? (
                <div className="request-action-row">
                  <button
                    type="button"
                    className="help-action help-action--quiet"
                    disabled={Boolean(pendingAction)}
                    onClick={() => onWithdraw(response.id)}
                  >
                    Withdraw response
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
