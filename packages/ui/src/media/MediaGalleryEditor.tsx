import { useId, type ChangeEvent, type ReactNode } from "react";
import { MediaEditorStyles } from "./MediaEditorStyles.js";

export interface MediaGalleryItem {
  readonly id: string;
  readonly src: string;
  readonly alt: string;
}

export type MediaReorderDirection = "up" | "down";

export interface MediaGalleryEditorProps {
  readonly label: string;
  readonly helpText?: ReactNode;
  readonly items: readonly MediaGalleryItem[];
  readonly maxItems: number;
  readonly canAdd?: boolean;
  readonly canReplace?: boolean;
  readonly canDelete?: boolean;
  readonly canReorder?: boolean;
  readonly allowExternalUrl?: boolean;
  readonly accept?: string;
  readonly acceptHint?: ReactNode;
  readonly addFileLabel?: string;
  readonly replaceLabel?: string;
  readonly deleteLabel?: string;
  readonly externalUrlLabel?: string;
  readonly externalUrlValue?: string;
  readonly externalUrlPlaceholder?: string;
  readonly addExternalUrlLabel?: string;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly message?: ReactNode;
  readonly error?: ReactNode;
  readonly onAddFile?: (file: File | null) => void;
  readonly onReplaceFile?: (itemId: string, file: File | null) => void;
  readonly onDelete?: (itemId: string) => void;
  readonly onReorder?: (itemId: string, direction: MediaReorderDirection) => void;
  readonly onExternalUrlChange?: (value: string) => void;
  readonly onAddExternalUrl?: (url: string) => void;
}

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp";

export function MediaGalleryEditor({
  label,
  helpText,
  items,
  maxItems,
  canAdd = true,
  canReplace = true,
  canDelete = true,
  canReorder = true,
  allowExternalUrl = false,
  accept = DEFAULT_ACCEPT,
  acceptHint = "Accepted: JPEG, PNG or WebP.",
  addFileLabel = "Add photo",
  replaceLabel = "Replace photo",
  deleteLabel = "Delete photo",
  externalUrlLabel = "Image URL",
  externalUrlValue = "",
  externalUrlPlaceholder = "https://…",
  addExternalUrlLabel = "Add image URL",
  disabled = false,
  busy = false,
  message,
  error,
  onAddFile,
  onReplaceFile,
  onDelete,
  onReorder,
  onExternalUrlChange,
  onAddExternalUrl,
}: MediaGalleryEditorProps) {
  const addInputId = useId();
  const urlInputId = useId();
  const blocked = disabled || busy;
  const atMax = items.length >= maxItems;
  const addDisabled = blocked || !canAdd || atMax;
  const externalUrl = externalUrlValue.trim();

  return (
    <section className="hooma-media-gallery" aria-busy={busy || undefined}>
      <MediaEditorStyles />
      <header className="hooma-media-gallery__heading">
        <div className="hooma-media-gallery__copy">
          <h3 className="hooma-media-gallery__title">{label}</h3>
          {helpText ? <p className="hooma-media-gallery__help">{helpText}</p> : null}
        </div>
        <span className="hooma-media-gallery__count" aria-label={`${items.length} of ${maxItems}`}>
          {items.length} / {maxItems}
        </span>
      </header>

      {items.length ? (
        <ol className="hooma-media-gallery__list">
          {items.map((item, index) => {
            const replaceInputId = `${addInputId}-${index}-replace`;
            const itemNumber = index + 1;
            return (
              <li className="hooma-media-gallery__item" key={item.id}>
                <div className="hooma-media-gallery__item-heading">
                  <strong>Photo {itemNumber}</strong>
                  <span className="hooma-media-gallery__item-position">
                    {itemNumber} / {items.length}
                  </span>
                </div>

                <figure className="hooma-media-gallery__preview">
                  <img src={item.src} alt={item.alt} />
                </figure>

                {canReplace ? (
                  <div className="hooma-media-gallery__replace-control">
                    <label className="hooma-media-gallery__control-label" htmlFor={replaceInputId}>
                      {replaceLabel} {itemNumber}
                    </label>
                    <input
                      id={replaceInputId}
                      type="file"
                      accept={accept}
                      disabled={blocked}
                      aria-describedby={`${replaceInputId}-hint`}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        onReplaceFile?.(item.id, event.currentTarget.files?.[0] ?? null)
                      }
                    />
                    <small className="hooma-media-field__hint" id={`${replaceInputId}-hint`}>
                      {acceptHint}
                    </small>
                  </div>
                ) : null}

                <div className="hooma-media-gallery__actions">
                  {canReorder && onReorder ? (
                    <div
                      className="hooma-media-gallery__reorder"
                      aria-label={`Reorder ${item.alt}`}
                    >
                      <button
                        className="hooma-media-button"
                        type="button"
                        disabled={blocked || index === 0}
                        aria-label={`Move ${item.alt} up`}
                        onClick={() => onReorder(item.id, "up")}
                      >
                        Move up
                      </button>
                      <button
                        className="hooma-media-button"
                        type="button"
                        disabled={blocked || index === items.length - 1}
                        aria-label={`Move ${item.alt} down`}
                        onClick={() => onReorder(item.id, "down")}
                      >
                        Move down
                      </button>
                    </div>
                  ) : null}

                  {canDelete && onDelete ? (
                    <button
                      className="hooma-media-button hooma-media-button--danger"
                      type="button"
                      disabled={blocked}
                      aria-label={`${deleteLabel}: ${item.alt}`}
                      onClick={() => onDelete(item.id)}
                    >
                      {deleteLabel}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="hooma-media-gallery__add">
        <div className="hooma-media-gallery__add-control">
          <label className="hooma-media-gallery__control-label" htmlFor={addInputId}>
            {addFileLabel}
          </label>
          <input
            id={addInputId}
            type="file"
            accept={accept}
            disabled={addDisabled}
            aria-describedby={`${addInputId}-hint`}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onAddFile?.(event.currentTarget.files?.[0] ?? null)
            }
          />
          <small className="hooma-media-field__hint" id={`${addInputId}-hint`}>
            {acceptHint}
          </small>
        </div>

        {allowExternalUrl ? (
          <>
            <div className="hooma-media-gallery__or" aria-hidden="true">
              OR
            </div>
            <div className="hooma-media-gallery__external-row">
              <div className="hooma-media-gallery__add-control">
                <label className="hooma-media-gallery__control-label" htmlFor={urlInputId}>
                  {externalUrlLabel}
                </label>
                <input
                  id={urlInputId}
                  type="url"
                  value={externalUrlValue}
                  placeholder={externalUrlPlaceholder}
                  disabled={addDisabled}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    onExternalUrlChange?.(event.currentTarget.value)
                  }
                />
              </div>
              <button
                className="hooma-media-button"
                type="button"
                disabled={addDisabled || !externalUrl}
                onClick={() => onAddExternalUrl?.(externalUrl)}
              >
                {addExternalUrlLabel}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {message ? (
        <p className="hooma-media-gallery__message" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="hooma-media-gallery__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
