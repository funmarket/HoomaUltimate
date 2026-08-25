import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BrandMark } from "../brand/BrandMark.js";

export interface HoomaAccountUser {
  readonly displayName: string;
  readonly username: string;
  readonly photoUrl: string | null;
}

export interface HoomaAccountHeaderProps {
  readonly user: HoomaAccountUser | null;
  readonly loading: boolean;
  readonly canManageTeams: boolean;
  readonly isPlatformAdmin: boolean;
  readonly onHome: () => void;
  readonly onGuestProfile: () => void;
  readonly onProfile: () => void;
  readonly onCoach?: () => void;
  readonly onSettings: () => void;
  readonly onAdmin?: () => void;
  readonly onSignOut?: () => void;
  readonly notificationControl?: ReactNode;
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.6 2.9 8.3 7 10 4.1-1.7 7-5.4 7-10V6l-7-3Z" />
      <path d="m9.5 12 1.7 1.7 3.5-4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19 13.5v-3l-2.1-.7a7.8 7.8 0 0 0-.8-1.9l1-2-2.1-2.1-2 1a7.8 7.8 0 0 0-1.9-.8L10.5 2h-3l-.7 2.1a7.8 7.8 0 0 0-1.9.8l-2-1L.8 6l1 2a7.8 7.8 0 0 0-.8 1.9L-1 10.5v3l2.1.7a7.8 7.8 0 0 0 .8 1.9l-1 2L3 20.2l2-1a7.8 7.8 0 0 0 1.9.8l.7 2.1h3l.7-2.1a7.8 7.8 0 0 0 1.9-.8l2 1 2.1-2.1-1-2a7.8 7.8 0 0 0 .8-1.9l1.9-.7Z"
        transform="translate(2) scale(.83)"
      />
    </svg>
  );
}

function WhistleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h8a4 4 0 0 1 0 8H9a4 4 0 0 1-4-4v-4Z" />
      <path d="M13 12V8h6v4" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onClick,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly onClick: () => void;
}) {
  return (
    <button type="button" className="hooma-account-menu__row" onClick={onClick}>
      <span className="hooma-account-menu__row-icon">{icon}</span>
      <span className="hooma-account-menu__row-copy">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </span>
      <span className="hooma-account-menu__chevron">
        <ChevronIcon />
      </span>
    </button>
  );
}

function accountMenuGeometry(anchor: HTMLElement): CSSProperties {
  const visualViewport = window.visualViewport;
  const viewportLeft = visualViewport?.offsetLeft ?? 0;
  const viewportTop = visualViewport?.offsetTop ?? 0;
  const viewportWidth = visualViewport?.width ?? window.innerWidth;
  const viewportHeight = visualViewport?.height ?? window.innerHeight;
  const viewportRight = viewportLeft + viewportWidth;
  const viewportBottom = viewportTop + viewportHeight;
  const margin = 12;
  const gap = 8;
  const anchorRect = anchor.getBoundingClientRect();
  const nav = document.querySelector<HTMLElement>(
    ".hooma-bottom-nav:not(.hooma-bottom-nav--hidden)",
  );
  const navRect = nav?.getBoundingClientRect();
  const navTop =
    navRect && navRect.top < viewportBottom && navRect.bottom > viewportTop
      ? navRect.top - gap
      : viewportBottom - margin;
  const bottomLimit = Math.min(viewportBottom - margin, navTop);
  const width = Math.max(0, Math.min(360, viewportWidth - margin * 2));
  const left = Math.min(
    Math.max(viewportLeft + margin, anchorRect.right - width),
    viewportRight - margin - width,
  );
  const top = Math.max(viewportTop + margin, anchorRect.bottom + gap);

  return {
    top,
    left,
    width,
    maxHeight: Math.max(0, bottomLimit - top),
  };
}

