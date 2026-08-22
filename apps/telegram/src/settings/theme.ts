import type { AppearanceMode } from "@hooma/ui";

const STORAGE_KEY = "hooma-telegram-appearance";

export function getTelegramAppearanceMode(): AppearanceMode {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "telegram" || saved === "dark" || saved === "light") return saved;
  return "telegram";
}

export function applyTelegramAppearanceMode(mode: AppearanceMode, hostScheme: "light" | "dark"): void {
  const resolved = mode === "telegram" ? hostScheme : mode === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function saveTelegramAppearanceMode(mode: AppearanceMode, hostScheme: "light" | "dark"): void {
  if (mode !== "telegram" && mode !== "dark" && mode !== "light") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
  applyTelegramAppearanceMode(mode, hostScheme);
}
