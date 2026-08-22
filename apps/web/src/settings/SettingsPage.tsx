import { useState } from "react";
import { AppearanceSettings, type AppearanceMode } from "@hooma/ui";
import { getWebAppearanceMode, saveWebAppearanceMode } from "./theme";

const WEB_CHOICES = [
  { value: "system", label: "System theme", description: "Follow your browser and operating-system appearance." },
  { value: "dark", label: "Pitch black / gold", description: "Use HOOMA's primary dark football presentation." },
  { value: "light", label: "Light", description: "Use a bright high-contrast HOOMA presentation." }
] as const satisfies readonly { value: AppearanceMode; label: string; description: string }[];

export function SettingsPage() {
  const [mode, setMode] = useState<AppearanceMode>(() => getWebAppearanceMode());

  function updateMode(nextMode: AppearanceMode) {
    setMode(nextMode);
    saveWebAppearanceMode(nextMode);
  }

  return <AppearanceSettings mode={mode} choices={WEB_CHOICES} onChange={updateMode} />;
}
