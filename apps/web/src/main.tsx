import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WebRouter } from "./app/router/WebRouter";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WebRouter />
  </StrictMode>
);
