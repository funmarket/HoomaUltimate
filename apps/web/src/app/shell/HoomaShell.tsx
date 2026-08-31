import { useEffect, type ReactNode } from "react";
import { HoomaAccountHeader, HoomaBottomNav } from "@hooma/ui";
import { useHoomaFrontend } from "@hooma/frontend";
import { useLocation, useNavigate } from "react-router-dom";
import { useAccount } from "../../account/AccountProvider";
import type { TelegramRuntime } from "../../telegram/runtime";
import { useTelegramBackButton } from "../../telegram/useTelegramBackButton";

export function HoomaShell({
  children,
  runtime,
}: {
  readonly children: ReactNode;
  readonly runtime: TelegramRuntime;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { api } = useHoomaFrontend();
  const { me, managedTeams, hasPlatformControlAccess, loading, error, refresh } = useAccount();
  useTelegramBackButton(runtime);

  useEffect(() => runtime.connect(), [runtime]);

  async function signOut() {
    await api.identity.logout();
    await refresh();
    navigate("/");
  }

  const user = me
    ? {
        displayName: me.presentation.displayName,
        username: me.presentation.username,
        photoUrl: me.presentation.photoUrl,
      }
    : null;
  const hasTelegramIdentity = Boolean(runtime.initData);
  const navPathname = location.pathname === "/telegram" ? "/" : location.pathname;
  const shellError = error && !location.pathname.startsWith("/rides") ? error : null;

  return (
    <main className="foundation-shell">
      <HoomaAccountHeader
        user={user}
        loading={loading}
        canManageTeams={managedTeams.length > 0}
        isPlatformAdmin={hasPlatformControlAccess}
        onHome={() => navigate("/")}
        onGuestProfile={() =>
          navigate(
            hasTelegramIdentity
              ? "/profile"
              : `/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`,
          )
        }
        onProfile={() => navigate("/profile")}
        {...(managedTeams.length ? { onCoach: () => navigate("/teams/control") } : {})}
        onSettings={() => navigate("/settings")}
        {...(hasPlatformControlAccess ? { onAdmin: () => navigate("/admin") } : {})}
        {...(!hasTelegramIdentity ? { onSignOut: () => void signOut() } : {})}
      />
      {shellError ? <p className="status">{shellError}</p> : null}
      <section className="shell-content">{children}</section>
      <HoomaBottomNav pathname={navPathname} onNavigate={(href) => navigate(href)} />
    </main>
  );
}
