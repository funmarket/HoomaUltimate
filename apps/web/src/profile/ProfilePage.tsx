import { useEffect, useMemo, useState, type FormEvent } from "react";
import { TEAM_POSITION_ROLES, skillLevelSchema, type MeResponse } from "@hooma/contracts";
import {
  PROFILE_IDENTITIES,
  type ProfileIdentity,
  type ProfileResponse,
} from "@hooma/contracts/profile";
import { TeamOffersPanel, createProfileApi, useHoomaFrontend } from "@hooma/frontend";
import { useAccount } from "../account/AccountProvider";

const SKILL_LEVELS = skillLevelSchema.options;
type SkillLevel = NonNullable<ProfileResponse["player"]>["skillLevel"];
type TeamPosition = (typeof TEAM_POSITION_ROLES)[number];

export function ProfilePage() {
  const { authenticationHref, transport } = useHoomaFrontend();
  const profileApi = useMemo(() => createProfileApi(transport), [transport]);
  const { me, loading, error: accountError, refresh } = useAccount();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [bio, setBio] = useState("");
  const [identities, setIdentities] = useState<ProfileIdentity[]>([]);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | "">("");
  const [preferredPositions, setPreferredPositions] = useState<TeamPosition[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!me) {
      setProfile(null);
      return;
    }
    let active = true;
    setProfileLoading(true);
    setProfileLoadError("");
    void profileApi
      .mine()
      .then((value) => {
        if (!active) return;
        setProfile(value);
        hydrateEditor(value);
      })
      .catch((reason) => {
        if (!active) return;
        setProfile(null);
        setProfileLoadError(
          reason instanceof Error ? reason.message : "Unable to load canonical profile details",
        );
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [me, profileApi]);

  function hydrateEditor(value: ProfileResponse) {
    setDisplayName(value.presentation.displayName);
    setUsername(value.presentation.username);
    setPhotoUrl(value.presentation.photoUrl ?? "");
    setBio(value.presentation.bio ?? "");
    setIdentities([...value.identities]);
    setSkillLevel(value.player?.skillLevel ?? "");
    setPreferredPositions(value.player ? [...value.player.preferredPositions] : []);
  }

  function toggleIdentity(identity: ProfileIdentity, selected: boolean) {
    setIdentities((current) =>
      selected
        ? [...new Set([...current, identity])]
        : current.filter((value) => value !== identity),
    );
  }

  function togglePosition(position: TeamPosition, selected: boolean) {
    setPreferredPositions((current) => {
      if (!selected) return current.filter((value) => value !== position);
      if (current.includes(position) || current.length >= 5) return current;
      return [...current, position];
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const isPlayer = identities.includes("PLAYER");
    if (isPlayer && !skillLevel) {
      setError("Choose a football skill level before saving the Player identity.");
      return;
    }

    setSaving(true);
    setError("");
    setStatus("");
    try {
      const updated = await profileApi.updateMine({
        displayName: displayName.trim(),
        username: username.trim(),
        photoUrl: photoUrl.trim() || null,
        bio: bio.trim() || null,
        identities,
        player:
          isPlayer && skillLevel
            ? {
                skillLevel,
                preferredPositions,
              }
            : null,
      });
      setProfile(updated);
      hydrateEditor(updated);
      await refresh();
      setStatus("HOOMA Passport updated.");
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
      <ProfileContent me={me} profile={profile} />
      <TeamOffersPanel
        onAccepted={async () => {
          await refresh();
        }}
      />
      <form className="panel profile-edit-form" onSubmit={save}>
        <div>
          <p className="eyebrow">EDIT PROFILE</p>
          <h3>Your HOOMA Passport</h3>
          <p className="muted">
            One account, one profile. Choose the identities that describe how you participate in
            HOOMA. Your Web login and Telegram identity remain login methods, not separate profiles.
          </p>
        </div>

        {profileLoading ? <p className="status">Loading Passport details…</p> : null}
        {profileLoadError ? (
          <div className="profile-inline-state">
            <p className="error">{profileLoadError}</p>
            <button
              type="button"
              onClick={() => {
                setProfileLoadError("");
                setProfileLoading(true);
                void profileApi
                  .mine()
                  .then((value) => {
                    setProfile(value);
                    hydrateEditor(value);
                  })
                  .catch((reason) =>
                    setProfileLoadError(
                      reason instanceof Error
                        ? reason.message
                        : "Unable to load canonical profile details",
                    ),
                  )
                  .finally(() => setProfileLoading(false));
              }}
            >
              Try again
            </button>
          </div>
        ) : null}

        {profile ? (
          <>
            <fieldset className="profile-identity-fieldset">
              <legend>HOOMA identities</legend>
              <p className="muted">
                Select any combination. With nothing selected, your Passport displays Ghost Rider;
                Ghost Rider is never stored as an identity.
              </p>
              <div className="profile-identity-options">
                {PROFILE_IDENTITIES.map((identity) => (
                  <label key={identity}>
                    <input
                      type="checkbox"
                      checked={identities.includes(identity)}
                      onChange={(event) => toggleIdentity(identity, event.target.checked)}
                    />
                    {identityLabel(identity)}
                  </label>
                ))}
              </div>
              <IdentityBadges identities={identities} />
            </fieldset>

            {identities.includes("PLAYER") ? (
              <fieldset className="profile-player-fields">
                <legend>Player details</legend>
                <label>
                  Skill level
                  <select
                    value={skillLevel}
                    onChange={(event) => setSkillLevel(event.target.value as SkillLevel | "")}
                    required
                  >
                    <option value="">Choose skill level</option>
                    {SKILL_LEVELS.map((level) => (
                      <option value={level} key={level}>
                        {formatEnumLabel(level)}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <strong>Preferred positions</strong>
                  <p className="muted">Choose up to five.</p>
                  <div className="profile-position-options">
                    {TEAM_POSITION_ROLES.map((position) => (
                      <label key={position}>
                        <input
                          type="checkbox"
                          checked={preferredPositions.includes(position)}
                          disabled={
                            !preferredPositions.includes(position) && preferredPositions.length >= 5
                          }
                          onChange={(event) => togglePosition(position, event.target.checked)}
                        />
                        {position}
                      </label>
                    ))}
                  </div>
                </div>
                {profile.player ? (
                  <p className="muted">Current overall rating: {profile.player.overallRating}</p>
                ) : (
                  <p className="muted">
                    Complete these canonical Player details to activate the Player identity.
                  </p>
                )}
              </fieldset>
            ) : null}

            {identities.includes("GAMER") ? (
              <div className="profile-gamer-note">
                <strong>Gamer enabled</strong>
                <span>
                  Game handles and challenge visibility stay in Gamers, where each game keeps its
                  existing GamerProfile.
                </span>
                <a href="/gamers">Manage game profiles</a>
              </div>
            ) : null}

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
                maxLength={280}
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Passport"}
            </button>
          </>
        ) : null}
        {status ? <p className="success">{status}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </form>
    </section>
  );
}

export function ProfileContent({
  me,
  profile,
}: {
  me: MeResponse;
  profile?: ProfileResponse | null;
}) {
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
          <p className="eyebrow">HOOMA PASSPORT</p>
          <h2>{me.presentation.displayName}</h2>
          <p>@{me.presentation.username}</p>
          {profile ? <IdentityBadges identities={profile.identities} /> : null}
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

function IdentityBadges({ identities }: { identities: readonly ProfileIdentity[] }) {
  const values = identities.length ? identities : (["GHOST_RIDER"] as const);
  return (
    <div className="profile-identity-badges" aria-label="HOOMA identities">
      {values.map((identity) => (
        <span key={identity}>
          {identity === "GHOST_RIDER" ? "Ghost Rider" : identityLabel(identity)}
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
