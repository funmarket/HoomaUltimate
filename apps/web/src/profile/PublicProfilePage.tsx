import { useEffect, useMemo, useState } from "react";
import type { ProfileIdentity } from "@hooma/contracts/profile";
import {
  createProfileApi,
  useHoomaFrontend,
  type CanonicalPublicProfile,
} from "@hooma/frontend";

export function PublicProfilePage({ username }: { username: string }) {
  const { transport } = useHoomaFrontend();
  const profileApi = useMemo(() => createProfileApi(transport), [transport]);
  const [profile, setProfile] = useState<CanonicalPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const normalizedUsername = useMemo(() => username.trim().toLowerCase(), [username]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void profileApi
      .publicByUsername(normalizedUsername)
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch((reason) => {
        if (active) {
          setProfile(null);
          setError(reason instanceof Error ? reason.message : "Unable to load HOOMA profile");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [normalizedUsername, profileApi]);

  if (loading) return <p className="status">Loading HOOMA profile…</p>;
  if (!profile) {
    return (
      <section className="panel public-profile-state">
        <strong>HOOMA profile unavailable.</strong>
        <span>{error || "This HOOMA profile could not be found."}</span>
        <a href="/">Back to HOOMA</a>
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
          <p className="eyebrow">HOOMA PASSPORT</p>
          <h1>{presentation.displayName}</h1>
          <p className="public-profile-username">@{presentation.username}</p>
          <PublicIdentityBadges identities={profile.identities} />
          {presentation.bio ? <p className="public-profile-bio">{presentation.bio}</p> : null}
        </div>
      </header>

      {profile.player ? (
        <section className="panel public-profile-player">
          <div>
            <p className="eyebrow">PLAYER</p>
            <h2>Football profile</h2>
          </div>
          <div className="public-profile-player-grid">
            <div>
              <span>Skill level</span>
              <strong>{formatEnumLabel(profile.player.skillLevel)}</strong>
            </div>
            <div>
              <span>Overall rating</span>
              <strong>{profile.player.overallRating}</strong>
            </div>
            <div>
              <span>Preferred positions</span>
              <strong>
                {profile.player.preferredPositions.length
                  ? profile.player.preferredPositions.join(" · ")
                  : "Not set"}
              </strong>
            </div>
          </div>
        </section>
      ) : null}

      {profile.teams.length ? (
        <section className="panel public-profile-teams">
          <div>
            <p className="eyebrow">TEAMS</p>
            <h2>Current Team memberships</h2>
          </div>
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
        </section>
      ) : null}

      <section className="panel public-profile-contact">
        <p className="eyebrow">CONTACT</p>
        <h2>Whistle</h2>
        <p className="muted">
          Direct profile Whistle is not enabled yet. HOOMA will use the shared Whistle engine when
          its direct-user authorization contract is implemented.
        </p>
      </section>
    </section>
  );
}

function PublicIdentityBadges({ identities }: { identities: readonly ProfileIdentity[] }) {
  if (identities.length === 0) {
    return (
      <div className="public-profile-identities" aria-label="HOOMA identities">
        <span>Ghost Rider</span>
      </div>
    );
  }
  return (
    <div className="public-profile-identities" aria-label="HOOMA identities">
      {identities.map((identity) => (
        <span key={identity}>{identityLabel(identity)}</span>
      ))}
    </div>
  );
}

function identityLabel(identity: ProfileIdentity): string {
  if (identity === "PLAYER") return "Player";
  if (identity === "FAN") return "Fan";
  return "Gamer";
}

function formatEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
