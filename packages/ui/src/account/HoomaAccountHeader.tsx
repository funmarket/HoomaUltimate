import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BrandMark } from "../brand/BrandMark.js";
import { AccountMenuChevronIcon, AccountMenuUserIcon } from "./account-menu-icons.js";

export interface HoomaAccountUser {
  readonly displayName: string;
  readonly username: string;
  readonly photoUrl: string | null;
}

export interface HoomaAccountMenuItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly icon: ReactNode;
  readonly badge?: number | null;
  readonly badgeLabel?: string;
  readonly onSelect: () => void;
}

export interface HoomaAccountMenuSection {
  readonly id: string;
  readonly label?: string;
  readonly items: readonly HoomaAccountMenuItem[];
}

export interface HoomaAccountIdentityAction {
  readonly label: string;
  readonly onSelect: () => void;
}

export interface HoomaAccountHeaderProps {
  readonly user: HoomaAccountUser | null;
  readonly loading: boolean;
  readonly sections: readonly HoomaAccountMenuSection[];
  readonly identityAction: HoomaAccountIdentityAction;
  readonly onHome: () => void;
  readonly onGuestProfile: () => void;
  readonly onSignOut?: () => void;
  readonly notificationControl?: ReactNode;
}

function MenuRow({
  item,
  onSelect,
}: {
  readonly item: HoomaAccountMenuItem;
  readonly onSelect: () => void;
}) {
  const badge = item.badge ?? null;

  return (
    <button
      type="button"
      className="hooma-account-menu__row"
      onClick={onSelect}
      aria-label={
        badge !== null && item.badgeLabel ? `${item.title}, ${item.badgeLabel}` : undefined
      }
    >
      <span className="hooma-account-menu__row-icon">{item.icon}</span>
      <span className="hooma-account-menu__row-copy">
        <strong>{item.title}</strong>
        {item.subtitle ? <span>{item.subtitle}</span> : null}
      </span>
      <span className="hooma-account-menu__row-trailing">
        {badge !== null ? (
          <span className="hooma-account-menu__badge" aria-hidden="true">
            {badge}
          </span>
        ) : null}
        <span className="hooma-account-menu__chevron">
          <AccountMenuChevronIcon />
        </span>
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
  sections,
  identityAction,
  onHome,
  onGuestProfile,
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
    const anchorElement = anchor;

    if (!open) {
      if (menu.matches(":popover-open")) menu.hidePopover();
      return;
    }

    function updateGeometry() {
      setMenuStyle(accountMenuGeometry(anchorElement));
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
            aria-expanded={!loading && user ? open : undefined}
            disabled={loading}
            onClick={() => (user ? setOpen((value) => !value) : onGuestProfile())}
          >
            {loading ? (
              <span className="hooma-profile-trigger__loading" aria-hidden="true" />
            ) : user?.photoUrl ? (
              <img src={user.photoUrl} alt="" />
            ) : (
              <AccountMenuUserIcon />
            )}
          </button>
        </div>
      </div>

      {user ? (
        <section
          ref={menuRef}
          className="hooma-account-menu"
          aria-label="HOOMA account"
          popover="auto"
          style={menuStyle}
        >
          <button
            type="button"
            className="hooma-account-menu__identity"
            onClick={() => navigate(identityAction.onSelect)}
          >
            {user.photoUrl ? (
              <img src={user.photoUrl} alt="" />
            ) : (
              <span className="hooma-account-menu__avatar-fallback">
                {user.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="hooma-account-menu__identity-copy">
              <strong>{user.displayName}</strong>
              <small>@{user.username}</small>
            </span>
            <span className="hooma-account-menu__identity-action">
              {identityAction.label}
              <AccountMenuChevronIcon />
            </span>
          </button>

          {sections.map((section) =>
            section.items.length ? (
              <div className="hooma-account-menu__section" key={section.id}>
                {section.label ? (
                  <h3 className="hooma-account-menu__section-label">{section.label}</h3>
                ) : null}
                <div className="hooma-account-menu__rows">
                  {section.items.map((item) => (
                    <MenuRow key={item.id} item={item} onSelect={() => navigate(item.onSelect)} />
                  ))}
                </div>
              </div>
            ) : null,
          )}

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
