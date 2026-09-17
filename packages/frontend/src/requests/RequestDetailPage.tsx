import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { MeResponse } from "@hooma/contracts";
import type { HelpRequest, HelpRequestResponse } from "@hooma/contracts/requests";
import { useHoomaFrontend } from "../context";
import { HoomaApiError } from "../http";
import { ClockIcon, LocationIcon, RequestIcon } from "../help/HelpIcons";
import { createRequestsApi } from "./api";

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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
      try {
        const current = await api.identity.meOptional();
        const requestItem = current
          ? await requestsApi.memberDetail(requestId)
          : await requestsApi.publicDetail(requestId);
        let visibleResponses: HelpRequestResponse[] = [];
        if (current) {
          try {
            visibleResponses = (await requestsApi.responses(requestId)).items;
          } catch (reason) {
            if (!(reason instanceof HoomaApiError && reason.status === 404)) throw reason;
          }
        }
        if (active) {
          setMe(current);
          setItem(requestItem);
          setResponses(visibleResponses);
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

  const manager = canManage(me, item);
  const ownResponse = me ? responses.find((response) => response.responderUserId === me.id) : undefined;
  const mutable = item?.status === "OPEN" || item?.status === "IN_PROGRESS";
  const canRespond = Boolean(me && item && mutable && !manager && !ownResponse);

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
      setActionError(protectedError(reason, "Unable to send response"));
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
      setResponses((current) => current.map((response) => (response.id === responseId ? updated : response)));
      if (decision === "accept") {
        setItem((current) => (current ? { ...current, status: "IN_PROGRESS" } : current));
      }
    } catch (reason) {
      setActionError(protectedError(reason, `Unable to ${decision} response`));
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
      setResponses((current) => current.map((response) => (response.id === responseId ? updated : response)));
    } catch (reason) {
      setActionError(protectedError(reason, "Unable to withdraw response"));
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
        next === "fulfill" ? await requestsApi.fulfill(requestId) : await requestsApi.cancel(requestId);
      setItem(updated);
    } catch (reason) {
      setActionError(protectedError(reason, `Unable to ${next} Request`));
    } finally {
      setPendingAction("");
    }
  }

  if (loading) return <p className="status">Loading Request…</p>;
  if (error || !item) return <p className="status status--error">{error || "Request not found"}</p>;

  const place = [item.houma, item.city].filter(Boolean).join(", ");
  const loginHref = authenticationHref(`/requests/${requestId}`);

  return (
    <section className="page requests-page">
      <a className="request-back-link" href="/requests">← Requests</a>
      <article className="request-detail panel">
        <div className="request-card__topline">
          <span className="request-chip">{titleCase(item.category)}</span>
          <span className={`request-status request-status--${item.status.toLowerCase()}`}>
            {titleCase(item.status)}
          </span>
        </div>
        <div className="request-detail__heading">
          <RequestIcon />
          <div>
            <h1>{item.title}</h1>
            <p>{item.description}</p>
          </div>
        </div>
        <div className="request-detail__facts">
          {place ? <span><LocationIcon /> {place}</span> : null}
          {item.neededByAt ? <span><ClockIcon /> Needed {new Date(item.neededByAt).toLocaleString()}</span> : null}
          {item.sport ? <span>Sport · {titleCase(item.sport)}</span> : null}
          {item.itemKind ? <span>Item · {titleCase(item.itemKind)}</span> : null}
          {item.quantityNeeded ? <span>Quantity · {item.quantityNeeded}</span> : null}
          {item.sizeLabel ? <span>Size · {item.sizeLabel}</span> : null}
          {item.conditionPreference ? <span>Condition · {titleCase(item.conditionPreference)}</span> : null}
          {item.locationNote ? <span>Location note · {item.locationNote}</span> : null}
        </div>

        {manager && mutable ? (
          <div className="request-action-row">
            <button type="button" className="help-primary-action" disabled={Boolean(pendingAction)} onClick={() => void transition("fulfill")}>Mark fulfilled</button>
            <button type="button" className="request-danger-action" disabled={Boolean(pendingAction)} onClick={() => void transition("cancel")}>Cancel Request</button>
          </div>
        ) : null}
      </article>

      {actionError ? <p className="status status--error">{actionError}</p> : null}

      {!me && mutable ? (
        <section className="request-response-panel panel">
          <h2>Can you help?</h2>
          <p className="muted">Sign in to send a private coordination response to the Request manager.</p>
          {loginHref ? <a className="help-primary-action" href={loginHref}>Sign in to respond</a> : null}
        </section>
      ) : null}

      {canRespond ? (
        <form className="request-response-panel panel" onSubmit={submitResponse}>
          <h2>Respond privately</h2>
          <p className="muted">Your coordination message is visible to you and the current Request manager.</p>
          <textarea required rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Explain how you can help and how to coordinate." />
          <button className="help-primary-action" type="submit" disabled={pendingAction === "respond"}>{pendingAction === "respond" ? "Sending…" : "Send response"}</button>
        </form>
      ) : null}

      {me && responses.length > 0 ? (
        <section className="request-responses panel">
          <div className="request-responses__heading">
            <h2>{manager ? "Responses" : "Your response"}</h2>
            <span>{responses.length}</span>
          </div>
          <div className="request-responses__list">
            {responses.map((response) => {
              const own = response.responderUserId === me.id;
              return (
                <article className="request-response" key={response.id}>
                  <div className="request-card__topline">
                    <strong>{own ? "Your response" : `Responder ${response.responderUserId.slice(0, 8)}`}</strong>
                    <span className={`request-status request-status--${response.status.toLowerCase()}`}>{titleCase(response.status)}</span>
                  </div>
                  <p>{response.message}</p>
                  {manager && response.status === "PENDING" ? (
                    <div className="request-action-row">
                      <button type="button" className="help-primary-action" disabled={Boolean(pendingAction)} onClick={() => void decide(response.id, "accept")}>Accept</button>
                      <button type="button" className="request-secondary-button" disabled={Boolean(pendingAction)} onClick={() => void decide(response.id, "decline")}>Decline</button>
                    </div>
                  ) : null}
                  {own && (response.status === "PENDING" || response.status === "ACCEPTED") ? (
                    <button type="button" className="request-secondary-button" disabled={Boolean(pendingAction)} onClick={() => void withdraw(response.id)}>Withdraw response</button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </section>
  );
}
