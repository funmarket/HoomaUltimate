export function MediaEditorStyles() {
  return <style>{MEDIA_EDITOR_STYLES}</style>;
}

const MEDIA_EDITOR_STYLES = `
.hooma-media-field,
.hooma-media-gallery {
  display: grid;
  gap: 14px;
  color: #f7f7f7;
  font-family: var(--font-ui, "Source Sans 3", system-ui, sans-serif);
  font-size: 16px;
  line-height: 1.45;
}

.hooma-media-field {
  padding: 16px;
  background: #0b0c0a;
  border: 1px solid rgba(190, 180, 145, 0.22);
  border-radius: 18px;
}

.hooma-media-field[aria-busy="true"],
.hooma-media-gallery[aria-busy="true"] {
  cursor: progress;
}

.hooma-media-field__heading,
.hooma-media-gallery__heading,
.hooma-media-gallery__item-heading,
.hooma-media-gallery__actions,
.hooma-media-gallery__reorder {
  display: flex;
  align-items: center;
}

.hooma-media-field__heading,
.hooma-media-gallery__heading,
.hooma-media-gallery__item-heading {
  justify-content: space-between;
  gap: 12px;
}

.hooma-media-field__copy,
.hooma-media-gallery__copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.hooma-media-field__label,
.hooma-media-gallery__title,
.hooma-media-gallery__item-heading strong {
  margin: 0;
  color: #f7f7f7;
  font-size: 17px;
  font-weight: 700;
}

.hooma-media-field__help,
.hooma-media-field__hint,
.hooma-media-gallery__help,
.hooma-media-gallery__count,
.hooma-media-gallery__item-position {
  margin: 0;
  color: #b8b5ad;
  font-size: 14px;
}

.hooma-media-field__preview,
.hooma-media-gallery__preview {
  overflow: hidden;
  margin: 0;
  background: #050605;
  border: 1px solid rgba(190, 180, 145, 0.22);
  border-radius: 14px;
}

.hooma-media-field__preview img,
.hooma-media-gallery__preview img {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: cover;
}

.hooma-media-field__control,
.hooma-media-gallery__add-control,
.hooma-media-gallery__replace-control {
  display: grid;
  gap: 8px;
}

.hooma-media-field__control-label,
.hooma-media-gallery__control-label {
  color: #f7f7f7;
  font-size: 16px;
  font-weight: 650;
}

.hooma-media-field input[type="file"],
.hooma-media-gallery input[type="file"],
.hooma-media-field input[type="url"],
.hooma-media-gallery input[type="url"] {
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  padding: 11px 12px;
  color: #f7f7f7;
  font: inherit;
  background: #0e0f0d;
  border: 1px solid rgba(190, 180, 145, 0.22);
  border-radius: 14px;
}

.hooma-media-field input::file-selector-button,
.hooma-media-gallery input::file-selector-button {
  min-height: 36px;
  margin-right: 10px;
  padding: 7px 12px;
  color: #f7f7f7;
  font: inherit;
  font-weight: 650;
  background: #050605;
  border: 1px solid rgba(169, 176, 180, 0.42);
  border-radius: 10px;
  cursor: pointer;
}

.hooma-media-field input:focus-visible,
.hooma-media-gallery input:focus-visible,
.hooma-media-button:focus-visible {
  outline: 2px solid #a9b0b4;
  outline-offset: 2px;
}

.hooma-media-field input:disabled,
.hooma-media-gallery input:disabled,
.hooma-media-button:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.hooma-media-field__or,
.hooma-media-gallery__or {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #858780;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.hooma-media-field__or::before,
.hooma-media-field__or::after,
.hooma-media-gallery__or::before,
.hooma-media-gallery__or::after {
  content: "";
  flex: 1;
  height: 1px;
  background: rgba(190, 180, 145, 0.18);
}

.hooma-media-button {
  min-height: 48px;
  padding: 10px 14px;
  color: #f7f7f7;
  font: inherit;
  font-weight: 700;
  background: #0e0f0d;
  border: 1px solid rgba(190, 180, 145, 0.22);
  border-radius: 14px;
  cursor: pointer;
}

.hooma-media-button:hover:not(:disabled) {
  border-color: rgba(169, 176, 180, 0.55);
}

.hooma-media-button--danger {
  color: #f7f7f7;
  border-color: rgba(216, 122, 122, 0.42);
}

.hooma-media-field__actions,
.hooma-media-gallery__actions,
.hooma-media-gallery__reorder {
  gap: 10px;
  flex-wrap: wrap;
}

.hooma-media-field__message,
.hooma-media-field__error,
.hooma-media-gallery__message,
.hooma-media-gallery__error {
  margin: 0;
  font-size: 14px;
}

.hooma-media-field__message,
.hooma-media-gallery__message {
  color: #d8d4ca;
}

.hooma-media-field__error,
.hooma-media-gallery__error {
  color: #f3b7b7;
}

.hooma-media-gallery__count {
  flex: 0 0 auto;
  padding: 5px 9px;
  background: #0e0f0d;
  border: 1px solid rgba(190, 180, 145, 0.22);
  border-radius: 999px;
}

.hooma-media-gallery__list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hooma-media-gallery__item {
  display: grid;
  gap: 12px;
  padding: 14px;
  background: #0b0c0a;
  border: 1px solid rgba(190, 180, 145, 0.22);
  border-radius: 18px;
}

.hooma-media-gallery__add {
  display: grid;
  gap: 12px;
  padding: 14px;
  background: #0b0c0a;
  border: 1px solid rgba(190, 180, 145, 0.22);
  border-radius: 18px;
}

.hooma-media-gallery__external-row {
  display: grid;
  gap: 10px;
}

@media (min-width: 560px) {
  .hooma-media-gallery__external-row {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
  }
}
`;
