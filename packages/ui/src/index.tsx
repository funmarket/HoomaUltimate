import type { ReactNode } from "react";

export const PRIMARY_NAV_ITEMS = ["Home", "Play", "Watch", "HOOMA", "Pitch"] as const;

export interface FoundationShellProps {
  readonly surface: "Web" | "Telegram";
  readonly children?: ReactNode;
}

export function FoundationShell({ surface, children }: FoundationShellProps) {
  return (
    <main className="foundation-shell">
      <header>
        <p className="eyebrow">{surface}</p>
        <h1>HOOMA ULTIMATE</h1>
        <p>Greenfield foundation. Product domains are implemented phase by phase.</p>
      </header>
      {children}
      <nav aria-label="Primary">
        {PRIMARY_NAV_ITEMS.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </nav>
    </main>
  );
}
