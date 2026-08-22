import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WebRouter } from "./app/router/WebRouter";
import { initializeWebAppearance } from "./settings/theme";
import "./styles.css";

initializeWebAppearance();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WebRouter />
  </StrictMode>
);
