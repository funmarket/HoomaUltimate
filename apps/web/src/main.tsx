import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WebRouter } from "./app/router/WebRouter";
import { initializeWebAppearance } from "./settings/theme";
import "@hooma/ui/bottom-nav.css";
import "./styles.css";
import "./account/account.css";

initializeWebAppearance();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WebRouter />
  </StrictMode>
);
