import type { MeResponse } from "@hooma/contracts";

export function ProfilePage({ me }: { readonly me: MeResponse | null }) {
  if (!me) return <p className="status">Profile requires Telegram authentication.</p>;

  return (
    <section className="profile-page">
      <header className="profile-card">
        {me.presentation.photoUrl ? (
          <img src={me.presentation.photoUrl} alt="" />
        ) : (
          <div className="profile-avatar" aria-hidden="true">
            {me.presentation.displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <p className="eyebrow">PROFILE</p>
          <h2>{me.presentation.displayName}</h2>
          <p>@{me.presentation.username}</p>
          {me.presentation.bio ? <p>{me.presentation.bio}</p> : null}
        </div>
      </header>

      <section className="status">
        <strong>My Teams</strong>
        {me.teams.length ? me.teams.map((team) => (
          <p key={team.id}>
            {team.name} — {[team.isPlayer ? "Player" : null, ...team.responsibilities].filter(Boolean).join(" · ")}
          </p>
        )) : <p>No Team memberships yet.</p>}
      </section>

      <section className="status">
        <strong>My HOOMA</strong>
        {me.communities.length ? me.communities.map((community) => (
          <p key={community.id}>
            {community.name} — {community.role === "FOUNDER" ? "Founder" : community.role === "COACH" ? "Coach" : "Member"}
          </p>
        )) : <p>No community memberships yet.</p>}
      </section>
    </section>
  );
}
