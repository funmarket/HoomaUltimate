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

type DisplayPhoto = {
  readonly metadata: AthletesPhotoMetadata;
  readonly objectUrl: string;
};

function isAthletesPhotoContentType(value: string): value is AthletesPhotoContentType {
  return ATHLETES_PHOTO_CONTENT_TYPES.includes(value as AthletesPhotoContentType);
}

export function validateAthletesPhotoUpload(
  file: Pick<File, "size" | "type">,
): string | null {
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
  const [photos, setPhotos] = useState<DisplayPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [serverError, setServerError] = useState("");
  const photoUrlsRef = useRef<string[]>([]);
  const loadVersionRef = useRef(0);

  const isActiveMember =
    communityStatus === "ACTIVE" && viewerRole !== null && viewerRole !== undefined;
  const canUpload = communityStatus === "ACTIVE" && viewerRole === "FOUNDER";

  const replacePhotos = useCallback((next: DisplayPhoto[]) => {
    for (const objectUrl of photoUrlsRef.current) URL.revokeObjectURL(objectUrl);
    photoUrlsRef.current = next.map((photo) => photo.objectUrl);
    setPhotos(next);
  }, []);

  const loadPhotos = useCallback(async () => {
    const loadVersion = ++loadVersionRef.current;
    const next: DisplayPhoto[] = [];
    setLoading(true);
    setServerError("");

    try {
      const metadata = await api.athletes.listPhotos(athletesCommunityId);
      for (const photo of metadata) {
        const blob = await api.athletes.fetchPhotoContent(athletesCommunityId, photo.id);
        next.push({ metadata: photo, objectUrl: URL.createObjectURL(blob) });
      }

      if (loadVersion !== loadVersionRef.current) {
        for (const photo of next) URL.revokeObjectURL(photo.objectUrl);
        return;
      }
      replacePhotos(next);
    } catch (reason) {
      for (const photo of next) URL.revokeObjectURL(photo.objectUrl);
      if (loadVersion === loadVersionRef.current) {
        setServerError(protectedError(reason, "Unable to load Photo Board"));
      }
    } finally {
      if (loadVersion === loadVersionRef.current) setLoading(false);
    }
  }, [api, athletesCommunityId, protectedError, replacePhotos]);

  useEffect(() => {
    if (!isActiveMember) {
      loadVersionRef.current += 1;
      replacePhotos([]);
      setLoading(false);
      setValidationError("");
      setServerError("");
      return;
    }
    void loadPhotos();
  }, [isActiveMember, loadPhotos, replacePhotos]);

  useEffect(
    () => () => {
      loadVersionRef.current += 1;
      for (const objectUrl of photoUrlsRef.current) URL.revokeObjectURL(objectUrl);
      photoUrlsRef.current = [];
    },
    [],
  );

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !canUpload || uploading) return;

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
    <section className="athletes-surface athletes-section athletes-photo-board" aria-labelledby={headingId}>
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

      {canUpload ? (
        <label className="athletes-photo-board__upload athletes-action athletes-action--secondary">
          <input
            type="file"
            accept={ATHLETES_PHOTO_CONTENT_TYPES.join(",")}
            disabled={uploading}
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
      {serverError ? <div className="error-box">{serverError}</div> : null}
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
            <figure className="athletes-photo-board__photo" key={photo.metadata.id}>
              <img
                src={photo.objectUrl}
                alt={`Photo ${index + 1} from Athletes Photo Board`}
                loading="lazy"
              />
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}
