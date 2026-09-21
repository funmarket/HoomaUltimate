import { useEffect, useState, type ReactNode } from "react";
import { HoomaAccountHeader, HoomaBottomNav } from "@hooma/ui";
import {
  clearInteractionNoticeState,
  readInteractionNotice,
  useHoomaFrontend,
} from "@hooma/frontend";
import { useLocation, useNavigate } from "react-router-dom";
import { useAccount } from "../../account/AccountProvider";
import { UserNotificationControl } from "../../notifications/UserNotificationControl";
import type { TelegramRuntime } from "../../telegram/runtime";
import { useTelegramBackButton } from "../../telegram/useTelegramBackButton";
import { buildAccountMenuSections } from "./account-menu-model";

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
  const [interactionNotice, setInteractionNotice] = useState("");
  useTelegramBackButton(runtime);

  useEffect(() => runtime.connect(), [runtime]);

  const routeNoticeMessage = readInteractionNotice(location.state)?.message ?? "";
  useEffect(() => {
    if (!routeNoticeMessage) return;
    setInteractionNotice(routeNoticeMessage);
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: clearInteractionNoticeState(location.state),
    });
  }, [
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
    routeNoticeMessage,
  ]);

  useEffect(() => {
    if (!interactionNotice) return;
    const timer = window.setTimeout(() => setInteractionNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [interactionNotice]);

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
  const accountSections = buildAccountMenuSections({
    hasManagedTeams: managedTeams.length > 0,
    hasPlatformControlAccess,
    onCoachControlRoom: () => navigate("/teams/control"),
    onSettings: () => navigate("/settings"),
    onPlatformControlRoom: () => navigate("/admin"),
  });

  return (
    <main className="foundation-shell">
      <HoomaAccountHeader
        user={user}
        loading={loading}
        sections={accountSections}
        identityAction={{ label: "HOOMA Passport", onSelect: () => navigate("/profile") }}
        notificationControl={
          <UserNotificationControl
            enabled={Boolean(me)}
            telegramRuntime={hasTelegramIdentity}
          />
        }
        onHome={() => navigate("/")}
        onGuestProfile={() =>
          navigate(
            hasTelegramIdentity
              ? "/profile"
              : `/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`,
          )
        }
        {...(!hasTelegramIdentity ? { onSignOut: () => void signOut() } : {})}
      />
      {interactionNotice ? (
        <p className="status success" role="status" aria-live="polite">
          ✓ {interactionNotice}
        </p>
      ) : null}
      {shellError ? <p className="status">{shellError}</p> : null}
      <section className="shell-content">{children}</section>
      <HoomaBottomNav pathname={navPathname} onNavigate={(href) => navigate(href)} />
    </main>
  );
}
