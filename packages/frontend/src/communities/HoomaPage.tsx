import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { MeResponse } from "@hooma/contracts";
import { useHoomaFrontend } from "../context";
import type { PublicCommunitySummary } from "../api";

function report(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unexpected HOOMA error";
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
        <p>Find your people, build your neighborhood, start a Team, or branch into supporter and gaming communities.</p>
      </section>

      <section className="hooma-create-section">
        <div className="hooma-section-heading">
          <div>
            <span className="eyebrow">CREATE</span>
            <h2>What are you starting?</h2>
          </div>
          <p className="muted">One gateway. Four distinct community domains.</p>
        </div>

        <div className="hooma-create-grid">
          <button type="button" className="hooma-create-card" onClick={() => navigate("/hooma/new")}>
            <strong>HOOMA</strong>
            <span>Start a neighborhood community</span>
            <small>Founder · Coach · Member</small>
          </button>
          <button type="button" className="hooma-create-card" onClick={() => navigate("/teams")}>
            <strong>TEAM</strong>
            <span>Build a football side</span>
            <small>Coach · Assistant · Player</small>
          </button>
          <div className="hooma-create-card is-future" aria-disabled="true">
            <strong>ULTRAS</strong>
            <span>Build an official-club supporter group</span>
            <small>Coming with the canonical ULTRAS domain</small>
          </div>
          <div className="hooma-create-card is-future" aria-disabled="true">
            <strong>GAMERS</strong>
            <span>Build a gaming squad</span>
            <small>Coming with the canonical Gamers domain</small>
          </div>
        </div>
      </section>

      {me ? (
        <section className="panel hooma-memberships">
          <span className="eyebrow">MY HOOMAS</span>
          <h2>Your neighborhood communities</h2>
          {me.communities.length ? (
            <div className="hooma-community-list">
              {me.communities.map((community) => (
                <article key={community.id} className="hooma-community-row">
                  <div>
                    <strong>{community.name}</strong>
                    <span>@{community.slug}</span>
                  </div>
                  <span className="hooma-role-chip">{community.role}</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="state-card">
              <strong>No HOOMA yet.</strong>
              <p className="muted">Create your neighborhood community to become its Founder.</p>
              <button className="button" type="button" onClick={() => navigate("/hooma/new")}>Create HOOMA</button>
            </div>
          )}
        </section>
      ) : (
        <section className="member-gate">
          <strong>Want to create a community?</strong>
          <span className="muted">Discovery stays public. Authentication starts only when you create.</span>
          {signInHref ? <a className="button secondary" href={signInHref}>Sign in</a> : <span className="muted">Open HOOMA through Telegram to authenticate.</span>}
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
        {loading ? <div className="state-card"><strong>Loading HOOMAs…</strong></div> : null}
        {!loading && !communities.length && !error ? <div className="state-card"><strong>No public HOOMAs yet.</strong><p className="muted">The first neighborhood community can start here.</p></div> : null}
        {communities.length ? (
          <div className="hooma-discovery-grid">
            {communities.map((community) => (
              <article className="hooma-discovery-card" key={community.id}>
                <span className="eyebrow">{community.houma || community.city || "HOOMA"}</span>
                <h3>{community.name}</h3>
                <p>{community.description || "A local HOOMA community."}</p>
                <small>{[community.city, community.houma].filter(Boolean).join(" · ") || `@${community.slug}`}</small>
              </article>
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
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      await api.communities.create({
        name,
        description: description.trim() || null,
        city: city.trim() || null,
        houma: houma.trim() || null
      });
      navigate("/hooma");
    } catch (reason) {
      setError(protectedError(reason, "Could not create HOOMA"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page hooma-create-page">
      <section className="hooma-hero panel compact">
        <span className="eyebrow">CREATE A NEIGHBORHOOD</span>
        <h1>Create HOOMA</h1>
        <p>The creator becomes Founder automatically. HOOMA generates the community slug and membership safely on the server.</p>
      </section>
      <form className="panel hooma-create-form" onSubmit={submit}>
        <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="La Marsa HOOMA" required minLength={2} maxLength={100} /></label>
        <label className="field"><span>City</span><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Tunis" maxLength={100} /></label>
        <label className="field"><span>Houma / neighborhood</span><input value={houma} onChange={(event) => setHouma(event.target.value)} placeholder="La Marsa" maxLength={100} /></label>
        <label className="field"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What brings this neighborhood together?" maxLength={600} rows={5} /></label>
        {error ? <div className="error-box">{error}</div> : null}
        <div className="hooma-form-actions">
          <button className="button secondary" type="button" onClick={() => navigate("/hooma")}>Cancel</button>
          <button className="button" disabled={creating || name.trim().length < 2}>{creating ? "Creating…" : "Create HOOMA"}</button>
        </div>
      </form>
    </div>
  );
}
