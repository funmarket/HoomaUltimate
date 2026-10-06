import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { MeResponse } from "@hooma/contracts";
import type { HelpRequest, HelpRequestResponse } from "@hooma/contracts/requests";
import { useHoomaFrontend } from "../context";
import { HoomaApiError } from "../http";
import { ChevronRightIcon } from "../help/HelpIcons";
import { createRequestsApi } from "./api";
import { RequestRequester } from "./RequestRequester";
import { RequestResponses } from "./RequestResponses";

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

function terminalMessage(status: HelpRequest["status"]): string | null {
  if (status === "FULFILLED") return "This Request has been fulfilled.";
  if (status === "CANCELLED") return "This Request was cancelled.";
  if (status === "EXPIRED") return "This Request has expired.";
  return null;
}

/**
 * Presentation-only manager check: the backend remains the authority for
 * visibility, response privacy and every lifecycle transition.
 */
function canManage(me: MeResponse | null, item: HelpRequest | null): boolean {
  if (!me || !item) return false;
  if (item.publisherCommunityId) {
    return me.communities.some(
      (community) =>
        community.id === item.publisherCommunityId &&
        (community.role === "FOUNDER" || community.role === "COACH"),
    );
  }
  if (item.publisherTeamId) {
    return me.teams.some(
      (team) => team.id === item.publisherTeamId && team.responsibilities.includes("COACH"),
    );
  }
  if (item.publisherAthletesCommunityId) {
    return me.athletesCommunities.some(
      (community) =>
        community.id === item.publisherAthletesCommunityId &&
        (community.role === "FOUNDER" || community.role === "MODERATOR"),
    );
  }
  return item.createdByUserId === me.id;
}

