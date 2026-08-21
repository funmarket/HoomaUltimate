import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FoundationShell } from "@hooma/ui";
import { initializeTelegramRuntime } from "./telegram/runtime";
import "./styles.css";

initializeTelegramRuntime();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FoundationShell surface="Telegram">
      <p className="status">Telegram lifecycle foundation is active.</p>
    </FoundationShell>
  </StrictMode>
);
