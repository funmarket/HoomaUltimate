import type { AthletesSport } from "@hooma/contracts/athletes";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { PublicAthletesDetail, PublicAthletesSummary } from "../api";
import { useHoomaFrontend } from "../context";

const sports: readonly { value: AthletesSport; label: string }[] = [
  { value: "CYCLING", label: "Cycling" },
  { value: "RUNNING", label: "Running" },
  { value: "SWIMMING", label: "Swimming" },
  { value: "FOOTBALL", label: "Football" },
  { value: "BASKETBALL", label: "Basketball" },
  { value: "TENNIS", label: "Tennis" },
  { value: "PADEL", label: "Padel" },
  { value: "GYM_FITNESS", label: "Gym/Fitness" },
  { value: "OTHER", label: "Other" },
];

function report(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

function sportLabel(value: AthletesSport): string {
  return sports.find((sport) => sport.value === value)?.label ?? value;
}

function locationLabel(item: Pick<PublicAthletesSummary, "city" | "houma" | "slug">): string {
  return [item.city, item.houma].filter(Boolean).join(" · ") || `@${item.slug}`;
}

export function AthletesPage() {
  const { api, authenticationHref } = useHoomaFrontend();
  const navigate = useNavigate();
  const [items, setItems] = useState<PublicAthletesSummary[]>([]);
  const [sport, setSport] = useState<AthletesSport | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api.athletes
      .publicList(sport === "ALL" ? { limit: 30 } : { sport, limit: 30 })
      .then((response) => {
        if (active) setItems(response.items);
      })
      .catch((reason) => {
        if (active) setError(report(reason, "Unable to load Athletes"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, sport]);

  const signInHref = authenticationHref("/athletes/new");

  return (
    <div className="page athletes-page">
      <section className="panel athletes-hero">
        <span className="eyebrow">ATHLETES</span>
        <h1>Find people who train, ride, run, swim and compete together.</h1>
        <p>Sports communities connected to HOOMA identity, not a HOOMA Community subtype.</p>
        <div className="athletes-actions">
          <button className="button" type="button" onClick={() => navigate("/athletes/new")}>
            Create Athletes community
          </button>
          {signInHref ? (
            <a className="button secondary" href={signInHref}>
              Sign in to create
            </a>
          ) : null}
        </div>
      </section>

      <section className="athletes-filter panel" aria-label="Filter Athletes by sport">
        <span className="eyebrow">SPORT</span>
        <div className="athletes-sport-chips">
          <button
            className={sport === "ALL" ? "is-active" : ""}
            type="button"
            onClick={() => setSport("ALL")}
          >
            All
          </button>
          {sports.map((option) => (
            <button
              key={option.value}
              className={sport === option.value ? "is-active" : ""}
              type="button"
              onClick={() => setSport(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <div className="error-box">{error}</div> : null}
      {loading ? <div className="state-card">Loading Athletes communities…</div> : null}
      {!loading && !items.length && !error ? (
        <div className="state-card">
          No Athletes communities yet. Start the first real training circle.
        </div>
      ) : null}
      {items.length ? (
        <section className="athletes-grid" aria-label="Athletes communities">
          {items.map((item) => (
            <button
              className="athletes-card"
              type="button"
              key={item.id}
              onClick={() => navigate(`/athletes/${item.id}`)}
            >
              <span className="athletes-sport">{sportLabel(item.sport)}</span>
              <h2>{item.name}</h2>
              <p>{item.description || "Train and compete with people nearby."}</p>
              <small>{locationLabel(item)}</small>
              <span>
                {item.visibility === "PRIVATE"
                  ? "Approval required"
                  : item.joinPolicy === "OPEN"
                    ? "Open to join"
                    : "Request to join"}{" "}
                · {item.memberCount} members
              </span>
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}

export function CreateAthletesPage() {
  const { api, protectedError } = useHoomaFrontend();
  const navigate = useNavigate();
  const [sport, setSport] = useState<AthletesSport>("RUNNING");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [joinPolicy, setJoinPolicy] = useState<"OPEN" | "APPROVAL_REQUIRED">("OPEN");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setCreating(true);
    setError("");
    try {
      const created = await api.athletes.create({
        name: String(data.get("name")).trim(),
        sport,
        description: String(data.get("description")).trim() || null,
        city: String(data.get("city")).trim() || null,
        houma: String(data.get("houma")).trim() || null,
        logoUrl: String(data.get("logoUrl")).trim() || null,
        bannerUrl: String(data.get("bannerUrl")).trim() || null,
        visibility,
        joinPolicy: visibility === "PRIVATE" ? "APPROVAL_REQUIRED" : joinPolicy,
      });
      navigate(`/athletes/${created.id}`, { replace: true });
    } catch (reason) {
      setError(protectedError(reason, "Unable to create Athletes community"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page athletes-page athletes-create-page">
      <a className="team-management-back" href="/athletes">
        ← Athletes
      </a>
      <section className="panel athletes-hero compact">
        <span className="eyebrow">CREATE ATHLETES</span>
        <h1>Start a real sports community.</h1>
        <p>Create an Athletes-owned record with its own membership lifecycle.</p>
      </section>
      {error ? <div className="error-box">{error}</div> : null}
      <form className="panel hooma-create-form" onSubmit={submit}>
        <div className="hooma-form-grid">
          <label className="field">
            <span>Name</span>
            <input name="name" required minLength={2} maxLength={100} />
          </label>
          <label className="field">
            <span>Sport</span>
            <select
              value={sport}
              onChange={(event) => setSport(event.currentTarget.value as AthletesSport)}
            >
              {sports.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>City</span>
            <input name="city" maxLength={100} />
          </label>
          <label className="field">
            <span>Houma / neighborhood</span>
            <input name="houma" maxLength={100} />
          </label>
          <label className="field">
            <span>Logo URL</span>
            <input name="logoUrl" type="url" maxLength={2000} />
          </label>
          <label className="field">
            <span>Banner image URL</span>
            <input name="bannerUrl" type="url" maxLength={2000} />
          </label>
          <label className="field hooma-span-2">
            <span>Description</span>
            <textarea name="description" maxLength={600} rows={4} />
          </label>
        </div>
        <fieldset className="hooma-privacy-choice">
          <legend>Discovery and joining</legend>
          <label className={visibility === "PUBLIC" ? "is-selected" : ""}>
            <input
              type="radio"
              name="visibility"
              checked={visibility === "PUBLIC"}
              onChange={() => setVisibility("PUBLIC")}
            />
            <span>
              <strong>Public</strong>
              <small>People can discover this Athletes community.</small>
            </span>
          </label>
          <label className={visibility === "PRIVATE" ? "is-selected" : ""}>
            <input
              type="radio"
              name="visibility"
              checked={visibility === "PRIVATE"}
              onChange={() => {
                setVisibility("PRIVATE");
                setJoinPolicy("APPROVAL_REQUIRED");
              }}
            />
            <span>
              <strong>Private</strong>
              <small>Discovery stays privacy-safe and joining requires approval.</small>
            </span>
          </label>
          <label className={joinPolicy === "OPEN" && visibility === "PUBLIC" ? "is-selected" : ""}>
            <input
              type="radio"
              name="joinPolicy"
              checked={joinPolicy === "OPEN" && visibility === "PUBLIC"}
              disabled={visibility === "PRIVATE"}
              onChange={() => setJoinPolicy("OPEN")}
            />
            <span>
              <strong>Open join</strong>
              <small>Authenticated users can join immediately.</small>
            </span>
          </label>
          <label className={joinPolicy === "APPROVAL_REQUIRED" ? "is-selected" : ""}>
            <input
              type="radio"
              name="joinPolicy"
              checked={joinPolicy === "APPROVAL_REQUIRED"}
              onChange={() => setJoinPolicy("APPROVAL_REQUIRED")}
            />
            <span>
              <strong>Approval required</strong>
              <small>Founders or moderators review requests.</small>
            </span>
          </label>
        </fieldset>
        <div className="hooma-form-actions">
          <a className="button secondary" href="/athletes">
            Cancel
          </a>
          <button className="button" disabled={creating}>
            {creating ? "Creating…" : "Create Athletes community"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AthletesDetailPage({
  athletesCommunityId,
}: {
  readonly athletesCommunityId: string;
}) {
  const { api, protectedError } = useHoomaFrontend();
  const [detail, setDetail] = useState<PublicAthletesDetail | null>(null);
  const [members, setMembers] = useState<unknown[]>([]);
  const [requests, setRequests] = useState<{ userId: string }[]>([]);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const canManage = useMemo(
    () => detail?.viewerRole === "FOUNDER" || detail?.viewerRole === "MODERATOR",
    [detail],
  );

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const next = await api.athletes.detail(athletesCommunityId);
      setDetail(next);
      try {
        setMembers(await api.athletes.members(athletesCommunityId));
      } catch {
        setMembers([]);
      }
      try {
        setRequests((await api.athletes.joinRequests(athletesCommunityId)).requests);
      } catch {
        setRequests([]);
      }
    } catch (reason) {
      setError(report(reason, "Unable to load Athletes community"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [athletesCommunityId]);

  async function join() {
    setError("");
    setNotice("");
    try {
      const result = await api.athletes.join(athletesCommunityId);
      setNotice(result.status === "JOINED" ? "Joined Athletes community." : "Join request sent.");
      await reload();
    } catch (reason) {
      setError(protectedError(reason, "Unable to join Athletes community"));
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await api.athletes.addMember(athletesCommunityId, username);
      setUsername("");
      setNotice("Member added.");
      await reload();
    } catch (reason) {
      setError(protectedError(reason, "Unable to add Athletes member"));
    }
  }

  if (loading)
    return (
      <div className="page athletes-page">
        <div className="state-card">Loading Athletes community…</div>
      </div>
    );
  if (!detail)
    return (
      <div className="page athletes-page">
        {error ? <div className="error-box">{error}</div> : null}
      </div>
    );

  return (
    <div className="page athletes-page athletes-detail-page">
      <a className="team-management-back" href="/athletes">
        ← Athletes
      </a>
      <section className="panel athletes-hero compact">
        <span className="eyebrow">{sportLabel(detail.sport)}</span>
        <h1>{detail.name}</h1>
        <p>{detail.description || "Train and compete with this Athletes community."}</p>
        <small>{locationLabel(detail)}</small>
      </section>
      {notice ? <div className="success-box">{notice}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      <section className="panel athletes-join-panel">
        <span>
          {detail.visibility === "PRIVATE" ? "Private" : "Public"} ·{" "}
          {detail.joinPolicy === "OPEN" ? "Open join" : "Approval required"}
        </span>
        {detail.viewerRole ? (
          <strong>You are {detail.viewerRole}</strong>
        ) : (
          <button className="button" type="button" onClick={() => void join()}>
            {detail.joinPolicy === "OPEN" ? "Join" : "Request to join"}
          </button>
        )}
      </section>
      {members.length ? (
        <section className="panel">
          <span className="eyebrow">MEMBERS</span>
          <h2>Active Athletes</h2>
          <div className="athletes-member-list">
            {members.map((member) => {
              const row = member as {
                userId: string;
                role: string;
                presentation?: { displayName: string; username: string } | null;
              };
              return (
                <div className="athletes-member-row" key={row.userId}>
                  <span>
                    <strong>{row.presentation?.displayName ?? row.userId}</strong>
                    <small>{row.presentation ? `@${row.presentation.username}` : row.userId}</small>
                  </span>
                  <b>{row.role}</b>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      {canManage ? (
        <section className="panel">
          <span className="eyebrow">MANAGE MEMBERS</span>
          <form className="athletes-inline-form" onSubmit={addMember}>
            <input
              value={username}
              onChange={(event) => setUsername(event.currentTarget.value)}
              placeholder="username"
              required
            />
            <button className="button" type="submit">
              Add member
            </button>
          </form>
          {requests.length ? (
            <div className="athletes-member-list">
              {requests.map((request) => (
                <div className="athletes-member-row" key={request.userId}>
                  <span>{request.userId}</span>
                  <span>
                    <button
                      type="button"
                      onClick={() =>
                        void api.athletes
                          .approveJoinRequest(athletesCommunityId, request.userId)
                          .then(reload)
                      }
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void api.athletes
                          .declineJoinRequest(athletesCommunityId, request.userId)
                          .then(reload)
                      }
                    >
                      Decline
                    </button>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No pending join requests.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
