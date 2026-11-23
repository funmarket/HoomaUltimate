import React, { useEffect, useState } from "react";

export type CommunityIdentitySlot = "logo" | "banner";
export type CommunityIdentitySelection = {
  readonly mode: "none" | "external" | "upload";
  readonly url: string;
  readonly file: File | null;
};

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"] as const;

export function identitySelectionFromUrl(
  value: string | null | undefined,
  slot: CommunityIdentitySlot,
): CommunityIdentitySelection {
  const source = value?.trim() ?? "";
  if (!source) return { mode: "none", url: "", file: null };
  const managed = new RegExp("^/api/public/v1/communities/[^/]+/identity/" + slot + "/content$");
  return managed.test(source)
    ? { mode: "upload", url: "", file: null }
    : { mode: "external", url: source, file: null };
}

export function validateIdentitySelection(
  selection: CommunityIdentitySelection,
  slot: CommunityIdentitySlot,
  hasCurrentManaged: boolean,
): string | null {
  const name = slot === "logo" ? "Logo" : "Banner";
  if (selection.mode === "none") return null;
  if (selection.mode === "external") {
    try {
      const value = new URL(selection.url.trim());
      if (value.protocol === "http:" || value.protocol === "https:") return null;
    } catch {
      // Invalid URL.
    }
    return name + ": enter an HTTP or HTTPS image URL.";
  }
  if (selection.url.trim()) return name + ": select a file instead of a URL.";
  if (!selection.file) {
    return hasCurrentManaged ? null : name + ": choose an image file.";
  }
  if (!ACCEPTED.some((type) => type === selection.file?.type)) {
    return name + ": choose a JPEG, PNG, or WebP image.";
  }
  if (!selection.file.size || selection.file.size > MAX_BYTES) {
    return name + ": image must be nonempty and no larger than 5 MiB.";
  }
  return null;
}

export function useCommunityIdentityPreview(
  selection: CommunityIdentitySelection,
  existingUrl: string | null,
): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (selection.mode !== "upload" || !selection.file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(selection.file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selection.mode, selection.file]);
  if (selection.mode === "none") return null;
  if (selection.mode === "external") return selection.url.trim() || null;
  if (selection.file) return objectUrl;
  return existingUrl;
}

export function CommunityIdentityInput({
  slot,
  selection,
  previewUrl,
  disabled = false,
  onChange,
}: {
  readonly slot: CommunityIdentitySlot;
  readonly selection: CommunityIdentitySelection;
  readonly previewUrl: string | null;
  readonly disabled?: boolean;
  readonly onChange: (next: CommunityIdentitySelection) => void;
}) {
  const title = slot === "logo" ? "Community logo" : "Community banner";
  return (
    <div className={slot === "banner" ? "field hooma-span-2" : "field"}>
      <label htmlFor={"community-" + slot + "-mode"}>{title} source</label>
      <select
        id={"community-" + slot + "-mode"}
        aria-label={title + " source"}
        value={selection.mode}
        disabled={disabled}
        onChange={(event) => {
          const mode = event.target.value as CommunityIdentitySelection["mode"];
          onChange({
            mode,
            url: mode === "external" ? selection.url : "",
            file: null,
          });
        }}
      >
        <option value="none">No image</option>
        <option value="external">External URL</option>
        <option value="upload">Upload image</option>
      </select>
      {selection.mode === "external" ? (
        <label className="field">
          <span>{title} URL</span>
          <input
            type="url"
            aria-label={title + " URL"}
            value={selection.url}
            disabled={disabled}
            maxLength={2000}
            placeholder="https://example.org/image.png"
            onChange={(event) =>
              onChange({ mode: "external", url: event.target.value, file: null })
            }
          />
        </label>
      ) : null}
      {selection.mode === "upload" ? (
        <label className="field">
          <span>{title} upload (JPEG, PNG or WebP; max 5 MiB)</span>
          <input
            type="file"
            aria-label={title + " upload"}
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={(event) =>
              onChange({ mode: "upload", url: "", file: event.target.files?.[0] ?? null })
            }
          />
        </label>
      ) : null}
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={title + " preview"}
          style={{ maxWidth: "100%", maxHeight: 140, objectFit: "contain" }}
        />
      ) : null}
    </div>
  );
}
