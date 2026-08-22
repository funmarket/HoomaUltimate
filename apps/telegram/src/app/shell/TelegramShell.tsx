import type { ReactNode } from "react";
import type { MeResponse } from "@hooma/contracts";
import { HoomaAccountHeader, HoomaBottomNav } from "@hooma/ui";
import { useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  useTelegramBackButton(runtime);

  const user = me
    ? {
        displayName: me.presentation.displayName,
        username: me.presentation.username,
        photoUrl: me.presentation.photoUrl
      }
    : null;
  const isPlatformAdmin = Boolean(me?.platformRoles.includes("PLATFORM_ADMIN"));

  return (
    <main className="foundation-shell">
      <HoomaAccountHeader
        user={user}
        canManageTeams={managedTeams.length > 0}
        isPlatformAdmin={isPlatformAdmin}
        onHome={() => navigate("/")}
        onGuestProfile={() => navigate("/profile")}
        onProfile={() => navigate("/profile")}
        onSettings={() => navigate("/settings")}
        {...(isPlatformAdmin ? { onAdmin: () => navigate("/admin") } : {})}
      />
      <section className="shell-content">{children}</section>
      <HoomaBottomNav pathname={location.pathname} onNavigate={(href) => navigate(href)} />
    </main>
  );
}
