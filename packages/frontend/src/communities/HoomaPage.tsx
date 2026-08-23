import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { MeResponse } from "@hooma/contracts";
import { useHoomaFrontend } from "../context";
import type { CommunityMember, PublicCommunityDetail, PublicCommunitySummary } from "../api";

type CreationType = "HOOMA" | "TEAM" | "ULTRAS" | "GAMERS";

type CreationOption = {
  readonly value: CreationType;
  readonly title: string;
  readonly description: string;
  readonly roles: string;
  readonly available: boolean;
  readonly href: string | null;
};

const CREATION_ORDER: readonly CreationType[] = ["HOOMA", "TEAM", "ULTRAS", "GAMERS"];
const CREATION_OPTIONS: Record<CreationType, CreationOption> = {
  HOOMA: { value: "HOOMA", title: "HOOMA", description: "Start a neighborhood community", roles: "Founder · Coach · Member", available: true, href: "/hooma/new" },
  TEAM: { value: "TEAM", title: "TEAM", description: "Build a football side", roles: "Coach · Assistant · Player", available: true, href: "/teams" },
  ULTRAS: { value: "ULTRAS", title: "ULTRAS", description: "Build an official-club supporter group", roles: "Coming with the canonical ULTRAS domain", available: false, href: null },
  GAMERS: { value: "GAMERS", title: "GAMERS", description: "Build a gaming squad", roles: "Coming with the canonical Gamers domain", available: false, href: null }
};

function report(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unexpected HOOMA error";
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "H";
}

