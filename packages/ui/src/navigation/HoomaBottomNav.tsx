import { useEffect, useRef, useState, type MouseEvent } from "react";
import { BallIcon, HomeIcon, HoomaStampIcon, LiveIcon, PitchIcon } from "./nav-icons.js";

export const PRIMARY_NAV_ITEMS = [
  { label: "Home", href: "/", icon: HomeIcon },
  { label: "Play", href: "/play", icon: BallIcon },
  { label: "Watch", href: "/watch", icon: LiveIcon },
  { label: "HOOMA", href: "/hooma", icon: HoomaStampIcon },
  { label: "Pitch", href: "/pitch", icon: PitchIcon }
] as const;

export interface HoomaBottomNavProps {
  readonly pathname: string;
  readonly onNavigate: (href: string) => void;
  readonly ariaLabel?: string;
}

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function shouldHandleClientNavigation(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function HoomaBottomNav({ pathname, onNavigate, ariaLabel = "Primary" }: HoomaBottomNavProps) {
  const [hidden, setHidden] = useState(false);
  const previousY = useRef(0);

  useEffect(() => {
    previousY.current = window.scrollY;

    const onScroll = () => {
      const nextY = window.scrollY;
      const delta = nextY - previousY.current;

      if (nextY <= 12) setHidden(false);
      else if (delta > 5) setHidden(true);
      else if (delta < -5) setHidden(false);

      previousY.current = nextY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`hooma-bottom-nav${hidden ? " hooma-bottom-nav--hidden" : ""}`} aria-label={ariaLabel}>
      {PRIMARY_NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const active = isCurrent(pathname, href);
        const isHooma = label === "HOOMA";

        return (
          <a
            key={href}
            href={href}
            className={`hooma-bottom-nav__item${active ? " hooma-bottom-nav__item--active" : ""}${
              isHooma ? " hooma-bottom-nav__item--hooma" : ""
            }`}
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              if (!shouldHandleClientNavigation(event)) return;
              event.preventDefault();
              onNavigate(href);
            }}
          >
            <span className="hooma-bottom-nav__icon-shell" aria-hidden="true">
              <Icon className="hooma-bottom-nav__icon" size={isHooma ? 30 : 26} />
            </span>
            <span className="hooma-bottom-nav__label">{label}</span>
          </a>
        );
      })}
    </nav>
  );
}
