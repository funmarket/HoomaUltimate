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

  if (!runtime.initData) {
    return (
      <main className="foundation-shell">
        <section className="status">
          <p className="eyebrow">TELEGRAM MINI APP</p>
          <h1>Open HOOMA from Telegram</h1>
          <p>
            This entry requires a verified Telegram Mini App launch so Telegram can securely provide
            your account identity.
          </p>
        </section>
      </main>
    );
  }

  return <TelegramRouter runtime={runtime} me={me} managedTeams={managedTeams} error={error} />;
}
