import { useEffect, useState } from "react";
import type { MeResponse } from "@hooma/contracts";
import { telegramMe } from "../api/client";
import { initializeTelegramRuntime } from "../telegram/runtime";
import { TelegramRouter } from "./router/TelegramRouter";

const runtime = initializeTelegramRuntime();

export function TelegramApp() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!runtime.initData) return;
    void telegramMe(runtime.initData)
      .then(setMe)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return <TelegramRouter runtime={runtime} me={me} error={error} />;
}
