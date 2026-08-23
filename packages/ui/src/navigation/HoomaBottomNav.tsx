import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { LiveIcon } from "./nav-icons.js";

type NavVisual =
  | { readonly kind: "mask"; readonly src: string; readonly className?: string }
  | { readonly kind: "image"; readonly src: string; readonly className?: string }
  | { readonly kind: "icon"; readonly className?: string };

export const PRIMARY_NAV_ITEMS = [
  {
    label: "Home",
    href: "/",
    visual: { kind: "mask", src: "/navigation/home.svg", className: "hooma-bottom-nav__mask--home" }
  },
  {
    label: "Play",
    href: "/play",
    visual: { kind: "mask", src: "/navigation/play.svg", className: "hooma-bottom-nav__mask--play" }
  },
  { label: "Watch", href: "/watch", visual: { kind: "icon" } },
  {
    label: "HOOMA",
    href: "/hooma",
    visual: { kind: "image", src: "/navigation/hoomab.svg", className: "hooma-bottom-nav__artwork--hooma" }
  },
  {
    label: "Pitch",
    href: "/pitch",
    visual: { kind: "image", src: "/navigation/pitch.svg", className: "hooma-bottom-nav__artwork--pitch" }
  }
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

function NavVisualView({ visual }: { readonly visual: NavVisual }) {
  if (visual.kind === "icon") {
    return <LiveIcon className="hooma-bottom-nav__icon" size={26} />;
  }

  if (visual.kind === "image") {
    return (
      <img
        src={visual.src}
        alt=""
        className={`hooma-bottom-nav__artwork${visual.className ? ` ${visual.className}` : ""}`}
      />
    );
  }

  const style = { "--hooma-nav-mask": `url(${visual.src})` } as CSSProperties;
  return (
    <span
      className={`hooma-bottom-nav__mask${visual.className ? ` ${visual.className}` : ""}`}
      style={style}
    />
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
      {PRIMARY_NAV_ITEMS.map(({ label, href, visual }) => {
        const active = isCurrent(pathname, href);
        const itemClass = label.toLowerCase();

        return (
          <a
            key={href}
            href={href}
            className={`hooma-bottom-nav__item hooma-bottom-nav__item--${itemClass}${
              active ? " hooma-bottom-nav__item--active" : ""
            }`}
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              if (!shouldHandleClientNavigation(event)) return;
              event.preventDefault();
              onNavigate(href);
            }}
          >
            <span className="hooma-bottom-nav__icon-shell" aria-hidden="true">
              <NavVisualView visual={visual} />
            </span>
            <span className="hooma-bottom-nav__label">{label}</span>
          </a>
        );
      })}
    </nav>
  );
}
