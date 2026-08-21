import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FoundationShell } from "@hooma/ui";
import { AuthApp } from "./auth/AuthApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FoundationShell surface="Web">
      <AuthApp />
    </FoundationShell>
  </StrictMode>
);