export function RequestDetailPage({ requestId }: { readonly requestId: string }) {
  const { api, transport, protectedError, authenticationHref } = useHoomaFrontend();
  const requestsApi = useMemo(() => createRequestsApi(transport), [transport]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [item, setItem] = useState<HelpRequest | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [responses, setResponses] = useState<HelpRequestResponse[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingAction, setPendingAction] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError("");
      setMediaError("");
      setImageUrl("");
      try {
        const current = await api.identity.meOptional();
        const detail = current
          ? await requestsApi.memberDetail(requestId)
          : await requestsApi.publicDetail(requestId);
        let deliveredImageUrl = "";
        if (detail.image) {
          try {
            const delivery = current
              ? await requestsApi.memberImageDelivery(requestId)
              : await requestsApi.publicImageDelivery(requestId);
            deliveredImageUrl = delivery.contentUrl;
          } catch (reason) {
            if (active) {
              setMediaError(protectedError(reason, "Unable to load Request image"));
            }
          }
        }
        let visible: HelpRequestResponse[] = [];
        if (current) {
          try {
            visible = (await requestsApi.responses(requestId)).items;
          } catch (reason) {
            if (!(reason instanceof HoomaApiError && reason.status === 404)) throw reason;
          }
        }
        if (active) {
          setMe(current);
          setItem(detail);
          setImageUrl(deliveredImageUrl);
          setResponses(visible);
        }
      } catch (reason) {
        if (active) setError(protectedError(reason, "Unable to load Request"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [api, protectedError, requestId, requestsApi]);

  async function refreshMemberState(): Promise<void> {
    const [detail, visible] = await Promise.all([
      requestsApi.memberDetail(requestId),
      requestsApi.responses(requestId),
    ]);
    setItem(detail);
    setResponses(visible.items);
  }

  async function reconcileConflict(reason: unknown, fallback: string): Promise<void> {
    const originalError = protectedError(reason, fallback);
    setActionError(originalError);
    if (!(reason instanceof HoomaApiError && reason.status === 409)) return;
    try {
      await refreshMemberState();
    } catch {
      // Preserve the original conflict. A failed readback must not hide its cause.
    }
  }

  const manager = canManage(me, item);
  const ownResponse = me
    ? responses.find((response) => response.responderUserId === me.id)
    : undefined;
  const mutable = item?.status === "OPEN" || item?.status === "IN_PROGRESS";
  const originalCreator = Boolean(me && item && item.createdByUserId === me.id);
  const canRespond = Boolean(me && item && mutable && !manager && !originalCreator && !ownResponse);

  async function submitResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || pendingAction) return;
    setPendingAction("respond");
    setActionError("");
    try {
      const created = await requestsApi.respond(requestId, { message });
      setResponses((current) => [...current, created]);
      setMessage("");
    } catch (reason) {
      await reconcileConflict(reason, "Unable to send response");
    } finally {
      setPendingAction("");
    }
  }

  async function decide(responseId: string, decision: "accept" | "decline") {
    if (pendingAction) return;
    setPendingAction(`${decision}:${responseId}`);
    setActionError("");
    try {
      const updated =
        decision === "accept"
          ? await requestsApi.acceptResponse(requestId, responseId)
          : await requestsApi.declineResponse(requestId, responseId);
      setResponses((current) =>
        current.map((response) => (response.id === responseId ? updated : response)),
      );
      if (decision === "accept") {
        try {
          await refreshMemberState();
        } catch (reason) {
          setActionError(
            protectedError(reason, "Response accepted, but unable to refresh Request"),
          );
        }
      }
    } catch (reason) {
      await reconcileConflict(reason, `Unable to ${decision} response`);
    } finally {
      setPendingAction("");
    }
  }

  async function withdraw(responseId: string) {
    if (pendingAction) return;
    setPendingAction(`withdraw:${responseId}`);
    setActionError("");
    try {
      const updated = await requestsApi.withdrawResponse(requestId, responseId);
      setResponses((current) =>
        current.map((response) => (response.id === responseId ? updated : response)),
      );
    } catch (reason) {
      await reconcileConflict(reason, "Unable to withdraw response");
    } finally {
      setPendingAction("");
    }
  }

  async function transition(next: "fulfill" | "cancel") {
    if (pendingAction) return;
    setPendingAction(next);
    setActionError("");
    try {
      const updated =
        next === "fulfill"
          ? await requestsApi.fulfill(requestId)
          : await requestsApi.cancel(requestId);
      setItem(updated);
    } catch (reason) {
      await reconcileConflict(reason, `Unable to ${next} Request`);
    } finally {
      setPendingAction("");
    }
  }

  if (loading)
    return (
      <div className="hooma-lane--content">
        <p className="status">Loading Request…</p>
      </div>
    );
  if (error || !item)
    return (
      <div className="hooma-lane--content">
        <p className="status request-error">{error || "Request not found"}</p>
      </div>
    );

  const loginHref = authenticationHref(`/requests/${requestId}`);
  const terminal = terminalMessage(item.status);

  return (
    <div className="hooma-lane--content">
      <section className="page requests-page">
        <a className="request-back-link" href="/requests">
          <ChevronRightIcon className="request-back-link__icon" />
          <span>Requests</span>
        </a>

        <article className="request-detail panel">
          <header className="request-detail__header">
            <div className="request-card__topline">
              <span className="request-chip">
                {item.taxonomy?.need.label ?? titleCase(item.category)}
              </span>
              <span className={`request-status request-status--${item.status.toLowerCase()}`}>
                <span className="request-status__dot" aria-hidden="true" />
                {titleCase(item.status)}
              </span>
            </div>
            <RequestRequester requester={item.requester} />
          </header>

          {imageUrl ? (
            <img className="request-detail__image" src={imageUrl} alt="Request image" />
          ) : mediaError ? (
            <p className="request-media-feedback" role="status">
              {mediaError}
            </p>
          ) : null}

          <div className="request-detail__copy">
            <h1>{item.title}</h1>
            <p>{item.description}</p>
          </div>

          <section className="request-detail__section" aria-labelledby="request-detail-facts">
            <h2 id="request-detail-facts">Request details</h2>
            <dl className="request-detail__facts">
              {item.taxonomy ? (
                <>
                  <div>
                    <dt>Request Type</dt>
                    <dd>{titleCase(item.taxonomy.requestType)}</dd>
                  </div>
                  {item.taxonomy.sportLabel ? (
                    <div>
                      <dt>Sport</dt>
                      <dd>{item.taxonomy.sportLabel}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Category</dt>
                    <dd>{item.taxonomy.subcategory.label}</dd>
                  </div>
                  <div>
                    <dt>Specific Need</dt>
                    <dd>{item.taxonomy.need.label}</dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt>Category</dt>
                    <dd>{titleCase(item.category)}</dd>
                  </div>
                  {item.sport ? (
                    <div>
                      <dt>Sport</dt>
                      <dd>{titleCase(item.sport)}</dd>
                    </div>
                  ) : null}
                </>
              )}
              {item.customNeed ? (
                <div className="request-detail__fact-wide">
                  <dt>Custom Need</dt>
                  <dd>{item.customNeed}</dd>
                </div>
              ) : null}
              {item.houma ? (
                <div>
                  <dt>Houma</dt>
                  <dd>{item.houma}</dd>
                </div>
              ) : null}
              {item.city ? (
                <div>
                  <dt>City</dt>
                  <dd>{item.city}</dd>
                </div>
              ) : null}
              {item.locationNote ? (
                <div className="request-detail__fact-wide">
                  <dt>Location note</dt>
                  <dd>{item.locationNote}</dd>
                </div>
              ) : null}
              {item.neededByAt ? (
                <div>
                  <dt>Needed by</dt>
                  <dd>{formatDate(item.neededByAt)}</dd>
                </div>
              ) : null}
              {item.expiresAt ? (
                <div>
                  <dt>Expires</dt>
                  <dd>{formatDate(item.expiresAt)}</dd>
                </div>
              ) : null}
              {item.quantityNeeded ? (
                <div>
                  <dt>Quantity</dt>
                  <dd>{item.quantityNeeded}</dd>
                </div>
              ) : null}
              {item.sizeLabel ? (
                <div>
                  <dt>Size</dt>
                  <dd>{item.sizeLabel}</dd>
                </div>
              ) : null}
              {item.conditionPreference ? (
                <div>
                  <dt>Condition</dt>
                  <dd>{titleCase(item.conditionPreference)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {terminal ? (
            <p className="request-terminal-note" role="status">
              {terminal}
            </p>
          ) : null}

          {manager && mutable ? (
            <section className="request-detail__section request-detail__management">
              <div>
                <h2>Manage Request</h2>
                <p>Update the Request only when its real-world coordination changes.</p>
              </div>
              <div className="request-action-row">
                <button
                  type="button"
                  className="help-action help-action--primary"
                  disabled={Boolean(pendingAction)}
                  onClick={() => void transition("fulfill")}
                >
                  {pendingAction === "fulfill" ? "Marking fulfilled…" : "Mark fulfilled"}
                </button>
                <button
                  type="button"
                  className="help-action help-action--danger"
                  disabled={Boolean(pendingAction)}
                  onClick={() => void transition("cancel")}
                >
                  {pendingAction === "cancel" ? "Cancelling…" : "Cancel Request"}
                </button>
              </div>
            </section>
          ) : null}
        </article>

        {actionError ? (
          <p className="status request-error" role="alert">
            {actionError}
          </p>
        ) : null}

        {!me && mutable ? (
          <section className="request-response-panel panel">
            <h2>Can you help?</h2>
            <p className="muted">
              Sign in to send a private coordination response to the Request manager.
            </p>
            {loginHref ? (
              <a className="help-action help-action--primary" href={loginHref}>
                Sign in to respond
              </a>
            ) : null}
          </section>
        ) : null}

        {canRespond ? (
          <form className="request-response-panel panel" onSubmit={submitResponse}>
            <h2>Respond privately</h2>
            <p className="muted">
              Visible only to you and the current Request manager. You can send one response.
            </p>
            <label className="request-field__label" htmlFor="request-response-message">
              Your response message
            </label>
            <textarea
              id="request-response-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <div className="request-action-row">
              <button
                className="help-action help-action--primary"
                type="submit"
                disabled={pendingAction === "respond"}
              >
                {pendingAction === "respond" ? "Sending…" : "Send response"}
              </button>
            </div>
          </form>
        ) : null}

        {me ? (
          <RequestResponses
            me={me}
            responses={responses}
            manager={manager}
            pendingAction={pendingAction}
            onAccept={(responseId) => void decide(responseId, "accept")}
            onDecline={(responseId) => void decide(responseId, "decline")}
            onWithdraw={(responseId) => void withdraw(responseId)}
          />
        ) : null}
      </section>
    </div>
  );
}
