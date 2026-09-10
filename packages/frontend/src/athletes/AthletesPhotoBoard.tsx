import {
  ATHLETES_PHOTO_CONTENT_TYPES,
  ATHLETES_PHOTO_MAX_BYTES,
  type AthletesPhotoContentType,
  type AthletesPhotoMetadata,
  type AthletesPublicDetail,
  type AthletesRole,
} from "@hooma/contracts/athletes";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useHoomaFrontend } from "../context";

type AthletesPhotoBoardProps = {
  readonly athletesCommunityId: string;
  readonly communityStatus: AthletesPublicDetail["status"];
  readonly viewerRole: AthletesRole | null | undefined;
};

function isAthletesPhotoContentType(value: string): value is AthletesPhotoContentType {
  return ATHLETES_PHOTO_CONTENT_TYPES.includes(value as AthletesPhotoContentType);
}

export function validateAthletesPhotoUpload(file: Pick<File, "size" | "type">): string | null {
  if (!isAthletesPhotoContentType(file.type)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }
  if (file.size <= 0) {
    return "Choose a non-empty image.";
  }
  if (file.size > ATHLETES_PHOTO_MAX_BYTES) {
    return "Photo must be 5 MiB or smaller.";
  }
  return null;
}

export function AthletesPhotoBoard({
  athletesCommunityId,
  communityStatus,
  viewerRole,
}: AthletesPhotoBoardProps) {
  const { api, protectedError } = useHoomaFrontend();
  const [photos, setPhotos] = useState<AthletesPhotoMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [serverError, setServerError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const loadVersionRef = useRef(0);

  const isActiveMember =
    communityStatus === "ACTIVE" && viewerRole !== null && viewerRole !== undefined;
  const canCurate = communityStatus === "ACTIVE" && viewerRole === "FOUNDER";

  const loadPhotos = useCallback(
    async (cursor?: string) => {
      const loadVersion = ++loadVersionRef.current;
      setLoading(true);
      setServerError("");
      try {
        const metadata = await api.athletes.listPhotos(athletesCommunityId, cursor);
        if (loadVersion !== loadVersionRef.current) return;
        setPhotos((previous) =>
          cursor
            ? [
                ...previous,
                ...metadata.filter((photo) => !previous.some((item) => item.id === photo.id)),
              ]
            : metadata,
        );
        setNextCursor(metadata.length === 24 ? (metadata.at(-1)?.id ?? null) : null);
      } catch (reason) {
        if (loadVersion === loadVersionRef.current)
          setServerError(protectedError(reason, "Unable to load Photo Board"));
      } finally {
        if (loadVersion === loadVersionRef.current) setLoading(false);
      }
    },
    [api, athletesCommunityId, protectedError],
  );

  useEffect(() => {
    setPhotos([]);
    setNextCursor(null);
    if (isActiveMember) void loadPhotos();
    else setLoading(false);
    return () => {
      loadVersionRef.current += 1;
    };
  }, [isActiveMember, loadPhotos]);

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !canCurate || uploading) return;

    const validationMessage = validateAthletesPhotoUpload(file);
    if (validationMessage) {
      setValidationError(validationMessage);
      return;
    }

    const contentType = file.type as AthletesPhotoContentType;
    setUploading(true);
    setValidationError("");
    setServerError("");
    try {
      await api.athletes.uploadPhoto(athletesCommunityId, file, contentType);
      await loadPhotos();
    } catch (reason) {
      setServerError(protectedError(reason, "Unable to upload photo"));
    } finally {
      setUploading(false);
    }
  }

  if (!isActiveMember) return null;

  const headingId = `athletes-photo-board-${athletesCommunityId}`;

  return (
    <section
      className="athletes-surface athletes-section athletes-photo-board"
      aria-labelledby={headingId}
    >
      <div className="athletes-section-heading athletes-photo-board__heading">
        <div>
          <span className="eyebrow">ATHLETES · MEMBERS ONLY</span>
          <h2 id={headingId}>Photo Board</h2>
          <p>Founder-curated photos for this Athletes community.</p>
        </div>
        <span className="athletes-section-count" aria-label={`${photos.length} photos`}>
          {photos.length}
        </span>
      </div>

      {canCurate ? (
        <label className="athletes-photo-board__upload athletes-action athletes-action--secondary">
          <input
            type="file"
            accept={ATHLETES_PHOTO_CONTENT_TYPES.join(",")}
            disabled={uploading || loading}
            onChange={(event) => void uploadPhoto(event)}
          />
          <span className="athletes-action__icon" aria-hidden="true">
            +
          </span>
          <span>{uploading ? "Uploading…" : "Add photo"}</span>
        </label>
      ) : null}

      {uploading ? (
        <div className="athletes-photo-board__state" role="status" aria-live="polite">
          Uploading photo…
        </div>
      ) : null}
      {validationError ? <div className="error-box">{validationError}</div> : null}
      {serverError ? (
        <div className="error-box" role="alert">
          {serverError}{" "}
          <button disabled={loading} onClick={() => void loadPhotos(nextCursor ?? undefined)}>
            Retry Photo Board
          </button>
        </div>
      ) : null}
      {loading ? (
        <div className="athletes-photo-board__state" role="status">
          Loading Photo Board…
        </div>
      ) : null}
      {!loading && !serverError && photos.length === 0 ? (
        <div className="athletes-photo-board__empty">
          <strong>No photos yet.</strong>
          <span>The Founder can add the first image for active members.</span>
        </div>
      ) : null}

      {photos.length ? (
        <div className="athletes-photo-board__grid">
          {photos.map((photo, index) => (
            <AthletesPhoto
              key={photo.id}
              athletesCommunityId={athletesCommunityId}
              photo={photo}
              index={index}
              canDelete={canCurate}
              onDeleted={(photoId) =>
                setPhotos((current) => current.filter((item) => item.id !== photoId))
              }
            />
          ))}
        </div>
      ) : null}
      {nextCursor ? (
        <button
          className="button athletes-action athletes-action--secondary"
          disabled={loading || uploading}
          onClick={() => void loadPhotos(nextCursor)}
        >
          {loading ? "Loading…" : "Load more photos"}
        </button>
      ) : null}
    </section>
  );
}

