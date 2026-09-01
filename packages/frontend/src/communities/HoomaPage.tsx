import type { MeResponse } from "@hooma/contracts";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type {
  CommunityJoinRequest,
  CommunityMember,
  CommunityVisibility,
  PublicCommunityDetail,
  PublicCommunitySummary,
} from "../api";
import { useHoomaFrontend } from "../context";
import { CommunityHoomaNowSection } from "../discovery/HoomaNowSection";
import { HoomaWhistleBoard } from "../whistle/HoomaWhistleBoard";
import { CommunityLogo, CommunityMediaSurface } from "./CommunityMedia";
import { HoomaMembershipRequests } from "./HoomaMembershipRequests";

function report(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unexpected HOOMA error";
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "H"
  );
}

function CommunityVisibilityIndicator({
  visibility,
}: {
  readonly visibility: CommunityVisibility;
}) {
  const isPrivate = visibility === "PRIVATE";
  const label = isPrivate ? "Private HOOMA" : "Public HOOMA";

  return (
    <span
      className={`hooma-visibility-indicator ${isPrivate ? "is-private" : "is-public"}`}
      aria-label={label}
      title={label}
    >
      {isPrivate ? (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
          <rect
            x="5"
            y="10.25"
            width="14"
            height="10"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M8 10.25V7.7a4 4 0 0 1 8 0v2.55M12 14.1v2.6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M3.75 12h16.5M12 3.75c2.05 2.15 3.15 4.9 3.15 8.25S14.05 18.1 12 20.25C9.95 18.1 8.85 15.35 8.85 12S9.95 5.9 12 3.75Z"
            stroke="currentColor"
            strokeWidth="1.55"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

export function HoomaPage() {
  const { api, authenticationHref } = useHoomaFrontend();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<PublicCommunitySummary[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([api.communities.publicList(), api.identity.meOptional()])
      .then(([publicRows, identity]) => {
        if (!active) return;
        setCommunities(publicRows.items);
        setMe(identity);
      })
      .catch((reason) => {
        if (active) setError(report(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  const signInHref = authenticationHref("/hooma");

  return (
    <div className="page hooma-page">
      <section className="hooma-hero panel">
        <span className="eyebrow">YOUR FOOTBALL NEIGHBORHOOD</span>
        <h1>HOOMA</h1>
        <p>Find your people, build your neighborhood, and connect through sport and community.</p>
      </section>

      <section className="hooma-create-section">
        <div className="hooma-section-heading">
          <div>
            <span className="eyebrow">CREATE</span>
            <h2>Create a HOOMA Community</h2>
          </div>
          <p className="muted">Start one neighborhood community from the Communities domain.</p>
        </div>
        <div className="panel hooma-create-callout">
          <div>
            <strong>Build your neighborhood HOOMA</strong>
            <span>
              Create the canonical HOOMA record for membership, local identity and community tools.
            </span>
            <small>Teams and future supporter groups keep their own creation flows.</small>
          </div>
          <button
            className="button hooma-create-action"
            type="button"
            onClick={() => navigate("/hooma/new")}
          >
            Create a HOOMA Community
          </button>
        </div>
      </section>

      {me ? (
        <section className="panel hooma-memberships">
          <span className="eyebrow">MY HOOMAS</span>
          <h2>Your neighborhood communities</h2>
          {me.communities.length ? (
            <div className="hooma-community-list">
              {me.communities.map((community) => (
                <button
                  key={community.id}
                  type="button"
                  className="hooma-community-row"
                  onClick={() => navigate(`/hooma/${community.id}`)}
                >
                  <div>
                    <strong>{community.name}</strong>
                    <span>@{community.slug}</span>
                  </div>
                  <span className="hooma-role-chip">{community.role}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="state-card">
              <strong>No HOOMA yet.</strong>
              <p className="muted">Create your neighborhood community to become its Founder.</p>
              <button className="button" type="button" onClick={() => navigate("/hooma/new")}>
                Create HOOMA
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="member-gate">
          <strong>Want to create a community?</strong>
          <span className="muted">
            Discovery stays public. Authentication starts only when you create.
          </span>
          {signInHref ? (
            <a className="button secondary" href={signInHref}>
              Sign in
            </a>
          ) : (
            <span className="muted">Open HOOMA through Telegram to authenticate.</span>
          )}
        </section>
      )}

      <section className="hooma-discovery">
        <div className="hooma-section-heading">
          <div>
            <span className="eyebrow">DISCOVER</span>
            <h2>Neighborhood HOOMAs</h2>
          </div>
        </div>
        {error ? <div className="error-box">{error}</div> : null}
        {loading ? (
          <div className="state-card">
            <strong>Loading HOOMAs…</strong>
          </div>
        ) : null}
        {!loading && !communities.length && !error ? (
          <div className="state-card">
            <strong>No HOOMAs yet.</strong>
            <p className="muted">The first neighborhood community can start here.</p>
          </div>
        ) : null}
        {communities.length ? (
          <div className="hooma-discovery-grid">
            {communities.map((community) => (
              <button
                className="hooma-discovery-card"
                type="button"
                key={community.id}
                onClick={() => navigate(`/hooma/${community.id}`)}
              >
                <CommunityMediaSurface className="hooma-card-media" bannerUrl={community.bannerUrl}>
                  <CommunityLogo
                    className="hooma-card-logo"
                    logoUrl={community.logoUrl}
                    name={community.name}
                  />
                  <CommunityVisibilityIndicator visibility={community.visibility} />
                </CommunityMediaSurface>
                <div className="hooma-card-copy">
                  <span className="eyebrow">{community.houma || community.city || "HOOMA"}</span>
                  <h3>{community.name}</h3>
                  <p>{community.description || "A local HOOMA community."}</p>
                  <small>
                    {[community.city, community.houma].filter(Boolean).join(" · ") ||
                      `@${community.slug}`}
                  </small>
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function CreateHoomaPage() {
  const { api, protectedError } = useHoomaFrontend();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [houma, setHouma] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [visibility, setVisibility] = useState<CommunityVisibility>("PUBLIC");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const created = await api.communities.create({
        name,
        description: description.trim() || null,
        city: city.trim() || null,
        houma: houma.trim() || null,
        logoUrl: logoUrl.trim() || null,
        bannerUrl: bannerUrl.trim() || null,
        visibility,
      });
      const after = new URLSearchParams(window.location.search).get("after");
      if (after === "team-create") {
        navigate(`/teams/new?communityId=${encodeURIComponent(created.id)}`);
        return;
      }
      navigate("/hooma");
    } catch (reason) {
      setError(protectedError(reason, "Could not create HOOMA"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page hooma-create-page">
      <CommunityMediaSurface
        as="section"
        className="hooma-create-preview panel"
        bannerUrl={bannerUrl}
        gradient="linear-gradient(180deg, rgba(4,5,5,.12), rgba(4,5,5,.9))"
      >
        <CommunityLogo
          className="hooma-preview-logo"
          logoUrl={logoUrl}
          name={name || "HOOMA"}
          alt="Community logo preview"
        />
        <div>
          <span className="eyebrow">BUILD YOUR NEIGHBORHOOD</span>
          <h1>{name || "Your HOOMA"}</h1>
          <p>
            {description ||
              "Give your community a banner, a badge and a place people recognize as theirs."}
          </p>
          <CommunityVisibilityIndicator visibility={visibility} />
        </div>
      </CommunityMediaSurface>
      <form className="panel hooma-create-form" onSubmit={submit}>
        <div className="hooma-form-intro">
          <span className="eyebrow">IDENTITY</span>
          <h2>Make it feel like your place</h2>
          <p className="muted">
            Community identity, access and media are controlled from this canonical HOOMA record.
          </p>
        </div>
        <fieldset className="hooma-privacy-choice">
          <legend>Who can join?</legend>
          <label className={visibility === "PUBLIC" ? "is-selected" : ""}>
            <input
              type="radio"
              name="visibility"
              value="PUBLIC"
              checked={visibility === "PUBLIC"}
              onChange={() => setVisibility("PUBLIC")}
            />
            <span>
              <strong>Public</strong>
              <small>People can find this HOOMA and join immediately.</small>
            </span>
          </label>
          <label className={visibility === "PRIVATE" ? "is-selected" : ""}>
            <input
              type="radio"
              name="visibility"
              value="PRIVATE"
              checked={visibility === "PRIVATE"}
              onChange={() => setVisibility("PRIVATE")}
            />
            <span>
              <strong>Private</strong>
              <small>People can find this HOOMA but the Founder approves membership.</small>
            </span>
          </label>
        </fieldset>
        <div className="hooma-form-grid">
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="La Marsa HOOMA"
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label className="field">
            <span>City</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Tunis"
              maxLength={100}
            />
          </label>
          <label className="field">
            <span>Houma / neighborhood</span>
            <input
              value={houma}
              onChange={(event) => setHouma(event.target.value)}
              placeholder="La Marsa"
              maxLength={100}
            />
          </label>
          <label className="field">
            <span>Community logo URL</span>
            <input
              type="url"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://…/logo.png"
              maxLength={2000}
            />
          </label>
          <label className="field hooma-span-2">
            <span>Banner image URL</span>
            <input
              type="url"
              value={bannerUrl}
              onChange={(event) => setBannerUrl(event.target.value)}
              placeholder="https://…/neighborhood-banner.jpg"
              maxLength={2000}
            />
          </label>
          <label className="field hooma-span-2">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What makes this HOOMA yours? Match days, local pitches, people, history…"
              maxLength={600}
              rows={4}
            />
          </label>
        </div>
        {error ? <div className="error-box">{error}</div> : null}
        <div className="hooma-form-actions">
          <button className="button secondary" type="button" onClick={() => navigate("/hooma")}>
            Cancel
          </button>
          <button className="button" disabled={creating || name.trim().length < 2}>
            {creating ? "Creating…" : "Create HOOMA"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function HoomaDetailPage({ communityId }: { readonly communityId: string }) {
  const { api, authenticationHref, protectedError } = useHoomaFrontend();
  const [community, setCommunity] = useState<PublicCommunityDetail | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [joinRequest, setJoinRequest] = useState<CommunityJoinRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function applyDetail(detail: PublicCommunityDetail, identity: MeResponse | null) {
    setCommunity(detail);
    setMe(identity);
    const currentMembership = identity?.communities.find((item) => item.id === communityId) ?? null;
    if (currentMembership) {
      const rows = await api.communities.members(communityId);
      setMembers(rows);
      setJoinRequest(null);
      return;
    }
    setMembers([]);
    if (identity) {
      const response = await api.communities.myJoinRequest(communityId);
      setJoinRequest(response.request?.status === "PENDING" ? response.request : null);
    } else {
      setJoinRequest(null);
    }
  }

  async function loadDetail() {
    const [detail, identity] = await Promise.all([
      api.communities.publicDetail(communityId),
      api.identity.meOptional(),
    ]);
    await applyDetail(detail, identity);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([api.communities.publicDetail(communityId), api.identity.meOptional()])
      .then(async ([detail, identity]) => {
        if (!active) return;
        setCommunity(detail);
        setMe(identity);
        const currentMembership =
          identity?.communities.find((item) => item.id === communityId) ?? null;
        if (currentMembership) {
          const rows = await api.communities.members(communityId);
          if (!active) return;
          setMembers(rows);
          setJoinRequest(null);
        } else {
          setMembers([]);
          if (identity) {
            const response = await api.communities.myJoinRequest(communityId);
            if (active)
              setJoinRequest(response.request?.status === "PENDING" ? response.request : null);
          } else {
            setJoinRequest(null);
          }
        }
      })
      .catch((reason) => {
        if (active) setError(report(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, communityId]);

  async function perform(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setError("");
    try {
      await action();
      await loadDetail();
    } catch (reason) {
      setError(protectedError(reason, "Could not update HOOMA membership"));
    } finally {
      setBusy("");
    }
  }

  if (loading)
    return (
      <div className="page hooma-detail-page">
        <div className="state-card">Loading HOOMA…</div>
      </div>
    );
  if (error && !community)
    return (
      <div className="page hooma-detail-page">
        <div className="error-box">{error}</div>
      </div>
    );
  if (!community)
    return (
      <div className="page hooma-detail-page">
        <div className="error-box">HOOMA not found</div>
      </div>
    );

  const membership = me?.communities.find((item) => item.id === community.id) ?? null;
  const signInHref = authenticationHref(`/hooma/${community.id}`);
  const canManage = membership?.role === "FOUNDER" || membership?.role === "COACH";

  return (
    <div className="page hooma-detail-page">
      <CommunityMediaSurface
        as="section"
        className="hooma-hq-hero"
        bannerUrl={community.bannerUrl}
        gradient="linear-gradient(180deg, rgba(4,5,5,.08), rgba(4,5,5,.92))"
      >
        <CommunityLogo
          className="hooma-hq-logo"
          logoUrl={community.logoUrl}
          name={community.name}
          alt={`${community.name} logo`}
        />
        <div className="hooma-hq-copy">
          <span className="eyebrow">
            {community.houma || community.city || "NEIGHBORHOOD HOOMA"}
          </span>
          <h1>{community.name}</h1>
          <p>
            {community.description ||
              "A neighborhood built around football, people and local identity."}
          </p>
          <div className="hooma-hq-meta">
            <span>{community._count.memberships} members</span>
            <span>{community._count.teams} teams</span>
            <CommunityVisibilityIndicator visibility={community.visibility} />
            {membership ? <span className="hooma-role-chip">{membership.role}</span> : null}
          </div>
          <div className="hooma-hq-actions">
            {!me && signInHref ? (
              <a className="button" href={signInHref}>
                Sign in to {community.visibility === "PRIVATE" ? "request access" : "join"}
              </a>
            ) : null}
            {me && !membership && !joinRequest ? (
              <button
                className="button"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void perform("join", () => api.communities.join(community.id))}
              >
                {busy === "join"
                  ? community.visibility === "PRIVATE"
                    ? "Requesting…"
                    : "Joining…"
                  : community.visibility === "PRIVATE"
                    ? "Request to join"
                    : "Join HOOMA"}
              </button>
            ) : null}
            {me && !membership && joinRequest ? (
              <div className="hooma-pending-membership">
                <span>Membership request pending</span>
                <button
                  className="button secondary"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void perform("cancel-request", () =>
                      api.communities.cancelJoinRequest(community.id),
                    )
                  }
                >
                  {busy === "cancel-request" ? "Cancelling…" : "Cancel request"}
                </button>
              </div>
            ) : null}
            {membership && membership.role !== "FOUNDER" ? (
              <button
                className="button secondary"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void perform("leave", () => api.communities.leave(community.id))}
              >
                {busy === "leave" ? "Leaving…" : "Leave HOOMA"}
              </button>
            ) : null}
          </div>
        </div>
      </CommunityMediaSurface>

      {error ? <div className="error-box">{error}</div> : null}

      {membership ? (
        <CommunityHoomaNowSection communityId={community.id} />
      ) : (
        <section
          className="hooma-now hooma-now--community is-locked"
          aria-labelledby="community-hooma-now-title"
        >
          <header className="hooma-now__header">
            <div>
              <p className="hooma-now__eyebrow">MEMBERS LIVE FEED</p>
              <h2 id="community-hooma-now-title" className="hooma-now__title">
                HOOMA NOW
              </h2>
              <p className="hooma-now__intro">
                Join this HOOMA to see member-only live Ride requests and activity.
              </p>
            </div>
            <span className="hooma-now__live" aria-label="Locked community live feed">
              <span aria-hidden="true" /> MEMBERS
            </span>
          </header>
          <p className="hooma-now__state">HOOMA NOW Ride requests are private to members.</p>
        </section>
      )}

      <section className="hooma-hq-grid">
        <article className="panel hooma-hq-module">
          <span className="eyebrow">COMMUNITY</span>
          <h2>Neighborhood HQ</h2>
          <p>
            Teams, local match activity and community tools gather here instead of being scattered
            around the app.
          </p>
          <div className="hooma-module-links">
            <a href="/teams">Teams</a>
            <a href="/play">Play nearby</a>
          </div>
        </article>
        {membership ? (
          <HoomaWhistleBoard communityId={community.id} />
        ) : (
          <article className="panel hooma-hq-module whistle-module is-locked">
            <span className="eyebrow">PRIVATE</span>
            <h2>Whistle Board</h2>
            <p>Join this HOOMA to access its private neighborhood Whistle Board.</p>
            <span className="whistle-status">MEMBERS ONLY</span>
          </article>
        )}
      </section>

      {membership ? (
        <section className="panel hooma-member-directory">
          <div className="hooma-section-heading">
            <div>
              <span className="eyebrow">MEMBERS</span>
              <h2>People in this HOOMA</h2>
            </div>
            <span className="muted">Private to current members</span>
          </div>
          <div className="hooma-member-list">
            {members.map((member) => {
              const name =
                member.presentation?.displayName || member.presentation?.username || "HOOMA member";
              const canRemove =
                canManage &&
                member.role !== "FOUNDER" &&
                member.userId !== me?.id &&
                (membership.role === "FOUNDER" || member.role === "MEMBER");
              return (
                <article className="hooma-member-row" key={member.userId}>
                  <div className="hooma-member-identity">
                    {member.presentation?.photoUrl ? (
                      <img src={member.presentation.photoUrl} alt="" />
                    ) : (
                      <span className="hooma-member-avatar">{initials(name)}</span>
                    )}
                    <div>
                      <strong>{name}</strong>
                      {member.presentation?.username ? (
                        <small>@{member.presentation.username}</small>
                      ) : null}
                    </div>
                  </div>
                  <div className="hooma-member-controls">
                    <span className="hooma-role-chip">{member.role}</span>
                    {membership.role === "FOUNDER" && member.role === "MEMBER" ? (
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void perform(`coach-${member.userId}`, () =>
                            api.communities.appointCoach(community.id, member.userId),
                          )
                        }
                      >
                        Make Coach
                      </button>
                    ) : null}
                    {membership.role === "FOUNDER" && member.role === "COACH" ? (
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void perform(`member-${member.userId}`, () =>
                            api.communities.revokeCoach(community.id, member.userId),
                          )
                        }
                      >
                        Make Member
                      </button>
                    ) : null}
                    {canRemove ? (
                      <button
                        className="danger"
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void perform(`remove-${member.userId}`, () =>
                            api.communities.removeMember(community.id, member.userId),
                          )
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {membership?.role === "FOUNDER" ? (
        <HoomaMembershipRequests communityId={community.id} onChanged={loadDetail} />
      ) : null}

      {canManage ? (
        <section className="panel hooma-hq-manage">
          <span className="eyebrow">COMMUNITY OFFICE</span>
          <h2>{membership?.role === "FOUNDER" ? "Founder controls" : "Coach controls"}</h2>
          <p className="muted">
            Membership actions above use scoped HOOMA authority. Global App Admin remains completely
            separate.
          </p>
        </section>
      ) : null}
    </div>
  );
}
