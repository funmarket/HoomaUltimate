import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { PRIMARY_NAV_ITEMS } from "@hooma/ui";

export function WebShell({ children }: { readonly children: ReactNode }) {
  return (
    <main className="foundation-shell">
      <header>
        <p className="eyebrow">WEB</p>
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
