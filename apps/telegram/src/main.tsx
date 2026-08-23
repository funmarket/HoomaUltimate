import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TelegramApp } from "./app/TelegramApp";
import "@hooma/ui/bottom-nav.css";
import "@hooma/frontend/teams.css";
import "./styles.css";
import "./account/account.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TelegramApp />
  </StrictMode>
);