function AthletesPhoto({
  athletesCommunityId,
  photo,
  index,
  canDelete,
  onDeleted,
}: {
  readonly athletesCommunityId: string;
  readonly photo: AthletesPhotoMetadata;
  readonly index: number;
  readonly canDelete: boolean;
  readonly onDeleted: (photoId: string) => void;
}) {
  const { api, protectedError } = useHoomaFrontend();
  const element = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === "undefined");
  const [objectUrl, setObjectUrl] = useState("");
  const [loadError, setLoadError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !element.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { rootMargin: "300px" },
    );
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let url = "";
    setObjectUrl("");
    setLoadError("");
    if (visible)
      void api.athletes
        .fetchPhotoContent(athletesCommunityId, photo.id, controller.signal)
        .then((blob) => {
          if (!active) return;
          url = URL.createObjectURL(blob);
          setObjectUrl(url);
        })
        .catch((reason) => {
          if (active) setLoadError(protectedError(reason, "Unable to load photo"));
        });
    return () => {
      active = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [api, athletesCommunityId, photo.id, visible, attempt, protectedError]);

  async function deletePhoto() {
    if (!canDelete || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.athletes.deletePhoto(athletesCommunityId, photo.id);
      onDeleted(photo.id);
    } catch (reason) {
      setDeleteError(protectedError(reason, "Unable to delete photo"));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <figure ref={element} className="athletes-photo-board__photo">
      {objectUrl ? (
        <img
          src={objectUrl}
          alt={`Photo ${index + 1} from Athletes Photo Board`}
          loading="lazy"
          onError={() => setLoadError("This photo could not be displayed.")}
        />
      ) : null}

      {canDelete ? (
        <button
          type="button"
          className="athletes-photo-board__delete"
          aria-label={`Delete photo ${index + 1}`}
          aria-expanded={confirmDelete}
          disabled={deleting}
          onClick={() => {
            setDeleteError("");
            setConfirmDelete((current) => !current);
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}

      {confirmDelete && canDelete ? (
        <div
          className="athletes-photo-board__delete-confirm"
          role="group"
          aria-label="Confirm photo deletion"
        >
          <strong>Delete this photo?</strong>
          <span>This removes it from the Photo Board.</span>
          <div>
            <button type="button" disabled={deleting} onClick={() => void deletePhoto()}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
          </div>
        </div>
      ) : null}

      {deleteError ? (
        <div className="athletes-photo-board__delete-error" role="alert">
          <span>{deleteError}</span>
          <button type="button" onClick={() => setDeleteError("")}>
            Dismiss
          </button>
        </div>
      ) : null}

      {loadError ? (
        <div className="athletes-photo-board__photo-error" role="alert">
          {loadError}
          <button onClick={() => setAttempt((value) => value + 1)}>Retry photo {index + 1}</button>
        </div>
      ) : !objectUrl ? (
        <span className="athletes-photo-board__photo-loading" role="status">
          Loading photo {index + 1}…
        </span>
      ) : null}
    </figure>
  );
}
