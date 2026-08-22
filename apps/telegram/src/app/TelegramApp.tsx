import { useEffect, useState } from "react";
import type { MeResponse } from "@hooma/contracts";
import { telegramManagedTeams, telegramMe, type TelegramManagedTeam } from "../api/client";
import { initializeTelegramRuntime } from "../telegram/runtime";
import { applyTelegramAppearanceMode, getTelegramAppearanceMode } from "../settings/theme";
import { TelegramRouter } from "./router/TelegramRouter";

const runtime = initializeTelegramRuntime();
applyTelegramAppearanceMode(getTelegramAppearanceMode(), runtime.colorScheme);

export function TelegramApp() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [managedTeams, setManagedTeams] = useState<TelegramManagedTeam[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!runtime.initData) return;
    void Promise.all([telegramMe(runtime.initData), telegramManagedTeams(runtime.initData)])
      .then(([currentUser, teams]) => {
        setMe(currentUser);
        setManagedTeams(teams);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return <TelegramRouter runtime={runtime} me={me} managedTeams={managedTeams} error={error} />;
}
