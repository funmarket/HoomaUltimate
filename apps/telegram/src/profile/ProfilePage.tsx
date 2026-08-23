import { useEffect, useState, type FormEvent } from "react";
import type { MeResponse } from "@hooma/contracts";
import { useHoomaFrontend } from "@hooma/frontend";

export function ProfilePage({ me, onRefresh }: { readonly me: MeResponse | null; readonly onRefresh: () => Promise<void> }) {
  const { api } = useHoomaFrontend();
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
        bio: bio.trim() || null
      });
      await onRefresh();
      setStatus("Profile updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update profile");
    } finally {
      setSaving(false);
    }
  }

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

      <form className="status profile-edit-form" onSubmit={save}>
        <div>
          <p className="eyebrow">EDIT PROFILE</p>
          <strong>Your HOOMA identity</strong>
          <p className="muted">These HOOMA presentation details are separate from your Telegram account identity.</p>
        </div>
        <label>
          Display name
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={120} required />
        </label>
        <label>
          HOOMA username
          <input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={64} pattern="[A-Za-z0-9_.-]+" required autoCapitalize="none" />
        </label>
        <label>
          Profile photo URL
          <input type="url" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} placeholder="https://…" />
        </label>
        <label>
          Bio
          <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={4} maxLength={500} />
        </label>
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
        {status ? <p className="success">{status}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </form>

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
