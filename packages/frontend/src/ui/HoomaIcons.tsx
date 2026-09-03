import type { ReactNode } from "react";

type IconProps = { readonly size?: number; readonly className?: string };

function SvgIcon({ size = 22, className, children }: IconProps & { readonly children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="4" y="5.5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M7.5 3.5v4M16.5 3.5v4M4 9h16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}

export function CalendarPlusIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="4" y="5.5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M7.5 3.5v4M16.5 3.5v4M4 9h16M12 11.8v4.6M9.7 14.1h4.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="M12 21s6.3-5.3 6.3-11A6.3 6.3 0 1 0 5.7 10C5.7 15.7 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </SvgIcon>
  );
}

export function WatchCalendarIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect
        className="hooma-icon__base"
        x="4"
        y="5.8"
        width="16"
        height="13.6"
        rx="2.1"
        stroke="currentColor"
      />
      <path
        className="hooma-icon__base"
        d="M7.6 3.7v4.2M16.4 3.7v4.2M4 9.4h16"
        stroke="currentColor"
      />
      <rect
        className="hooma-icon__body"
        x="4"
        y="5.8"
        width="16"
        height="13.6"
        rx="2.1"
        stroke="currentColor"
      />
      <path
        className="hooma-icon__body"
        d="M7.6 3.7v4.2M16.4 3.7v4.2M4 9.4h16"
        stroke="currentColor"
      />
      <path className="hooma-icon__shade" d="M6.1 17.3h12M18 11.2v5.5" stroke="currentColor" />
      <path className="hooma-icon__highlight" d="M5.8 7.6h11.2M6.2 6.7v10" stroke="currentColor" />
    </SvgIcon>
  );
}

export function WatchCalendarPlusIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <rect
        className="hooma-icon__base"
        x="4"
        y="5.8"
        width="16"
        height="13.6"
        rx="2.1"
        stroke="currentColor"
      />
      <path
        className="hooma-icon__base"
        d="M7.6 3.7v4.2M16.4 3.7v4.2M4 9.4h16M12 11.7v4.8M9.6 14.1h4.8"
        stroke="currentColor"
      />
      <rect
        className="hooma-icon__body"
        x="4"
        y="5.8"
        width="16"
        height="13.6"
        rx="2.1"
        stroke="currentColor"
      />
      <path
        className="hooma-icon__body"
        d="M7.6 3.7v4.2M16.4 3.7v4.2M4 9.4h16M12 11.7v4.8M9.6 14.1h4.8"
        stroke="currentColor"
      />
      <path className="hooma-icon__shade" d="M6.1 17.3h12M18 11.2v5.5" stroke="currentColor" />
      <path className="hooma-icon__highlight" d="M5.8 7.6h11.2M6.2 6.7v10" stroke="currentColor" />
    </SvgIcon>
  );
}

export function WatchPinIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path
        className="hooma-icon__base"
        d="M12 21s6.4-5.45 6.4-11.15A6.4 6.4 0 1 0 5.6 9.85C5.6 15.55 12 21 12 21Z"
        stroke="currentColor"
      />
      <circle className="hooma-icon__base" cx="12" cy="9.7" r="2.35" stroke="currentColor" />
      <path
        className="hooma-icon__body"
        d="M12 21s6.4-5.45 6.4-11.15A6.4 6.4 0 1 0 5.6 9.85C5.6 15.55 12 21 12 21Z"
        stroke="currentColor"
      />
      <circle className="hooma-icon__dot" cx="12" cy="9.7" r="2.35" />
      <path
        className="hooma-icon__shade"
        d="M15.2 7.3c1.1 1.65.84 4.05-.78 7.18M11.2 19.4l2.7-3.2"
        stroke="currentColor"
      />
      <path
        className="hooma-icon__highlight"
        d="M8.2 7.3c.85-1.3 2.14-2.02 3.86-2.14"
        stroke="currentColor"
      />
    </SvgIcon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.65" />
      <circle cx="16.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.45" />
      <path
        d="M3.8 19c.45-4 2.2-6 5.2-6s4.75 2 5.2 6M14.1 14.2c2.65.1 4.3 1.7 4.8 4.8"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}

export function UserPlusIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3.8 19c.45-4 2.2-6 5.2-6s4.75 2 5.2 6M17 8v6M14 11h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="M7.1 4.5 4.9 6.7c-.8.8-.5 3.2 1.6 6.1 2.5 3.4 5.7 5.7 8.3 6.2 1.1.2 1.8 0 2.3-.5l2.1-2.1-4.2-3.1-1.7 1.7c-1.8-.8-3.8-2.8-4.7-4.7l1.7-1.7-3.2-4.1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 10.7v5.3M12 7.4h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="18" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="19" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m8 11 7.9-4.7M8 13l7.9 4.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="M5 8h14M5 12h14M5 16h9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M4 4h16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </SvgIcon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="m9 5 7 7-7 7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="m5 16.5-.8 3.3 3.3-.8L18 8.5 15.5 6 5 16.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="m14.7 6.8 2.5 2.5" stroke="currentColor" strokeWidth="1.6" />
    </SvgIcon>
  );
}
