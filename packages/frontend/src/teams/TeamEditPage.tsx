import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { MeResponse } from "@hooma/contracts";
import type { TeamControlDetail } from "../api";
import { useHoomaFrontend } from "../context";

function externalTeamMediaUrl(value: string | null): string {
  return value?.startsWith("/api/public/v1/teams/") ? "" : (value ?? "");
}

type TeamEditPageProps = {
  readonly teamId: string;
};

export function TeamEditPage({ teamId }: TeamEditPageProps) {
  const { api, protectedError } = useHoomaFrontend();
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamControlDetail | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setNotice("");
    setTeam(null);

    void Promise.all([api.teams.managed(), api.teams.publicDetail(teamId), api.identity.me()])
      .then(([managedTeams, detail, identity]) => {
        if (!active) return;
        const isPlatformAdmin = identity.platformRoles.includes("PLATFORM_ADMIN");
        if (!isPlatformAdmin && !managedTeams.some((candidate) => candidate.id === teamId)) {
          setError("You do not currently manage this Team.");
          return;
        }
        setMe(identity);
        setTeam(detail);
      })
      .catch((reason: unknown) => {
        if (active) setError(protectedError(reason, "Unable to open Team settings"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [api, protectedError, teamId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!team || saving) return;

    const data = new FormData(event.currentTarget);
    const badgeFile = data.get("badgeFile");
    const bannerFile = data.get("bannerFile");
    const badgeUrl = String(data.get("badgeUrl")).trim();
    const bannerUrl = String(data.get("bannerUrl")).trim();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await api.teams.update(team.id, {
        name: String(data.get("name")).trim(),
        motto: String(data.get("motto")).trim() || null,
        city: String(data.get("city")).trim() || null,
        houma: String(data.get("houma")).trim() || null,
        badgeUrl:
          team.badgeUrl?.startsWith("/api/public/v1/teams/") &&
          !badgeUrl &&
          !(badgeFile instanceof File && badgeFile.size)
            ? undefined
            : badgeUrl || null,
        bannerUrl:
          team.bannerUrl?.startsWith("/api/public/v1/teams/") &&
          !bannerUrl &&
          !(bannerFile instanceof File && bannerFile.size)
            ? undefined
            : bannerUrl || null,
      });
      if (badgeFile instanceof File && badgeFile.size)
        await api.teams.uploadIdentity(team.id, "badge", badgeFile);
      if (bannerFile instanceof File && bannerFile.size)
        await api.teams.uploadIdentity(team.id, "banner", bannerFile);
      const refreshed = await api.teams.publicDetail(team.id);
      setTeam(refreshed);
      setNotice("Team settings saved.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to save Team settings"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeam() {
    if (!team || deleting) return;
    if (
      !window.confirm(
        `Delete ${team.name}? It will disappear from active HOOMA surfaces while historical records are preserved.`,
      )
    )
      return;
    setDeleting(true);
    setError("");
    try {
      await api.teams.archive(team.id);
      navigate(me?.platformRoles.includes("PLATFORM_ADMIN") ? "/admin" : "/teams", {
        replace: true,
      });
    } catch (reason) {
      setError(protectedError(reason, "Unable to delete Team"));
      setDeleting(false);
    }
  }

  if (loading)
    return (
      <div className="hooma-lane--content">
        <p className="status">Loading Team settings…</p>
      </div>
    );

  return (
    <div className="hooma-lane--content">
      <section className="control-room team-edit-page">
        <a
          className="team-management-back"
          href={me?.platformRoles.includes("PLATFORM_ADMIN") ? "/admin" : "/teams/control"}
        >
          ← {me?.platformRoles.includes("PLATFORM_ADMIN") ? "App Admin" : "Coach Control Room"}
        </a>

        <header className="control-room__header team-edit-page__header">
          <div>
            <p className="eyebrow control-room__section-title">TEAM SETTINGS</p>
            <h2>Edit Team</h2>
            <p>
              Update the Team identity and media without crowding the day-to-day Coach workspace.
            </p>
          </div>
        </header>

        {error ? <p className="error">{error}</p> : null}
        {notice ? <p className="success">{notice}</p> : null}

        {team ? (
          <>
            <form className="panel team-edit-form" onSubmit={submit}>
              <div className="team-edit-form__intro">
                <span>Team</span>
                <strong>{team.name}</strong>
              </div>
              <label>
                Name
                <input name="name" defaultValue={team.name} required />
              </label>
              <label>
                Motto
                <input name="motto" defaultValue={team.motto ?? ""} />
              </label>
              <div className="team-edit-form__split">
                <label>
                  City
                  <input name="city" defaultValue={team.city ?? ""} />
                </label>
                <label>
                  Houma
                  <input name="houma" defaultValue={team.houma ?? ""} />
                </label>
              </div>
              <label>
                Team logo / crest URL
                <input
                  name="badgeUrl"
                  type="url"
                  maxLength={2000}
                  defaultValue={externalTeamMediaUrl(team.badgeUrl)}
                  placeholder="https://…/team-logo.png"
                />
              </label>
              <label>
                Or upload Team logo / crest
                <input name="badgeFile" type="file" accept="image/jpeg,image/png,image/webp" />
              </label>{" "}
              <label>
                Banner image URL
                <input
                  name="bannerUrl"
                  type="url"
                  maxLength={2000}
                  defaultValue={externalTeamMediaUrl(team.bannerUrl)}
                  placeholder="https://…/team-banner.jpg"
                />
              </label>
              <label>
                Or upload banner image
                <input name="bannerFile" type="file" accept="image/jpeg,image/png,image/webp" />
              </label>{" "}
              <div className="team-edit-form__actions">
                <a
                  className="coach-secondary-action"
                  href={me?.platformRoles.includes("PLATFORM_ADMIN") ? "/admin" : "/teams/control"}
                >
                  Cancel
                </a>
                <button
                  className="coach-primary-action"
                  type="submit"
                  disabled={saving || deleting}
                >
                  {saving ? "Saving…" : "Save Team"}
                </button>
              </div>
            </form>

            <section className="panel entity-danger-zone">
              <p className="eyebrow">DANGER ZONE</p>
              <h3>Delete Team</h3>
              <p>
                Removes this Team from active discovery and management. Historical match and audit
                records are preserved.
              </p>
              <button
                className="entity-delete-action"
                type="button"
                disabled={deleting || saving}
                onClick={() => void deleteTeam()}
              >
                {deleting ? "Deleting…" : "Delete Team"}
              </button>
            </section>
          </>
        ) : null}
      </section>
    </div>
  );
}
