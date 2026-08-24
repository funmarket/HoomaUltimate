import { useEffect, useState, type FormEvent } from "react";
import type { MeResponse } from "@hooma/contracts";
import { TeamOffersPanel, useHoomaFrontend } from "@hooma/frontend";
import { useAccount } from "../account/AccountProvider";

export function ProfilePage() {
  const { api, authenticationHref } = useHoomaFrontend();
  const { me, loading, error: accountError, refresh } = useAccount();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!me) return;
    setDisplayName(me.presentation.displayName);
    setUsername(me.presentation.username);
    setPhotoUrl(me.presentation.photoUrl ?? "");
    setBio(me.presentation.bio ?? "");
  }, [me]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await api.identity.updatePresentation({
        displayName: displayName.trim(),
        username: username.trim(),
        photoUrl: photoUrl.trim() || null,
        bio: bio.trim() || null,
      });
      await refresh();
      setStatus("Profile updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !me) return <p className="status">Loading profile…</p>;
  if (!me && accountError) {
    return (
      <section className="panel">
        <p className="error">Unable to load your HOOMA profile.</p>
        <p className="muted">{accountError}</p>
        <button type="button" onClick={() => void refresh()}>
          Try again
        </button>
      </section>
    );
  }
  if (!me) {
    const signInHref = authenticationHref("/profile");
    return (
      <section className="panel">
        <p className="error">Authentication is required to edit your HOOMA profile.</p>
        {signInHref ? <a href={signInHref}>Sign in</a> : null}
      </section>
    );
  }

  return (
    <section className="profile-page">
      <ProfileContent me={me} />
      <TeamOffersPanel onAccepted={refresh} />
      <form className="panel profile-edit-form" onSubmit={save}>
        <div>
          <p className="eyebrow">EDIT PROFILE</p>
          <h3>Your HOOMA identity</h3>
          <p className="muted">
            These are your HOOMA presentation details. Your Web login credential and Telegram
            identity stay separate.
          </p>
        </div>
        <label>
          Display name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            minLength={2}
            maxLength={120}
            required
          />
        </label>
        <label>
          HOOMA username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={64}
            pattern="[A-Za-z0-9_.-]+"
            required
            autoCapitalize="none"
          />
        </label>
        <label>
          Profile photo URL
          <input
            type="url"
            value={photoUrl}
            onChange={(event) => setPhotoUrl(event.target.value)}
            placeholder="https://…"
          />
        </label>
        <label>
          Bio
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={4}
            maxLength={500}
          />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        {status ? <p className="success">{status}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </form>
    </section>
  );
}

export function ProfileContent({ me }: { me: MeResponse }) {
  return (
    <>
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
      <section className="panel">
        <h3>My Teams</h3>
        {me.teams.length ? (
          <div className="profile-links">
            {me.teams.map((team) => (
              <a href={`/teams/${team.id}`} key={team.id}>
                <strong>{team.name}</strong>
                <span>
                  {[
                    team.isPlayer ? "Player" : null,
                    ...team.responsibilities.map((role) =>
                      role === "COACH" ? "Coach" : "Assistant",
                    ),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p>No Team memberships yet.</p>
        )}
      </section>
      <section className="panel">
        <h3>My HOOMA</h3>
        {me.communities.length ? (
          <div className="profile-links">
            {me.communities.map((community) => (
              <div className="profile-responsibility-row" key={community.id}>
                <a href={`/hooma/${community.id}`}>
                  <strong>{community.name}</strong>
                  <span>
                    {community.role === "FOUNDER"
                      ? "Founder"
                      : community.role === "COACH"
                        ? "Coach"
                        : "Member"}
                  </span>
                </a>
                {community.role === "FOUNDER" ? (
                  <a className="profile-manage-link" href={`/hooma/${community.id}/edit`}>
                    Edit / Delete
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p>No community memberships yet.</p>
        )}
      </section>
      {me.platformRoles.includes("PLATFORM_ADMIN") ? (
        <a className="admin-link" href="/admin">
          Open App Admin
        </a>
      ) : null}
    </>
  );
}
