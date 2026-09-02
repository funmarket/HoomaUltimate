import { useEffect, useMemo, useState } from "react";
import type { ProfileIdentity } from "@hooma/contracts/profile";
import { createProfileApi, useHoomaFrontend, type CanonicalPublicProfile } from "@hooma/frontend";
import { UserWhistlePanel } from "./UserWhistlePanel";

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
  const primaryPosition = profile.player?.preferredPositions[0] ?? null;
  const openTeam = profile.teams[0]?.name ?? null;

  return (
    <section className="public-profile-page">
      <header className="hooma-passport-card">
        <div className="hooma-passport-card__copy">
          <p className="hooma-passport-card__kicker">HOOMA PASSPORT</p>
          <h1>{presentation.displayName}</h1>
          <p className="hooma-passport-card__handle">@{presentation.username}</p>
          {profile.player ? (
            <>
              <p className="hooma-passport-card__ovr">{profile.player.overallRating}</p>
              <p className="hooma-passport-card__pos">{primaryPosition || "PLAYER"}</p>
            </>
          ) : null}
          <PublicIdentityBadges identities={profile.identities} />
        </div>
        <div className="hooma-passport-card__photo" aria-hidden={!presentation.photoUrl}>
          {presentation.photoUrl ? (
            <img src={presentation.photoUrl} alt="" />
          ) : (
            <span>{presentation.displayName.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
      </header>

      {profile.player ? (
        <div className="hooma-passport-stats" aria-label="Football profile">
          <div>
            <span>PLAY STYLE</span>
            <strong className="is-yellow">{formatEnumLabel(profile.player.skillLevel)}</strong>
          </div>
          <div>
            <span>POSITION</span>
            <strong className="is-orange">{primaryPosition || "—"}</strong>
          </div>
          <div>
            <span>TEAM STATUS</span>
            <strong className="is-green">{openTeam ? "OPEN TEAM" : "FREE AGENT"}</strong>
          </div>
        </div>
      ) : null}

      {presentation.bio ? <p className="public-profile-bio">{presentation.bio}</p> : null}

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
                <span>OPEN</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel public-profile-contact">
        <p className="eyebrow">CONTACT</p>
        <h2>Whistle</h2>
        <UserWhistlePanel
          username={presentation.username}
          recipientName={presentation.displayName}
        />
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
        <span key={identity} data-identity={identity}>
          {identityLabel(identity)}
        </span>
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