export function HoomaAccountHeader({
  user,
  loading,
  canManageTeams,
  isPlatformAdmin,
  onHome,
  onGuestProfile,
  onProfile,
  onCoach,
  onSettings,
  onAdmin,
  onSignOut,
  notificationControl,
}: HoomaAccountHeaderProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    function onToggle(event: Event) {
      const nextState = (event as Event & { newState?: string }).newState;
      if (nextState === "closed") setOpen(false);
    }

    menu.addEventListener("toggle", onToggle);
    return () => menu.removeEventListener("toggle", onToggle);
  }, [user]);

  useEffect(() => {
    const menu = menuRef.current;
    const anchor = anchorRef.current;
    if (!menu || !anchor) return;
    const stableAnchor = anchor;

    if (!open) {
      if (menu.matches(":popover-open")) menu.hidePopover();
      return;
    }

    function updateGeometry() {
      const anchor = stableAnchor;
      setMenuStyle(accountMenuGeometry(anchor));
    }

    updateGeometry();
    if (!menu.matches(":popover-open")) menu.showPopover();
    const frame = window.requestAnimationFrame(updateGeometry);
    const visualViewport = window.visualViewport;

    window.addEventListener("resize", updateGeometry);
    window.addEventListener("scroll", updateGeometry, true);
    visualViewport?.addEventListener("resize", updateGeometry);
    visualViewport?.addEventListener("scroll", updateGeometry);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateGeometry);
      window.removeEventListener("scroll", updateGeometry, true);
      visualViewport?.removeEventListener("resize", updateGeometry);
      visualViewport?.removeEventListener("scroll", updateGeometry);
    };
  }, [open, user]);

  useEffect(() => {
    if (loading) setOpen(false);
  }, [loading]);

  function navigate(action: () => void) {
    setOpen(false);
    action();
  }

  const accountLabel = loading
    ? "Loading account"
    : user
      ? "Profile and account"
      : "Sign in or create account";

  return (
    <header className="hooma-topbar">
      <button type="button" className="hooma-wordmark" onClick={onHome} aria-label="HOOMA home">
        <BrandMark className="hooma-wordmark__image" />
      </button>
      <div className="hooma-topbar__actions">
        {notificationControl}
        <div className="hooma-account-anchor" ref={anchorRef}>
          <button
            type="button"
            className="hooma-profile-trigger"
            aria-label={accountLabel}
            aria-busy={loading || undefined}
            aria-haspopup={!loading && user ? "menu" : undefined}
            aria-expanded={!loading && user ? open : undefined}
            disabled={loading}
            onClick={() => (user ? setOpen((value) => !value) : onGuestProfile())}
          >
            {loading ? (
              <span className="hooma-profile-trigger__loading" aria-hidden="true" />
            ) : user?.photoUrl ? (
              <img src={user.photoUrl} alt="" />
            ) : (
              <UserIcon />
            )}
          </button>
        </div>
      </div>

      {user ? (
        <section
          ref={menuRef}
          className="hooma-account-menu"
          role="menu"
          aria-label="HOOMA account"
          popover="auto"
          style={menuStyle}
        >
          <header className="hooma-account-menu__identity">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt="" />
            ) : (
              <span className="hooma-account-menu__avatar-fallback">
                {user.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span>
              <strong>{user.displayName}</strong>
              <small>@{user.username}</small>
            </span>
          </header>

          <div className="hooma-account-menu__rows">
            <MenuRow
              icon={<UserIcon />}
              title="My HOOMA Profile"
              subtitle="View your HOOMA identity"
              onClick={() => navigate(onProfile)}
            />

            {canManageTeams && onCoach ? (
              <MenuRow
                icon={<WhistleIcon />}
                title="Coach Control Room"
                subtitle="Manage your Teams"
                onClick={() => navigate(onCoach)}
              />
            ) : null}

            <MenuRow
              icon={<SettingsIcon />}
              title="Settings"
              subtitle="Appearance and preferences"
              onClick={() => navigate(onSettings)}
            />
          </div>

          {isPlatformAdmin && onAdmin ? (
            <div className="hooma-account-menu__platform">
              <MenuRow
                icon={<ShieldIcon />}
                title="App Admin"
                subtitle="HOOMA platform control"
                onClick={() => navigate(onAdmin)}
              />
            </div>
          ) : null}

          {onSignOut ? (
            <button
              type="button"
              className="hooma-account-menu__signout"
              onClick={() => navigate(onSignOut)}
            >
              Sign out
            </button>
          ) : null}
        </section>
      ) : null}
    </header>
  );
}
