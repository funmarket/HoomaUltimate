import { useEffect, useState, type FormEvent } from "react";
import type {
  PageBannerAdminPlacement,
  PageBannerAdminSlide,
  PageBannerSlideMetadataInput,
  PlatformAdminApi,
} from "@hooma/frontend";
import type { PageBannerPlacementId } from "@hooma/contracts/page-banner";
import "./page-banner-manager.css";

const placementLabels: Readonly<Record<string, string>> = {
  HOME_TOP: "Home",
  PLAY_TOP: "Play",
  WATCH_TOP: "Watch",
  HOOMA_TOP: "HOOMA",
  TEAMS_TOP: "Teams",
  PITCH_TOP: "Pitch",
  PLACES_TOP: "Places",
  REQUESTS_TOP: "Requests",
  GEAR_UP_TOP: "Gear Up",
  RIDE_TOP: "Ride",
  ATHLETES_TOP: "Athletes",
};

type LoadState = "loading" | "ready" | "error";

type EditorState = {
  readonly placementId: PageBannerPlacementId;
  readonly slideId: string | null;
  readonly file: File | null;
  readonly enabled: boolean;
  readonly isDecorative: boolean;
  readonly altText: string;
  readonly destinationKind: "INTERNAL" | "EXTERNAL";
  readonly destinationUrl: string;
};

function newEditor(placementId: PageBannerPlacementId): EditorState {
  return {
    placementId,
    slideId: null,
    file: null,
    enabled: true,
    isDecorative: false,
    altText: "",
    destinationKind: "INTERNAL",
    destinationUrl: "",
  };
}

function editorFromSlide(slide: PageBannerAdminSlide): EditorState {
  return {
    placementId: slide.placementId,
    slideId: slide.id,
    file: null,
    enabled: slide.enabled,
    isDecorative: slide.isDecorative,
    altText: slide.altText ?? "",
    destinationKind: slide.destinationKind ?? "INTERNAL",
    destinationUrl: slide.destinationUrl ?? "",
  };
}

function metadataFromEditor(editor: EditorState): PageBannerSlideMetadataInput {
  const destinationUrl = editor.destinationUrl.trim();
  return {
    enabled: editor.enabled,
    isDecorative: editor.isDecorative,
    altText: editor.isDecorative ? null : editor.altText.trim() || null,
    destination: destinationUrl ? { kind: editor.destinationKind, url: destinationUrl } : null,
  };
}

function slideSummary(slide: PageBannerAdminSlide): string {
  const mode = slide.isDecorative ? "Decorative" : "Informational";
  const click = slide.destinationUrl ? "Clickable" : "Not clickable";
  return `${mode} · ${click} · ${slide.enabled ? "On" : "Off"}`;
}

