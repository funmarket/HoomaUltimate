import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { MeResponse } from "@hooma/contracts";
import { FoundationShell } from "@hooma/ui";
import { telegramMe } from "./api/client";
import { initializeTelegramRuntime } from "./telegram/runtime";
import "./styles.css";

const telegram = initializeTelegramRuntime();

function TelegramApp() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!telegram.initData) return;
    void telegramMe(telegram.initData).then(setMe).catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <FoundationShell surface="Telegram">
      {me ? (
        <p className="status">Signed in as {me.presentation.displayName} · @{me.presentation.username}</p>
      ) : (
        <p className="status">
          {telegram.initData ? "Authenticating Telegram identity…" : "Open this surface as a Telegram Mini App."}
        </p>
      )}
      {error ? <p className="status">{error}</p> : null}
    </FoundationShell>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TelegramApp />
  </StrictMode>
);
