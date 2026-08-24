import { useEffect, useMemo, useState } from "react";
import { useHoomaFrontend, type PublicProfile } from "@hooma/frontend";

export function PublicProfilePage({ username }: { username: string }) {
  const { api } = useHoomaFrontend();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const normalizedUsername = useMemo(() => username.trim().toLowerCase(), [username]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api.identity
      .publicProfile(normalizedUsername)
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch((reason) => {
        if (active) {
          setProfile(null);
          setError(reason instanceof Error ? reason.message : "Unable to load player profile");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, normalizedUsername]);

  if (loading) return <p className="status">Loading player profile…</p>;
  if (!profile) {
    return (
      <section className="panel public-profile-state">
        <strong>Player profile unavailable.</strong>
        <span>{error || "This HOOMA profile could not be found."}</span>
        <a href="/play">Back to Play</a>
      </section>
    );
  }

  const { presentation } = profile;
  return (
    <section className="public-profile-page">
      <header className="public-profile-hero">
        <div className="public-profile-photo" aria-hidden={!presentation.photoUrl}>
          {presentation.photoUrl ? (
            <img src={presentation.photoUrl} alt="" />
          ) : (
            <span>{presentation.displayName.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="public-profile-copy">
          <p className="eyebrow">HOOMA PLAYER</p>
          <h1>{presentation.displayName}</h1>
          <p className="public-profile-username">@{presentation.username}</p>
          {presentation.bio ? <p className="public-profile-bio">{presentation.bio}</p> : null}
        </div>
      </header>

      <section className="panel public-profile-teams">
        <div>
          <p className="eyebrow">TEAMS</p>
          <h2>Current squad links</h2>
        </div>
        {profile.teams.length ? (
          <div className="public-profile-team-list">
            {profile.teams.map((team) => (
              <a href={`/teams/${encodeURIComponent(team.id)}`} key={team.id}>
                <span className="public-profile-team-badge" aria-hidden="true">
                  {team.badgeUrl ? <img src={team.badgeUrl} alt="" /> : team.name.slice(0, 1)}
                </span>
                <strong>{team.name}</strong>
                <span>Open Team</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="muted">No current Team roster memberships are public on this profile.</p>
        )}
      </section>

      <section className="panel public-profile-contact">
        <p className="eyebrow">CONTACT</p>
        <h2>Whistle</h2>
        <p className="muted">
          Direct player Whistle is not enabled yet. HOOMA will use the shared Whistle engine when its player-to-player authorization contract is implemented.
        </p>
      </section>
    </section>
  );
}
