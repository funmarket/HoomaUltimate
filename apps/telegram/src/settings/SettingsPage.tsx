import { useState } from "react";
import { AppearanceSettings, type AppearanceMode } from "@hooma/ui";
import type { TelegramRuntime } from "../telegram/runtime";
import { getTelegramAppearanceMode, saveTelegramAppearanceMode } from "./theme";

const TELEGRAM_CHOICES = [
  { value: "telegram", label: "Telegram theme", description: "Follow the current Telegram light or dark appearance." },
  { value: "dark", label: "Pitch black / gold", description: "Always use HOOMA's primary dark football presentation." },
  { value: "light", label: "Light", description: "Always use a bright high-contrast HOOMA presentation." }
] as const satisfies readonly { value: AppearanceMode; label: string; description: string }[];

export function SettingsPage({ runtime }: { readonly runtime: TelegramRuntime }) {
  const [mode, setMode] = useState<AppearanceMode>(() => getTelegramAppearanceMode());

  function updateMode(nextMode: AppearanceMode) {
    setMode(nextMode);
    saveTelegramAppearanceMode(nextMode, runtime.colorScheme);
  }

  return <AppearanceSettings mode={mode} choices={TELEGRAM_CHOICES} onChange={updateMode} />;
}
