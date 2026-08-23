import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HoomaRouter } from "./app/router/HoomaRouter";
import { initializeWebAppearance } from "./settings/theme";
import "@hooma/ui/bottom-nav.css";
import "@hooma/frontend/communities.css";
import "@hooma/frontend/teams.css";
import "@hooma/frontend/play.css";
import "./styles.css";
import "./account/account.css";
import "./profile/profile.css";

initializeWebAppearance();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HoomaRouter />
  </StrictMode>
);