export function PageBannerManager({ adminApi }: { readonly adminApi: PlatformAdminApi }) {
  const [placements, setPlacements] = useState<readonly PageBannerAdminPlacement[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [savingPlacement, setSavingPlacement] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoadState("loading");
    setError("");
    try {
      setPlacements(await adminApi.pageBanners.list());
      setLoadState("ready");
    } catch (cause) {
      setLoadState("error");
      setError(cause instanceof Error ? cause.message : "Unable to load PageBanner placements");
    }
  }

  useEffect(() => {
    void load();
  }, [adminApi]);

  async function togglePlacement(placement: PageBannerAdminPlacement) {
    if (savingPlacement) return;
    setSavingPlacement(placement.id);
    setError("");
    setMessage("");
    try {
      const updated = await adminApi.pageBanners.setEnabled(placement.id, !placement.enabled);
      setPlacements((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage(
        `${placementLabels[placement.id] ?? placement.id} placement ${updated.enabled ? "enabled" : "disabled"}.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to change PageBanner placement state",
      );
    } finally {
      setSavingPlacement(null);
    }
  }

  function editSlide(slide: PageBannerAdminSlide) {
    setEditor(editorFromSlide(slide));
    setMessage("");
    setError("");
  }

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const metadata = metadataFromEditor(editor);
    if (!metadata.isDecorative && !metadata.altText) {
      setError("Informational banners require alt text.");
      return;
    }
    if (!editor.slideId && !editor.file) {
      setError("Choose an image before adding a slide.");
      return;
    }
    if (editor.file && editor.file.size > 5 * 1024 * 1024) {
      setError("PageBanner images must be 5 MiB or smaller.");
      return;
    }
    setSavingPlacement(editor.placementId);
    setError("");
    setMessage("");
    try {
      if (editor.file) {
        await adminApi.pageBanners.upload(
          editor.placementId,
          editor.file,
          metadata,
          editor.slideId ?? undefined,
        );
        if (
          !editor.slideId &&
          editor.enabled &&
          placements.find((placement) => placement.id === editor.placementId)?.enabled === false
        ) {
          await adminApi.pageBanners.setEnabled(editor.placementId, true);
        }
      } else if (editor.slideId) {
        await adminApi.pageBanners.updateSlide(editor.placementId, editor.slideId, metadata);
      }
      await load();
      setEditor(null);
      setMessage(editor.slideId ? "PageBanner slide updated." : "PageBanner slide added.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save PageBanner slide");
    } finally {
      setSavingPlacement(null);
    }
  }

  async function reorder(placement: PageBannerAdminPlacement, index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= placement.slides.length) return;
    const slideIds = placement.slides.map((slide) => slide.id);
    [slideIds[index], slideIds[nextIndex]] = [slideIds[nextIndex]!, slideIds[index]!];
    setSavingPlacement(placement.id);
    setError("");
    try {
      const slides = await adminApi.pageBanners.reorder(placement.id, slideIds);
      setPlacements((current) =>
        current.map((item) => (item.id === placement.id ? { ...item, slides } : item)),
      );
      setMessage("PageBanner order updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reorder PageBanner slides");
    } finally {
      setSavingPlacement(null);
    }
  }

  async function toggleSlide(slide: PageBannerAdminSlide) {
    setSavingPlacement(slide.placementId);
    setError("");
    try {
      await adminApi.pageBanners.updateSlide(slide.placementId, slide.id, {
        enabled: !slide.enabled,
        isDecorative: slide.isDecorative,
        altText: slide.altText,
        destination:
          slide.destinationUrl && slide.destinationKind
            ? { kind: slide.destinationKind, url: slide.destinationUrl }
            : null,
      });
      await load();
      setMessage(`Slide ${slide.enabled ? "disabled" : "enabled"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to change slide state");
    } finally {
      setSavingPlacement(null);
    }
  }

  async function deleteSlide(slide: PageBannerAdminSlide) {
    if (
      !window.confirm(
        "Remove this PageBanner slide? Stored media cleanup remains managed by the backend.",
      )
    )
      return;
    setSavingPlacement(slide.placementId);
    setError("");
    try {
      await adminApi.pageBanners.deleteSlide(slide.placementId, slide.id);
      await load();
      if (editor?.slideId === slide.id) setEditor(null);
      setMessage("PageBanner slide removed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove PageBanner slide");
    } finally {
      setSavingPlacement(null);
    }
  }

  return (
    <section className="admin-panel page-banner-manager" id="page-banners">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MEDIA CONTROL</p>
          <h2>PageBanner placements</h2>
        </div>
        <span>{placements.length || "—"}</span>
      </div>
      <p className="muted">
        Manage optional top-of-page banners. Turning a placement off preserves its stored slides.
      </p>
      {message ? <p className="page-banner-feedback page-banner-success">{message}</p> : null}
      {error ? <p className="page-banner-feedback page-banner-error">{error}</p> : null}
      {loadState === "loading" ? <p className="muted">Loading PageBanner placements…</p> : null}
      {loadState === "error" ? (
        <button className="admin-ghost-action" type="button" onClick={() => void load()}>
          Retry
        </button>
      ) : null}
      {loadState === "ready" ? (
        <div className="page-banner-placement-list">
          {placements.map((placement) => (
            <article className="page-banner-placement" key={placement.id}>
              <div className="page-banner-placement-heading">
                <div>
                  <p className="eyebrow">{placement.id}</p>
                  <h3>{placementLabels[placement.id] ?? placement.id} top banner</h3>
                  <p className="muted">{placement.slides.length}/3 stored slides</p>
                </div>
                <button
                  className={placement.enabled ? "admin-primary-action" : "admin-ghost-action"}
                  type="button"
                  disabled={savingPlacement === placement.id}
                  onClick={() => void togglePlacement(placement)}
                >
                  {placement.enabled ? "On" : "Off"}
                </button>
              </div>
              <div className="page-banner-slide-list">
                {placement.slides.length ? (
                  placement.slides.map((slide, index) => (
                    <div className="page-banner-slide" key={slide.id}>
                      <div>
                        <strong>Slide {index + 1}</strong>
                        <span>{slideSummary(slide)}</span>
                        {slide.destinationUrl ? (
                          <small>
                            {slide.destinationKind}: {slide.destinationUrl}
                          </small>
                        ) : null}
                      </div>
                      <div className="page-banner-slide-actions">
                        <button
                          className="admin-ghost-action"
                          type="button"
                          onClick={() => void reorder(placement, index, -1)}
                          disabled={index === 0 || savingPlacement === placement.id}
                          aria-label={`Move slide ${index + 1} up`}
                        >
                          ↑
                        </button>
                        <button
                          className="admin-ghost-action"
                          type="button"
                          onClick={() => void reorder(placement, index, 1)}
                          disabled={
                            index === placement.slides.length - 1 ||
                            savingPlacement === placement.id
                          }
                          aria-label={`Move slide ${index + 1} down`}
                        >
                          ↓
                        </button>
                        <button
                          className="admin-ghost-action"
                          type="button"
                          onClick={() => editSlide(slide)}
                        >
                          Edit
                        </button>
                        <button
                          className="admin-ghost-action"
                          type="button"
                          onClick={() => void toggleSlide(slide)}
                          disabled={savingPlacement === placement.id}
                        >
                          {slide.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          className="admin-danger-action"
                          type="button"
                          onClick={() => void deleteSlide(slide)}
                          disabled={savingPlacement === placement.id}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="admin-empty-state">
                    No stored slides. Add the first banner when artwork is ready.
                  </p>
                )}
              </div>
              {placement.slides.length < 3 ? (
                <button
                  className="admin-primary-action"
                  type="button"
                  onClick={() => setEditor(newEditor(placement.id))}
                >
                  Add slide
                </button>
              ) : null}
              {editor?.placementId === placement.id ? (
                <form className="page-banner-editor" onSubmit={(event) => void submitEditor(event)}>
                  <div className="page-banner-editor-heading">
                    <h4>{editor.slideId ? "Edit PageBanner slide" : "Add PageBanner slide"}</h4>
                    <button
                      className="admin-ghost-action"
                      type="button"
                      onClick={() => setEditor(null)}
                    >
                      Cancel
                    </button>
                  </div>
                  <label>
                    Artwork
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) =>
                        setEditor({ ...editor, file: event.target.files?.[0] ?? null })
                      }
                    />
                  </label>
                  <label className="page-banner-check">
                    <input
                      type="checkbox"
                      checked={editor.enabled}
                      onChange={(event) => setEditor({ ...editor, enabled: event.target.checked })}
                    />{" "}
                    Slide enabled
                  </label>
                  <label className="page-banner-check">
                    <input
                      type="checkbox"
                      checked={editor.isDecorative}
                      onChange={(event) =>
                        setEditor({
                          ...editor,
                          isDecorative: event.target.checked,
                          altText: event.target.checked ? "" : editor.altText,
                        })
                      }
                    />{" "}
                    Decorative artwork
                  </label>
                  <label>
                    Alt text{!editor.isDecorative ? " (required)" : " (optional)"}
                    <input
                      value={editor.altText}
                      disabled={editor.isDecorative}
                      onChange={(event) => setEditor({ ...editor, altText: event.target.value })}
                    />
                  </label>
                  <label>
                    Destination URL (leave blank for non-clickable)
                    <input
                      value={editor.destinationUrl}
                      placeholder="/places/... or https://example.com/..."
                      onChange={(event) =>
                        setEditor({ ...editor, destinationUrl: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Destination type
                    <select
                      value={editor.destinationKind}
                      onChange={(event) =>
                        setEditor({
                          ...editor,
                          destinationKind: event.target.value as EditorState["destinationKind"],
                        })
                      }
                    >
                      <option value="INTERNAL">Internal HOOMA</option>
                      <option value="EXTERNAL">External HTTP(S)</option>
                    </select>
                  </label>
                  <button
                    className="admin-primary-action"
                    type="submit"
                    disabled={savingPlacement === placement.id}
                  >
                    {editor.slideId
                      ? editor.file
                        ? "Replace artwork"
                        : "Save slide"
                      : "Add slide"}
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
