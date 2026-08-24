import type { AppearanceMode } from "@hooma/ui";

const STORAGE_KEY = "hooma-web-appearance";

type WebAppearanceMode = Exclude<AppearanceMode, "telegram">;
type ResolvedWebAppearanceMode = Exclude<WebAppearanceMode, "system">;

function isWebAppearanceMode(value: string | null): value is WebAppearanceMode {
  return value === "dark" || value === "light" || value === "system" || value === "future-pitch";
}

function resolveWebAppearanceMode(mode: WebAppearanceMode): ResolvedWebAppearanceMode {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return mode;
}

export function getWebAppearanceMode(): WebAppearanceMode {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return isWebAppearanceMode(saved) ? saved : "future-pitch";
}

export function applyWebAppearanceMode(mode: WebAppearanceMode): void {
  const resolved = resolveWebAppearanceMode(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved === "light" ? "light" : "dark";
}

export function saveWebAppearanceMode(mode: AppearanceMode): void {
  if (mode === "telegram") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
  applyWebAppearanceMode(mode);
}

export function initializeWebAppearance(): void {
  const mode = getWebAppearanceMode();
  applyWebAppearanceMode(mode);
  const media = window.matchMedia("(prefers-color-scheme: light)");
  media.addEventListener("change", () => {
    if (getWebAppearanceMode() === "system") applyWebAppearanceMode("system");
  });
}
