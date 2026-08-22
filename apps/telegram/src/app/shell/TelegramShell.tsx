import type { ReactNode } from "react";
import type { MeResponse } from "@hooma/contracts";
import { HoomaAccountHeader, PRIMARY_NAV_ITEMS } from "@hooma/ui";
import { NavLink, useNavigate } from "react-router-dom";
import type { TelegramManagedTeam } from "../../api/client";
import type { TelegramRuntime } from "../../telegram/runtime";
import { useTelegramBackButton } from "../../telegram/useTelegramBackButton";

export function TelegramShell({
  children,
  runtime,
  me,
  managedTeams
}: {
  readonly children: ReactNode;
  readonly runtime: TelegramRuntime;
  readonly me: MeResponse | null;
  readonly managedTeams: readonly TelegramManagedTeam[];
}) {
  const navigate = useNavigate();
  useTelegramBackButton(runtime);

  const user = me
    ? {
        displayName: me.presentation.displayName,
        username: me.presentation.username,
        photoUrl: me.presentation.photoUrl
      }
    : null;

  return (
    <main className="foundation-shell">
      <HoomaAccountHeader
        user={user}
        canManageTeams={managedTeams.length > 0}
        isPlatformAdmin={Boolean(me?.platformRoles.includes("PLATFORM_ADMIN"))}
        onHome={() => navigate("/")}
        onGuestProfile={() => navigate("/profile")}
        onProfile={() => navigate("/profile")}
        onSettings={() => navigate("/settings")}
        onAdmin={me?.platformRoles.includes("PLATFORM_ADMIN") ? () => navigate("/admin") : undefined}
      />
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
