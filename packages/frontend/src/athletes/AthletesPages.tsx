import type { AthletesMember, AthletesSport } from "@hooma/contracts/athletes";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { PublicAthletesDetail, PublicAthletesSummary } from "../api";
import { useHoomaFrontend } from "../context";
import { AthletesWhistleBoard } from "../whistle/HoomaWhistleBoard";

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
      <section className="athletes-surface athletes-hero athletes-hero--hub">
        <div className="athletes-hero__content">
          <span className="eyebrow">ATHLETES</span>
          <h1>Move together. Train together.</h1>
          <p>Find local sports communities built around the way you move.</p>
          <div className="athletes-actions">
            <button
              className="button athletes-action athletes-action--primary"
              type="button"
              onClick={() => navigate("/athletes/new")}
            >
              <span className="athletes-action__icon" aria-hidden="true">
                +
              </span>
              Create community
            </button>
            {signInHref ? (
              <a
                className="button secondary athletes-action athletes-action--secondary"
                href={signInHref}
              >
                Sign in to create
              </a>
            ) : null}
          </div>
        </div>
        <span className="athletes-hero__motion" aria-hidden="true" />
      </section>

      <section className="athletes-surface athletes-filter" aria-label="Filter Athletes by sport">
        <div className="athletes-section-heading">
          <span className="eyebrow">SPORT</span>
          <span className="athletes-section-heading__hint">Find your pace</span>
        </div>
        <div className="athletes-sport-chips">
          <button
            className={sport === "ALL" ? "is-active" : ""}
            type="button"
            aria-pressed={sport === "ALL"}
            onClick={() => setSport("ALL")}
          >
            All
          </button>
          {sports.map((option) => (
            <button
              key={option.value}
              className={sport === option.value ? "is-active" : ""}
              type="button"
              aria-pressed={sport === option.value}
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
              data-sport={item.sport}
              type="button"
              key={item.id}
              onClick={() => navigate(`/athletes/${item.id}`)}
            >
              <span className="athletes-card__motif" aria-hidden="true" />
              <span className="athletes-sport">{sportLabel(item.sport)}</span>
              <h2>{item.name}</h2>
              <p>{item.description || "Train and compete with people nearby."}</p>
              <div className="athletes-card__footer">
                <small>{locationLabel(item)}</small>
                <span>
                  {item.visibility === "PRIVATE"
                    ? "Approval required"
                    : item.joinPolicy === "OPEN"
                      ? "Open to join"
                      : "Request to join"}{" "}
                  · {item.memberCount} members
                </span>
              </div>
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
    <div className="page athletes-page athletes-create-page" data-sport={sport}>
      <a className="team-management-back athletes-back" href="/athletes">
        ← Athletes
      </a>
      <section className="athletes-surface athletes-hero athletes-hero--create" data-sport={sport}>
        <span className="athletes-card__motif" aria-hidden="true" />
        <div className="athletes-hero__content">
          <span className="eyebrow">CREATE ATHLETES</span>
          <h1>Build your {sportLabel(sport)} circle.</h1>
          <p>Choose the sport first. The community carries that identity from creation onward.</p>
        </div>
      </section>
      {error ? <div className="error-box">{error}</div> : null}
      <form className="athletes-surface athletes-create-form" onSubmit={submit}>
        <fieldset className="athletes-sport-picker">
          <legend>Choose a sport</legend>
          <div
            className="athletes-sport-picker__grid"
            role="radiogroup"
            aria-label="Choose a sport"
          >
            {sports.map((option) => (
              <label
                className={
                  sport === option.value
                    ? "athletes-sport-option is-selected"
                    : "athletes-sport-option"
                }
                data-sport={option.value}
                key={option.value}
              >
                <input
                  type="radio"
                  name="sportChoice"
                  value={option.value}
                  aria-label={option.label}
                  checked={sport === option.value}
                  onChange={() => setSport(option.value)}
                />
                <span className="athletes-sport-option__motif" aria-hidden="true" />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="athletes-form-grid">
          <label className="athletes-field">
            <span>Name</span>
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              placeholder="Community name"
            />
          </label>
          <label className="athletes-field">
            <span>City</span>
            <input name="city" maxLength={100} placeholder="City" />
          </label>
          <label className="athletes-field">
            <span>HOUMA / neighborhood</span>
            <input name="houma" maxLength={100} placeholder="Area or neighborhood" />
          </label>
          <label className="athletes-field">
            <span>Logo URL</span>
            <input name="logoUrl" type="url" maxLength={2000} placeholder="https://…" />
          </label>
          <label className="athletes-field athletes-span-2">
            <span>Banner image URL</span>
            <input name="bannerUrl" type="url" maxLength={2000} placeholder="https://…" />
          </label>
          <label className="athletes-field athletes-span-2">
            <span>Description</span>
            <textarea
              name="description"
              maxLength={600}
              rows={4}
              placeholder="What brings this community together?"
            />
          </label>
        </div>

        <fieldset className="athletes-choice-grid">
          <legend>Discovery and joining</legend>
          <label
            className={
              visibility === "PUBLIC"
                ? "athletes-choice-option is-selected"
                : "athletes-choice-option"
            }
          >
            <input
              type="radio"
              name="visibility"
              aria-label="Public"
              checked={visibility === "PUBLIC"}
              onChange={() => setVisibility("PUBLIC")}
            />
            <span>
              <strong>Public</strong>
              <small>People can discover this Athletes community.</small>
            </span>
          </label>
          <label
            className={
              visibility === "PRIVATE"
                ? "athletes-choice-option is-selected"
                : "athletes-choice-option"
            }
          >
            <input
              type="radio"
              name="visibility"
              aria-label="Private"
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
          <label
            className={
              joinPolicy === "OPEN" && visibility === "PUBLIC"
                ? "athletes-choice-option is-selected"
                : "athletes-choice-option"
            }
          >
            <input
              type="radio"
              name="joinPolicy"
              aria-label="Open join"
              checked={joinPolicy === "OPEN" && visibility === "PUBLIC"}
              disabled={visibility === "PRIVATE"}
              onChange={() => setJoinPolicy("OPEN")}
            />
            <span>
              <strong>Open join</strong>
              <small>Authenticated users can join immediately.</small>
            </span>
          </label>
          <label
            className={
              joinPolicy === "APPROVAL_REQUIRED"
                ? "athletes-choice-option is-selected"
                : "athletes-choice-option"
            }
          >
            <input
              type="radio"
              name="joinPolicy"
              aria-label="Approval required"
              checked={joinPolicy === "APPROVAL_REQUIRED"}
              onChange={() => setJoinPolicy("APPROVAL_REQUIRED")}
            />
            <span>
              <strong>Approval required</strong>
              <small>Founders or moderators review requests.</small>
            </span>
          </label>
        </fieldset>
        <div className="athletes-form-actions">
          <a
            className="button secondary athletes-action athletes-action--secondary"
            href="/athletes"
          >
            Cancel
          </a>
          <button className="button athletes-action athletes-action--primary" disabled={creating}>
            <span className="athletes-action__icon" aria-hidden="true">
              +
            </span>
            {creating ? "Creating…" : "Create community"}
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
  const [members, setMembers] = useState<AthletesMember[]>([]);
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
      if (next.viewerRole) {
        try {
          setMembers(await api.athletes.members(athletesCommunityId));
        } catch {
          setMembers([]);
        }
      } else {
        setMembers([]);
      }
      if (next.viewerRole === "FOUNDER" || next.viewerRole === "MODERATOR") {
        try {
          setRequests((await api.athletes.joinRequests(athletesCommunityId)).requests);
        } catch {
          setRequests([]);
        }
      } else {
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
    <div className="page athletes-page athletes-detail-page" data-sport={detail.sport}>
      <a className="team-management-back athletes-back" href="/athletes">
        ← Athletes
      </a>
      <section
        className="athletes-surface athletes-hero athletes-hero--detail"
        data-sport={detail.sport}
      >
        <span className="athletes-card__motif" aria-hidden="true" />
        <div className="athletes-hero__content">
          <span className="eyebrow">{sportLabel(detail.sport)}</span>
          <h1>{detail.name}</h1>
          <p>{detail.description || "Train and compete with this Athletes community."}</p>
          <div className="athletes-hero__meta">
            <span>{locationLabel(detail)}</span>
            <span>{detail.memberCount} athletes</span>
          </div>
        </div>
      </section>
      {notice ? <div className="success-box">{notice}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      <section className="athletes-surface athletes-join-panel">
        <div className="athletes-join-panel__status">
          <span>{detail.visibility === "PRIVATE" ? "Private" : "Public"}</span>
          <span>{detail.joinPolicy === "OPEN" ? "Open join" : "Approval required"}</span>
        </div>
        {detail.viewerRole ? (
          <strong className="athletes-role">{detail.viewerRole}</strong>
        ) : (
          <button
            className="button athletes-action athletes-action--primary athletes-action--compact"
            type="button"
            onClick={() => void join()}
          >
            <span className="athletes-action__icon" aria-hidden="true">
              +
            </span>
            {detail.joinPolicy === "OPEN" ? "Join" : "Request to join"}
          </button>
        )}
      </section>
      {detail.viewerRole ? (
        <AthletesWhistleBoard athletesCommunityId={athletesCommunityId} />
      ) : null}
      {members.length ? (
        <section className="athletes-surface athletes-section">
          <div className="athletes-section-heading">
            <div>
              <span className="eyebrow">MEMBERS</span>
              <h2>Active Athletes</h2>
            </div>
            <span className="athletes-section-count">{members.length}</span>
          </div>
          <div className="athletes-member-list">
            {members.map((member) => (
              <div className="athletes-member-row" key={member.userId}>
                <span>
                  <strong>{member.presentation?.displayName ?? member.userId}</strong>
                  <small>
                    {member.presentation ? `@${member.presentation.username}` : member.userId}
                  </small>
                </span>
                <b className="athletes-member-role">{member.role}</b>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {canManage ? (
        <section className="athletes-surface athletes-section athletes-manage-section">
          <span className="eyebrow">MANAGE MEMBERS</span>
          <form className="athletes-inline-form" onSubmit={addMember}>
            <input
              value={username}
              onChange={(event) => setUsername(event.currentTarget.value)}
              placeholder="username"
              aria-label="Username to add"
              required
            />
            <button className="button athletes-action athletes-action--secondary" type="submit">
              Add member
            </button>
          </form>
          {requests.length ? (
            <div className="athletes-member-list athletes-request-list">
              {requests.map((request) => (
                <div className="athletes-member-row athletes-request-row" key={request.userId}>
                  <span>{request.userId}</span>
                  <span className="athletes-request-actions">
                    <button
                      className="athletes-mini-action athletes-mini-action--approve"
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
                      className="athletes-mini-action athletes-mini-action--decline"
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
