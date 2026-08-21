import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FoundationShell } from "@hooma/ui";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FoundationShell surface="Web">
      <p className="status">Phase 0 foundation is running.</p>
    </FoundationShell>
  </StrictMode>
);
