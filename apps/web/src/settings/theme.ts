import type { AppearanceMode } from "@hooma/ui";

const STORAGE_KEY = "hooma-web-appearance";

export function getWebAppearanceMode(): AppearanceMode {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "dark" || saved === "light" || saved === "system") return saved;
  return "system";
}

export function applyWebAppearanceMode(mode: AppearanceMode): void {
  const resolved = mode === "system"
    ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : mode;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function saveWebAppearanceMode(mode: AppearanceMode): void {
  if (mode !== "system" && mode !== "dark" && mode !== "light") return;
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