export function HoomaPage() {
  const { api, authenticationHref } = useHoomaFrontend();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<PublicCommunitySummary[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creationType, setCreationType] = useState<CreationType>("HOOMA");
  const selectedCreation = CREATION_OPTIONS[creationType];

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
      .catch((reason) => { if (active) setError(report(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api]);

  const signInHref = authenticationHref("/hooma");
  function continueCreation() {
    if (selectedCreation.available && selectedCreation.href) navigate(selectedCreation.href);
  }

  return (
    <div className="page hooma-page">
      <section className="hooma-hero panel">
        <span className="eyebrow">YOUR FOOTBALL NEIGHBORHOOD</span>
        <h1>HOOMA</h1>
        <p>Find your people, build your neighborhood, start a Team, or branch into supporter and gaming communities.</p>
      </section>

      <section className="hooma-create-section">
        <div className="hooma-section-heading">
          <div><span className="eyebrow">CREATE</span><h2>What are you starting?</h2></div>
          <p className="muted">One gateway. Four distinct community domains.</p>
        </div>
        <div className="panel hooma-create-picker">
          <label className="hooma-create-select">
            <span>Community type</span>
            <select value={creationType} onChange={(event) => setCreationType(event.target.value as CreationType)}>
              {CREATION_ORDER.map((value) => {
                const option = CREATION_OPTIONS[value];
                return <option key={option.value} value={option.value}>{option.title}</option>;
              })}
            </select>
          </label>
          <div className={`hooma-create-selection ${selectedCreation.available ? "" : "is-future"}`} aria-live="polite">
            <strong>{selectedCreation.title}</strong><span>{selectedCreation.description}</span><small>{selectedCreation.roles}</small>
          </div>
          <button className="button hooma-create-continue" type="button" disabled={!selectedCreation.available} onClick={continueCreation}>
            {selectedCreation.available ? `Continue with ${selectedCreation.title}` : `${selectedCreation.title} coming soon`}
          </button>
        </div>
      </section>

      {me ? (
        <section className="panel hooma-memberships">
          <span className="eyebrow">MY HOOMAS</span><h2>Your neighborhood communities</h2>
          {me.communities.length ? (
            <div className="hooma-community-list">
              {me.communities.map((community) => (
                <button key={community.id} type="button" className="hooma-community-row" onClick={() => navigate(`/hooma/${community.id}`)}>
                  <div><strong>{community.name}</strong><span>@{community.slug}</span></div><span className="hooma-role-chip">{community.role}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="state-card"><strong>No HOOMA yet.</strong><p className="muted">Create your neighborhood community to become its Founder.</p><button className="button" type="button" onClick={() => navigate("/hooma/new")}>Create HOOMA</button></div>
          )}
        </section>
      ) : (
        <section className="member-gate"><strong>Want to create a community?</strong><span className="muted">Discovery stays public. Authentication starts only when you create.</span>{signInHref ? <a className="button secondary" href={signInHref}>Sign in</a> : <span className="muted">Open HOOMA through Telegram to authenticate.</span>}</section>
      )}

      <section className="hooma-discovery">
        <div className="hooma-section-heading"><div><span className="eyebrow">DISCOVER</span><h2>Neighborhood HOOMAs</h2></div></div>
        {error ? <div className="error-box">{error}</div> : null}
        {loading ? <div className="state-card"><strong>Loading HOOMAs…</strong></div> : null}
        {!loading && !communities.length && !error ? <div className="state-card"><strong>No public HOOMAs yet.</strong><p className="muted">The first neighborhood community can start here.</p></div> : null}
        {communities.length ? (
          <div className="hooma-discovery-grid">
            {communities.map((community) => (
              <button className="hooma-discovery-card" type="button" key={community.id} onClick={() => navigate(`/hooma/${community.id}`)}>
                <div className="hooma-card-media" style={community.bannerUrl ? { backgroundImage: `url(${community.bannerUrl})` } : undefined}>
                  {community.logoUrl ? <img src={community.logoUrl} alt="" /> : <span>{initials(community.name)}</span>}
                </div>
                <div className="hooma-card-copy"><span className="eyebrow">{community.houma || community.city || "HOOMA"}</span><h3>{community.name}</h3><p>{community.description || "A local HOOMA community."}</p><small>{[community.city, community.houma].filter(Boolean).join(" · ") || `@${community.slug}`}</small></div>
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
        bannerUrl: bannerUrl.trim() || null
      });
      navigate(`/hooma/${created.id}`);
    } catch (reason) {
      setError(protectedError(reason, "Could not create HOOMA"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page hooma-create-page">
      <section className="hooma-create-preview panel" style={bannerUrl ? { backgroundImage: `linear-gradient(180deg, rgba(4,5,5,.12), rgba(4,5,5,.9)), url(${bannerUrl})` } : undefined}>
        <div className="hooma-preview-logo">{logoUrl ? <img src={logoUrl} alt="Community logo preview" /> : <span>{initials(name || "HOOMA")}</span>}</div>
        <div><span className="eyebrow">BUILD YOUR NEIGHBORHOOD</span><h1>{name || "Your HOOMA"}</h1><p>{description || "Give your community a banner, a badge and a place people recognize as theirs."}</p></div>
      </section>
      <form className="panel hooma-create-form" onSubmit={submit}>
        <div className="hooma-form-intro"><span className="eyebrow">IDENTITY</span><h2>Make it feel like your place</h2><p className="muted">Use image links for now. We can add managed uploads later without changing the community model.</p></div>
        <div className="hooma-form-grid">
          <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="La Marsa HOOMA" required minLength={2} maxLength={100} /></label>
          <label className="field"><span>City</span><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Tunis" maxLength={100} /></label>
          <label className="field"><span>Houma / neighborhood</span><input value={houma} onChange={(event) => setHouma(event.target.value)} placeholder="La Marsa" maxLength={100} /></label>
          <label className="field"><span>Community logo URL</span><input type="url" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://…/logo.png" maxLength={2000} /></label>
          <label className="field hooma-span-2"><span>Banner image URL</span><input type="url" value={bannerUrl} onChange={(event) => setBannerUrl(event.target.value)} placeholder="https://…/neighborhood-banner.jpg" maxLength={2000} /></label>
          <label className="field hooma-span-2"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What makes this HOOMA yours? Match days, local pitches, people, history…" maxLength={600} rows={4} /></label>
        </div>
        {error ? <div className="error-box">{error}</div> : null}
        <div className="hooma-form-actions"><button className="button secondary" type="button" onClick={() => navigate("/hooma")}>Cancel</button><button className="button" disabled={creating || name.trim().length < 2}>{creating ? "Creating…" : "Create HOOMA"}</button></div>
      </form>
    </div>
  );
}

export function HoomaDetailPage({ communityId }: { readonly communityId: string }) {
  const { api, authenticationHref, protectedError } = useHoomaFrontend();
  const [community, setCommunity] = useState<PublicCommunityDetail | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function loadDetail() {
    const [detail, identity] = await Promise.all([api.communities.publicDetail(communityId), api.identity.meOptional()]);
    setCommunity(detail);
    setMe(identity);
    const currentMembership = identity?.communities.find((item) => item.id === communityId) ?? null;
    if (currentMembership) setMembers(await api.communities.members(communityId));
    else setMembers([]);
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
        const currentMembership = identity?.communities.find((item) => item.id === communityId) ?? null;
        if (currentMembership) {
          const rows = await api.communities.members(communityId);
          if (active) setMembers(rows);
        } else if (active) setMembers([]);
      })
      .catch((reason) => { if (active) setError(report(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
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

  if (loading) return <div className="page hooma-detail-page"><div className="state-card">Loading HOOMA…</div></div>;
  if (error && !community) return <div className="page hooma-detail-page"><div className="error-box">{error}</div></div>;
  if (!community) return <div className="page hooma-detail-page"><div className="error-box">HOOMA not found</div></div>;

  const membership = me?.communities.find((item) => item.id === community.id) ?? null;
  const signInHref = authenticationHref(`/hooma/${community.id}`);
  const canManage = membership?.role === "FOUNDER" || membership?.role === "COACH";

  return (
    <div className="page hooma-detail-page">
      <section className="hooma-hq-hero" style={community.bannerUrl ? { backgroundImage: `linear-gradient(180deg, rgba(4,5,5,.08), rgba(4,5,5,.92)), url(${community.bannerUrl})` } : undefined}>
        <div className="hooma-hq-logo">{community.logoUrl ? <img src={community.logoUrl} alt={`${community.name} logo`} /> : <span>{initials(community.name)}</span>}</div>
        <div className="hooma-hq-copy">
          <span className="eyebrow">{community.houma || community.city || "NEIGHBORHOOD HOOMA"}</span>
          <h1>{community.name}</h1>
          <p>{community.description || "A neighborhood built around football, people and local identity."}</p>
          <div className="hooma-hq-meta"><span>{community._count.memberships} members</span><span>{community._count.teams} teams</span>{membership ? <span className="hooma-role-chip">{membership.role}</span> : null}</div>
          <div className="hooma-hq-actions">
            {!me && signInHref ? <a className="button" href={signInHref}>Sign in to join</a> : null}
            {me && !membership ? <button className="button" type="button" disabled={Boolean(busy)} onClick={() => void perform("join", () => api.communities.join(community.id))}>{busy === "join" ? "Joining…" : "Join HOOMA"}</button> : null}
            {membership && membership.role !== "FOUNDER" ? <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => void perform("leave", () => api.communities.leave(community.id))}>{busy === "leave" ? "Leaving…" : "Leave HOOMA"}</button> : null}
          </div>
        </div>
      </section>

      {error ? <div className="error-box">{error}</div> : null}

      <section className="hooma-hq-grid">
        <article className="panel hooma-hq-module"><span className="eyebrow">COMMUNITY</span><h2>Neighborhood HQ</h2><p>Teams, local match activity and community tools gather here instead of being scattered around the app.</p><div className="hooma-module-links"><a href="/teams">Teams</a><a href="/play">Play nearby</a></div></article>
        <article className={`panel hooma-hq-module whistle-module ${membership ? "" : "is-locked"}`}><span className="eyebrow">PRIVATE</span><h2>Whistle Board</h2><p>{membership ? "Your private HOOMA Whistle surface lives here. It will use the shared transient Whistle rules—never permanent chat history." : "Join this HOOMA to access its private neighborhood Whistle Board."}</p><span className="whistle-status">WHISTLE DOMAIN CONNECTION NEXT</span></article>
      </section>

      {membership ? (
        <section className="panel hooma-member-directory">
          <div className="hooma-section-heading"><div><span className="eyebrow">MEMBERS</span><h2>People in this HOOMA</h2></div><span className="muted">Private to current members</span></div>
          <div className="hooma-member-list">
            {members.map((member) => {
              const name = member.presentation?.displayName || member.presentation?.username || "HOOMA member";
              const canRemove = canManage && member.role !== "FOUNDER" && member.userId !== me?.id && (membership.role === "FOUNDER" || member.role === "MEMBER");
              return (
                <article className="hooma-member-row" key={member.userId}>
                  <div className="hooma-member-identity">
                    {member.presentation?.photoUrl ? <img src={member.presentation.photoUrl} alt="" /> : <span className="hooma-member-avatar">{initials(name)}</span>}
                    <div><strong>{name}</strong>{member.presentation?.username ? <small>@{member.presentation.username}</small> : null}</div>
                  </div>
                  <div className="hooma-member-controls">
                    <span className="hooma-role-chip">{member.role}</span>
                    {membership.role === "FOUNDER" && member.role === "MEMBER" ? <button type="button" disabled={Boolean(busy)} onClick={() => void perform(`coach-${member.userId}`, () => api.communities.appointCoach(community.id, member.userId))}>Make Coach</button> : null}
                    {membership.role === "FOUNDER" && member.role === "COACH" ? <button type="button" disabled={Boolean(busy)} onClick={() => void perform(`member-${member.userId}`, () => api.communities.revokeCoach(community.id, member.userId))}>Make Member</button> : null}
                    {canRemove ? <button className="danger" type="button" disabled={Boolean(busy)} onClick={() => void perform(`remove-${member.userId}`, () => api.communities.removeMember(community.id, member.userId))}>Remove</button> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {canManage ? <section className="panel hooma-hq-manage"><span className="eyebrow">COMMUNITY OFFICE</span><h2>{membership?.role === "FOUNDER" ? "Founder controls" : "Coach controls"}</h2><p className="muted">Membership actions above use scoped HOOMA authority. Global App Admin remains completely separate.</p></section> : null}
    </div>
  );
}
