import type { ReactNode } from "react";
import { HoomaAccountHeader, PRIMARY_NAV_ITEMS } from "@hooma/ui";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { webApi } from "../../api/client";
import { useWebAccount } from "../../account/WebAccountProvider";

export function WebShell({ children }: { readonly children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { me, managedTeams, refresh } = useWebAccount();

  async function signOut() {
    await webApi.logout();
    await refresh();
    navigate("/");
  }

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
        onGuestProfile={() => navigate(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`)}
        onProfile={() => navigate("/profile")}
        onCoach={() => navigate("/teams/control")}
        onSettings={() => navigate("/settings")}
        onAdmin={() => navigate("/admin")}
        onSignOut={() => void signOut()}
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
