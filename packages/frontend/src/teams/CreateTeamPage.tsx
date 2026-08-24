import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { MeResponse } from "@hooma/contracts";
import { useHoomaFrontend } from "../context";

export function CreateTeamPage() {
  const { api, authenticationHref, protectedError } = useHoomaFrontend();
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [communityId, setCommunityId] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [badgeUrl, setBadgeUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api.identity
      .meOptional()
      .then((response) => {
        if (!active) return;
        setMe(response);
        const firstEligible = response?.communities.find(
          (community) => community.role === "FOUNDER" || community.role === "COACH",
        );
        setCommunityId(firstEligible?.id ?? "");
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Could not load Team creation");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!communityId) return;
    setCreating(true);
    setError("");
    try {
      await api.teams.create({
        communityId,
        name,
        city: city.trim() || null,
        badgeUrl: badgeUrl.trim() || null,
        bannerUrl: bannerUrl.trim() || null,
      });
      navigate("/teams");
    } catch (reason) {
      setError(protectedError(reason, "Could not create Team"));
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="page teams-page">
        <div className="state-card">
          <strong>Loading Team creation…</strong>
        </div>
      </div>
    );
  }

  if (!me) {
    const signInHref = authenticationHref("/teams/new");
    return (
      <div className="page teams-page">
        <section className="panel">
          <span className="eyebrow">CREATE TEAM</span>
          <h1>Create A Team</h1>
          <p className="muted">Team creation is a protected member action.</p>
        </section>
        <div className="member-gate">
          <strong>Sign in to create a Team.</strong>
          {signInHref ? (
            <a className="button" href={signInHref}>
              Sign in
            </a>
          ) : (
            <span className="muted">Open HOOMA through Telegram to authenticate.</span>
          )}
          <a className="button secondary" href="/teams">
            Back to Teams
          </a>
        </div>
      </div>
    );
  }

  const eligibleCommunities = me.communities.filter(
    (community) => community.role === "FOUNDER" || community.role === "COACH",
  );

  return (
    <div className="page teams-page">
      <section className="panel">
        <span className="eyebrow">CREATE TEAM</span>
        <h1>Create A Team</h1>
        <p className="muted">
          Build your football side without taking space from the Teams discovery page.
        </p>
      </section>

      {eligibleCommunities.length ? (
        <form className="inline-form panel" onSubmit={submit}>
          <label className="field">
            <span>Community</span>
            <select
              value={communityId}
              onChange={(event) => setCommunityId(event.target.value)}
              required
            >
              {eligibleCommunities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Team name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Team name"
              required
            />
          </label>
          <label className="field">
            <span>City</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="City"
            />
          </label>
          <label className="field">
            <span>Team logo / crest URL</span>
            <input
              type="url"
              maxLength={2000}
              value={badgeUrl}
              onChange={(event) => setBadgeUrl(event.target.value)}
              placeholder="https://…/team-logo.png"
            />
          </label>
          <label className="field">
            <span>Banner image URL</span>
            <input
              type="url"
              maxLength={2000}
              value={bannerUrl}
              onChange={(event) => setBannerUrl(event.target.value)}
              placeholder="https://…/team-banner.jpg"
            />
          </label>
          {error ? <div className="error-box">{error}</div> : null}
          <div>
            <a className="button secondary" href="/teams">
              Cancel
            </a>{" "}
            <button className="button" disabled={creating || !name.trim()}>
              {creating ? "Creating…" : "Create Team"}
            </button>
          </div>
        </form>
      ) : (
        <div className="state-card">
          <strong>Team creation needs a Community.</strong>
          <p className="muted">
            You must be a Community Founder or Coach before creating its Team.
          </p>
          <a className="button secondary" href="/hooma">
            Go to HOOMA
          </a>
        </div>
      )}

      {error && !eligibleCommunities.length ? <div className="error-box">{error}</div> : null}
    </div>
  );
}
