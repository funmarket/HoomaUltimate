import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { MeResponse } from "@hooma/contracts";
import type { PublicCommunityDetail } from "../api";
import { useHoomaFrontend } from "../context";

export function HoomaEditPage({ communityId }: { readonly communityId: string }) {
  const { api, protectedError } = useHoomaFrontend();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<PublicCommunityDetail | null>(null);
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
    void Promise.all([api.communities.publicDetail(communityId), api.identity.me()])
      .then(([detail, identity]) => {
        if (!active) return;
        const membership = identity.communities.find((item) => item.id === communityId);
        const allowed = membership?.role === "FOUNDER" || identity.platformRoles.includes("PLATFORM_ADMIN");
        if (!allowed) {
          setError("HOOMA creator or App Admin access required.");
          return;
        }
        setCommunity(detail);
        setMe(identity);
      })
      .catch((reason) => {
        if (active) setError(protectedError(reason, "Unable to open HOOMA settings"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [api, communityId, protectedError]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!community || saving) return;
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.communities.update(community.id, {
        name: String(data.get("name")).trim(),
        description: String(data.get("description")).trim() || null,
        city: String(data.get("city")).trim() || null,
        houma: String(data.get("houma")).trim() || null,
        logoUrl: String(data.get("logoUrl")).trim() || null,
        bannerUrl: String(data.get("bannerUrl")).trim() || null,
      });
      setCommunity(await api.communities.publicDetail(community.id));
      setNotice("HOOMA settings saved.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to save HOOMA settings"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteHooma() {
    if (!community || deleting) return;
    if (!window.confirm(`Delete ${community.name}? Active Teams and published Events must be cleared first. Historical records will be preserved.`)) return;
    setDeleting(true);
    setError("");
    try {
      await api.communities.archive(community.id);
      navigate(me?.platformRoles.includes("PLATFORM_ADMIN") ? "/admin" : "/hooma", { replace: true });
    } catch (reason) {
      setError(protectedError(reason, "Unable to delete HOOMA"));
      setDeleting(false);
    }
  }

  if (loading) return <div className="page hooma-create-page"><div className="state-card">Loading HOOMA settings…</div></div>;

  return (
    <div className="page hooma-create-page hooma-edit-page">
      <a className="team-management-back" href={me?.platformRoles.includes("PLATFORM_ADMIN") ? "/admin" : `/hooma/${communityId}`}>
        ← {me?.platformRoles.includes("PLATFORM_ADMIN") ? "App Admin" : "HOOMA HQ"}
      </a>
      <section className="panel">
        <span className="eyebrow">HOOMA SETTINGS</span>
        <h1>Edit HOOMA</h1>
        <p className="muted">Update the community identity, neighborhood and media from one canonical settings page.</p>
      </section>
      {error ? <div className="error-box">{error}</div> : null}
      {notice ? <div className="success-box">{notice}</div> : null}
      {community ? (
        <>
          <form className="panel hooma-create-form" onSubmit={submit}>
            <div className="hooma-form-grid">
              <label className="field"><span>Name</span><input name="name" defaultValue={community.name} required minLength={2} maxLength={100} /></label>
              <label className="field"><span>City</span><input name="city" defaultValue={community.city ?? ""} maxLength={100} /></label>
              <label className="field"><span>Houma / neighborhood</span><input name="houma" defaultValue={community.houma ?? ""} maxLength={100} /></label>
              <label className="field"><span>Community logo URL</span><input name="logoUrl" type="url" defaultValue={community.logoUrl ?? ""} maxLength={2000} /></label>
              <label className="field hooma-span-2"><span>Banner image URL</span><input name="bannerUrl" type="url" defaultValue={community.bannerUrl ?? ""} maxLength={2000} /></label>
              <label className="field hooma-span-2"><span>Description</span><textarea name="description" defaultValue={community.description ?? ""} maxLength={600} rows={4} /></label>
            </div>
            <div className="hooma-form-actions">
              <a className="button secondary" href={me?.platformRoles.includes("PLATFORM_ADMIN") ? "/admin" : `/hooma/${community.id}`}>Cancel</a>
              <button className="button" disabled={saving || deleting}>{saving ? "Saving…" : "Save HOOMA"}</button>
            </div>
          </form>
          <section className="panel entity-danger-zone">
            <span className="eyebrow">DANGER ZONE</span>
            <h2>Delete HOOMA</h2>
            <p>Removes this HOOMA from active discovery. Delete its active Team and finish/cancel published Events first. Historical records are preserved.</p>
            <button className="entity-delete-action" type="button" disabled={deleting || saving} onClick={() => void deleteHooma()}>
              {deleting ? "Deleting…" : "Delete HOOMA"}
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}
