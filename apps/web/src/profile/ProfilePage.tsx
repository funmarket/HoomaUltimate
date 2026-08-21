import { useEffect, useState } from "react";
import type { MeResponse } from "@hooma/contracts";
import { webApi } from "../api/client";
export function ProfilePage() {
  const [me, setMe] = useState<MeResponse | null>(null); const [error, setError] = useState("");
  useEffect(() => { void webApi.me().then(setMe).catch((reason: Error) => setError(reason.message)); }, []);
  if (error) return <section className="panel"><p className="error">{error}</p><a href="/login?returnTo=%2Fprofile">Sign in</a></section>;
  if (!me) return <p className="status">Loading profile…</p>;
  return <ProfileContent me={me} />;
}
export function ProfileContent({ me }: { me: MeResponse }) {
  return <section className="profile-page"><header className="profile-card">{me.presentation.photoUrl ? <img src={me.presentation.photoUrl} alt="" /> : <div className="profile-avatar" aria-hidden="true">{me.presentation.displayName.slice(0, 1).toUpperCase()}</div>}<div><p className="eyebrow">PROFILE</p><h2>{me.presentation.displayName}</h2><p>@{me.presentation.username}</p>{me.presentation.bio ? <p>{me.presentation.bio}</p> : null}</div></header><section className="panel"><h3>My Teams</h3>{me.teams.length ? <div className="profile-links">{me.teams.map((team) => <a href={`/teams/${team.id}`} key={team.id}><strong>{team.name}</strong><span>{[team.isPlayer ? "Player" : null, ...team.responsibilities.map((role) => role === "COACH" ? "Coach" : "Assistant")].filter(Boolean).join(" · ")}</span></a>)}</div> : <p>No Team memberships yet.</p>}</section><section className="panel"><h3>My HOOMA</h3>{me.communities.length ? <div className="profile-links">{me.communities.map((community) => <a href={`/hooma/${community.id}`} key={community.id}><strong>{community.name}</strong><span>{community.role === "FOUNDER" ? "Founder" : community.role === "COACH" ? "Coach" : "Member"}</span></a>)}</div> : <p>No community memberships yet.</p>}</section>{me.platformRoles.includes("PLATFORM_ADMIN") ? <a className="admin-link" href="/admin">Open App Admin</a> : null}</section>;
}
