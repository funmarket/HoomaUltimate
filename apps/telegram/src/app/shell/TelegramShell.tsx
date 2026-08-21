import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { PRIMARY_NAV_ITEMS } from "@hooma/ui";
import type { TelegramRuntime } from "../../telegram/runtime";
import { useTelegramBackButton } from "../../telegram/useTelegramBackButton";

export function TelegramShell({ children, runtime }: { readonly children: ReactNode; readonly runtime: TelegramRuntime }) {
  useTelegramBackButton(runtime);
  return (
    <main className="foundation-shell">
      <header>
        <p className="eyebrow">TELEGRAM</p>
        <h1>HOOMA</h1>
      </header>
      <section className="shell-content">{children}</section>
      <nav aria-label="Primary">
        {PRIMARY_NAV_ITEMS.map((item) => (
          <NavLink key={item.label} to={item.href} end={item.href === "/"}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </main>
  );
}
