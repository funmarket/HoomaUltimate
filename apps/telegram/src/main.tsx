import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { MeResponse } from "@hooma/contracts";
import { FoundationShell } from "@hooma/ui";
import { telegramMe } from "./api/client";
import { initializeTelegramRuntime } from "./telegram/runtime";
import { HomePage } from "./home/HomePage";
import { ProfilePage } from "./profile/ProfilePage";
import "./styles.css";
const telegram = initializeTelegramRuntime();
function TelegramApp() { const [me, setMe] = useState<MeResponse | null>(null); const [error, setError] = useState(""); useEffect(() => { if (!telegram.initData) return; void telegramMe(telegram.initData).then(setMe).catch((reason: Error) => setError(reason.message)); }, []); const content = window.location.pathname === "/profile" ? <ProfilePage me={me} /> : <HomePage />; return <FoundationShell surface="Telegram">{error ? <p className="status">{error}</p> : null}{content}</FoundationShell>; }
createRoot(document.getElementById("root")!).render(<StrictMode><TelegramApp /></StrictMode>);
