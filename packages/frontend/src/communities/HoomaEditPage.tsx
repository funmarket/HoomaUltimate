import type { MeResponse } from "@hooma/contracts";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { PublicCommunityDetail } from "../api";
import { useHoomaFrontend } from "../context";
import { resolveCommunityIdentityMediaUrl } from "./CommunityMedia";
import {
  CommunityIdentityInput,
  identitySelectionFromUrl,
  useCommunityIdentityPreview,
  validateIdentitySelection,
  type CommunityIdentitySelection,
} from "./CommunityIdentityInputs";

export function HoomaEditPage({ communityId }: { readonly communityId: string }) {
  const { api, protectedError, transport } = useHoomaFrontend();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<PublicCommunityDetail | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [logoSelection, setLogoSelection] = useState<CommunityIdentitySelection>({
    mode: "none",
    url: "",
    file: null,
  });
  const [bannerSelection, setBannerSelection] = useState<CommunityIdentitySelection>({
    mode: "none",
    url: "",
    file: null,
  });
  const [logoUploaded, setLogoUploaded] = useState(false);
  const [bannerUploaded, setBannerUploaded] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const logoPreview = useCommunityIdentityPreview(logoSelection, community?.logoUrl ?? null);
  const bannerPreview = useCommunityIdentityPreview(bannerSelection, community?.bannerUrl ?? null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([api.communities.publicDetail(communityId), api.identity.me()])
      .then(([detail, identity]) => {
        if (!active) return;
        const membership = identity.communities.find((item) => item.id === communityId);
        const allowed =
          membership?.role === "FOUNDER" || identity.platformRoles.includes("PLATFORM_ADMIN");
        if (!allowed) {
          setError("HOOMA creator or App Admin access required.");
          return;
        }
        setCommunity(detail);
        setLogoSelection(identitySelectionFromUrl(detail.logoUrl, "logo"));
        setBannerSelection(identitySelectionFromUrl(detail.bannerUrl, "banner"));
        setLogoUploaded(false);
        setBannerUploaded(false);
        setMe(identity);
      })
      .catch((reason) => {
        if (active) setError(protectedError(reason, "Unable to open HOOMA settings"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, communityId, protectedError]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!community || saving) return;
    const currentLogoManaged =
      identitySelectionFromUrl(community.logoUrl, "logo").mode === "upload";
    const currentBannerManaged =
      identitySelectionFromUrl(community.bannerUrl, "banner").mode === "upload";
    const logoProblem = validateIdentitySelection(
      logoSelection,
      "logo",
      currentLogoManaged || logoUploaded,
    );
    const bannerProblem = validateIdentitySelection(
      bannerSelection,
      "banner",
      currentBannerManaged || bannerUploaded,
    );
    if (logoProblem || bannerProblem) {
      setError(logoProblem ?? bannerProblem ?? "Invalid image selection.");
      return;
    }
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      setUploadStatus("Saving HOOMA details…");
      await api.communities.update(community.id, {
        name: String(data.get("name")).trim(),
        description: String(data.get("description")).trim() || null,
        city: String(data.get("city")).trim() || null,
        houma: String(data.get("houma")).trim() || null,
        ...(logoSelection.mode !== "upload"
          ? { logoUrl: logoSelection.mode === "external" ? logoSelection.url.trim() : null }
          : {}),
        ...(bannerSelection.mode !== "upload"
          ? { bannerUrl: bannerSelection.mode === "external" ? bannerSelection.url.trim() : null }
          : {}),
        visibility: data.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC",
      });
      if (logoSelection.mode === "upload" && logoSelection.file && !logoUploaded) {
        setUploadStatus("Uploading Community logo…");
        await api.communities.uploadIdentity(community.id, "logo", logoSelection.file);
        setLogoUploaded(true);
      }
      if (bannerSelection.mode === "upload" && bannerSelection.file && !bannerUploaded) {
        setUploadStatus("Uploading Community banner…");
        await api.communities.uploadIdentity(community.id, "banner", bannerSelection.file);
        setBannerUploaded(true);
      }
      const current = await api.communities.publicDetail(community.id);
      setCommunity(current);
      setLogoSelection(identitySelectionFromUrl(current.logoUrl, "logo"));
      setBannerSelection(identitySelectionFromUrl(current.bannerUrl, "banner"));
      setLogoUploaded(false);
      setBannerUploaded(false);
      setNotice("HOOMA settings saved.");
    } catch (reason) {
      setError(protectedError(reason, "HOOMA settings or media was not fully saved. Retry."));
    } finally {
      setUploadStatus("");
      setSaving(false);
    }
  }

  async function deleteHooma() {
    if (!community || deleting) return;
    if (
      !window.confirm(
        `Delete ${community.name}? Active Teams and published Events must be cleared first. Historical records will be preserved.`,
      )
    )
      return;
    setDeleting(true);
    setError("");
    try {
      await api.communities.archive(community.id);
      navigate(me?.platformRoles.includes("PLATFORM_ADMIN") ? "/admin" : "/hooma", {
        replace: true,
      });
    } catch (reason) {
      setError(protectedError(reason, "Unable to delete HOOMA"));
      setDeleting(false);
    }
  }

  if (loading)
    return (
      <div className="hooma-lane--content">
        <div className="page hooma-create-page">
          <div className="state-card">Loading HOOMA settings…</div>
        </div>
      </div>
    );

  return (
    <div className="hooma-lane--content">
      <div className="page hooma-create-page hooma-edit-page">
        <a
          className="team-management-back"
          href={me?.platformRoles.includes("PLATFORM_ADMIN") ? "/admin" : `/hooma/${communityId}`}
        >
          ← {me?.platformRoles.includes("PLATFORM_ADMIN") ? "App Admin" : "HOOMA HQ"}
        </a>
        <section className="panel">
          <span className="eyebrow">HOOMA SETTINGS</span>
          <h1>Edit HOOMA</h1>
          <p className="muted">
            Update the community identity, neighborhood, privacy and media from one canonical
            settings page.
          </p>
        </section>
        {error ? <div className="error-box">{error}</div> : null}
        {uploadStatus ? (
          <p className="muted" role="status">
            {uploadStatus}
          </p>
        ) : null}
        {notice ? <div className="success-box">{notice}</div> : null}
        {community ? (
          <>
            <form className="panel hooma-create-form" onSubmit={submit}>
              <fieldset className="hooma-privacy-choice">
                <legend>Who can join?</legend>
                <label className={community.visibility === "PUBLIC" ? "is-selected" : ""}>
                  <input
                    type="radio"
                    name="visibility"
                    value="PUBLIC"
                    defaultChecked={community.visibility === "PUBLIC"}
                  />
                  <span>
                    <strong>Public</strong>
                    <small>People can find this HOOMA and join immediately.</small>
                  </span>
                </label>
                <label className={community.visibility === "PRIVATE" ? "is-selected" : ""}>
                  <input
                    type="radio"
                    name="visibility"
                    value="PRIVATE"
                    defaultChecked={community.visibility === "PRIVATE"}
                  />
                  <span>
                    <strong>Private</strong>
                    <small>People can find this HOOMA but the Founder approves membership.</small>
                  </span>
                </label>
              </fieldset>
              <div className="hooma-form-grid">
                <label className="field">
                  <span>Name</span>
                  <input
                    name="name"
                    defaultValue={community.name}
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
                <label className="field">
                  <span>City</span>
                  <input name="city" defaultValue={community.city ?? ""} maxLength={100} />
                </label>
                <label className="field">
                  <span>Houma / neighborhood</span>
                  <input name="houma" defaultValue={community.houma ?? ""} maxLength={100} />
                </label>
                <CommunityIdentityInput
                  slot="logo"
                  selection={logoSelection}
                  previewUrl={resolveCommunityIdentityMediaUrl(logoPreview, transport.baseUrl)}
                  disabled={saving || deleting}
                  onChange={(next) => {
                    setLogoUploaded(false);
                    setLogoSelection(next);
                  }}
                />
                <CommunityIdentityInput
                  slot="banner"
                  selection={bannerSelection}
                  previewUrl={resolveCommunityIdentityMediaUrl(bannerPreview, transport.baseUrl)}
                  disabled={saving || deleting}
                  onChange={(next) => {
                    setBannerUploaded(false);
                    setBannerSelection(next);
                  }}
                />
                <label className="field hooma-span-2">
                  <span>Description</span>
                  <textarea
                    name="description"
                    defaultValue={community.description ?? ""}
                    maxLength={600}
                    rows={4}
                  />
                </label>
              </div>
              <div className="hooma-form-actions">
                <a
                  className="button secondary"
                  href={
                    me?.platformRoles.includes("PLATFORM_ADMIN")
                      ? "/admin"
                      : `/hooma/${community.id}`
                  }
                >
                  Cancel
                </a>
                <button className="button" disabled={saving || deleting}>
                  {saving ? "Saving…" : "Save HOOMA"}
                </button>
              </div>
            </form>
            <section className="panel entity-danger-zone">
              <span className="eyebrow">DANGER ZONE</span>
              <h2>Delete HOOMA</h2>
              <p>
                Removes this HOOMA from active discovery. Delete its active Team and finish/cancel
                published Events first. Historical records are preserved.
              </p>
              <button
                className="entity-delete-action"
                type="button"
                disabled={deleting || saving}
                onClick={() => void deleteHooma()}
              >
                {deleting ? "Deleting…" : "Delete HOOMA"}
              </button>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
