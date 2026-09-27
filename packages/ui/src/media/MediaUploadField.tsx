import { useId, type ChangeEvent, type ReactNode } from "react";
import { MediaEditorStyles } from "./MediaEditorStyles.js";

export interface MediaPreview {
  readonly src: string;
  readonly alt: string;
}

export interface MediaUploadFieldProps {
  readonly label: string;
  readonly helpText?: ReactNode;
  readonly preview?: MediaPreview | null;
  readonly accept?: string;
  readonly acceptHint?: ReactNode;
  readonly uploadLabel?: string;
  readonly replaceLabel?: string;
  readonly deleteLabel?: string;
  readonly allowExternalUrl?: boolean;
  readonly externalUrlLabel?: string;
  readonly externalUrlValue?: string;
  readonly externalUrlPlaceholder?: string;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly canReplace?: boolean;
  readonly canDelete?: boolean;
  readonly message?: ReactNode;
  readonly error?: ReactNode;
  readonly onFileSelect?: (file: File | null) => void;
  readonly onReplaceFile?: (file: File | null) => void;
  readonly onExternalUrlChange?: (value: string) => void;
  readonly onDelete?: () => void;
}

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp";

export function MediaUploadField({
  label,
  helpText,
  preview = null,
  accept = DEFAULT_ACCEPT,
  acceptHint = "Accepted: JPEG, PNG or WebP.",
  uploadLabel = "Upload photo",
  replaceLabel = "Replace photo",
  deleteLabel = "Delete photo",
  allowExternalUrl = false,
  externalUrlLabel = "Image URL",
  externalUrlValue = "",
  externalUrlPlaceholder = "https://…",
  disabled = false,
  busy = false,
  canReplace = true,
  canDelete = true,
  message,
  error,
  onFileSelect,
  onReplaceFile,
  onExternalUrlChange,
  onDelete,
}: MediaUploadFieldProps) {
  const inputId = useId();
  const urlId = useId();
  const blocked = disabled || busy;
  const hasPreview = Boolean(preview);
  const fileDisabled = blocked || (hasPreview && !canReplace);
  const fileLabel = hasPreview ? replaceLabel : uploadLabel;

  function handleFile(file: File | null) {
    if (hasPreview) onReplaceFile?.(file);
    else onFileSelect?.(file);
  }

  return (
    <section className="hooma-media-field" aria-busy={busy || undefined}>
      <MediaEditorStyles />
      <div className="hooma-media-field__heading">
        <div className="hooma-media-field__copy">
          <h3 className="hooma-media-field__label">{label}</h3>
          {helpText ? <p className="hooma-media-field__help">{helpText}</p> : null}
        </div>
      </div>

      {preview ? (
        <figure className="hooma-media-field__preview">
          <img src={preview.src} alt={preview.alt} />
        </figure>
      ) : null}

      <div className="hooma-media-field__control">
        <label className="hooma-media-field__control-label" htmlFor={inputId}>
          {fileLabel}
        </label>
        <input
          id={inputId}
          type="file"
          accept={accept}
          disabled={fileDisabled}
          aria-describedby={`${inputId}-hint`}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            handleFile(event.currentTarget.files?.[0] ?? null)
          }
        />
        <small className="hooma-media-field__hint" id={`${inputId}-hint`}>
          {acceptHint}
        </small>
      </div>

      {allowExternalUrl ? (
        <>
          <div className="hooma-media-field__or" aria-hidden="true">
            OR
          </div>
          <div className="hooma-media-field__control">
            <label className="hooma-media-field__control-label" htmlFor={urlId}>
              {externalUrlLabel}
            </label>
            <input
              id={urlId}
              type="url"
              value={externalUrlValue}
              placeholder={externalUrlPlaceholder}
              disabled={blocked}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onExternalUrlChange?.(event.currentTarget.value)
              }
            />
          </div>
        </>
      ) : null}

      {preview && canDelete && onDelete ? (
        <div className="hooma-media-field__actions">
          <button
            className="hooma-media-button hooma-media-button--danger"
            type="button"
            disabled={blocked}
            aria-label={`${deleteLabel}: ${preview.alt}`}
            onClick={onDelete}
          >
            {deleteLabel}
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="hooma-media-field__message" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="hooma-media-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
