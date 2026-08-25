import { useEffect, useState, type FormEvent } from "react";
import type { CommunityJoinRequestForFounder } from "../api";
import { useHoomaFrontend } from "../context";

function requestName(request: CommunityJoinRequestForFounder): string {
  return request.presentation?.displayName || request.presentation?.username || "HOOMA member";
}

export function HoomaMembershipRequests({
  communityId,
  onChanged,
}: {
  readonly communityId: string;
  readonly onChanged: () => Promise<void>;
}) {
  const { api, protectedError } = useHoomaFrontend();
  const [requests, setRequests] = useState<CommunityJoinRequestForFounder[]>([]);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadRequests() {
    const response = await api.communities.joinRequests(communityId);
    setRequests(response.requests);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api.communities
      .joinRequests(communityId)
      .then((response) => {
        if (active) setRequests(response.requests);
      })
      .catch((reason) => {
        if (active) setError(protectedError(reason, "Could not load membership requests"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, communityId, protectedError]);

  async function perform(label: string, action: () => Promise<unknown>, success: string) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await action();
      await Promise.all([loadRequests(), onChanged()]);
      setNotice(success);
    } catch (reason) {
      setError(protectedError(reason, "Could not update HOOMA membership"));
    } finally {
      setBusy("");
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = username.trim();
    if (!target) return;
    await perform(
      "add-member",
      () => api.communities.addMember(communityId, target.replace(/^@/, "")),
      `@${target.replace(/^@/, "")} added to this HOOMA.`,
    );
    setUsername("");
  }

  return (
    <section className="panel hooma-membership-office">
      <div className="hooma-section-heading">
        <div>
          <span className="eyebrow">MEMBERSHIP</span>
          <h2>Founder membership controls</h2>
        </div>
        <span className="muted">{requests.length} pending</span>
      </div>

      {error ? <div className="error-box">{error}</div> : null}
      {notice ? <div className="success-box">{notice}</div> : null}

      <form className="hooma-member-add" onSubmit={(event) => void addMember(event)}>
        <label className="field">
          <span>Add an existing HOOMA user</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="@username"
            maxLength={65}
            autoComplete="off"
          />
        </label>
        <button className="button" disabled={Boolean(busy) || !username.trim()}>
          {busy === "add-member" ? "Adding…" : "Add member"}
        </button>
      </form>

      {loading ? <div className="state-card">Loading membership requests…</div> : null}
      {!loading && !requests.length ? (
        <div className="state-card">
          <strong>No pending requests.</strong>
          <span className="muted">New private-HOOMA requests will appear here.</span>
        </div>
      ) : null}
      {requests.length ? (
        <div className="hooma-request-list">
          {requests.map((request) => {
            const name = requestName(request);
            return (
              <article className="hooma-request-row" key={request.id}>
                <div className="hooma-member-identity">
                  {request.presentation?.photoUrl ? (
                    <img src={request.presentation.photoUrl} alt="" />
                  ) : (
                    <span className="hooma-member-avatar">
                      {name
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase())
                        .join("") || "H"}
                    </span>
                  )}
                  <div>
                    <strong>{name}</strong>
                    {request.presentation?.username ? (
                      <small>@{request.presentation.username}</small>
                    ) : null}
                  </div>
                </div>
                <div className="hooma-request-actions">
                  <button
                    className="button"
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void perform(
                        `approve-${request.userId}`,
                        () => api.communities.approveJoinRequest(communityId, request.userId),
                        `${name} joined this HOOMA.`,
                      )
                    }
                  >
                    {busy === `approve-${request.userId}` ? "Approving…" : "Approve"}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void perform(
                        `decline-${request.userId}`,
                        () => api.communities.declineJoinRequest(communityId, request.userId),
                        `${name}'s request was declined.`,
                      )
                    }
                  >
                    {busy === `decline-${request.userId}` ? "Declining…" : "Decline"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
