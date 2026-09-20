import { useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "../brand/BrandMark.js";
import { useAnchoredPopover } from "../overlay/anchored-popover.js";
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
  const {
    anchorRef,
    popoverRef: menuRef,
    style: menuStyle,
  } = useAnchoredPopover({
    open,
    revision: user,
    onClose: () => setOpen(false),
  });

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
