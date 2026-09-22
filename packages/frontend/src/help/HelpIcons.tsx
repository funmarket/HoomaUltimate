import type { ReactNode, SVGProps } from "react";

type HelpIconProps = SVGProps<SVGSVGElement>;

function HelpIcon({ children, ...props }: HelpIconProps & { readonly children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function RequestIcon(props: HelpIconProps) {
  return (
    <HelpIcon {...props}>
      <path d="M4 5.5h16v11H9l-5 3v-14Z" />
      <path d="M8 9h8M8 13h5" />
    </HelpIcon>
  );
}

export function FundMeIcon(props: HelpIconProps) {
  return (
    <HelpIcon {...props}>
      <path d="M4 7h16v11H4z" />
      <path d="M7 7V5h10v2M8 12h8M12 9v6" />
    </HelpIcon>
  );
}

export function DonationIcon(props: HelpIconProps) {
  return (
    <HelpIcon {...props}>
      <path d="M12 20s-7-4.4-7-9.2A4.2 4.2 0 0 1 12 7.7a4.2 4.2 0 0 1 7 3.1C19 15.6 12 20 12 20Z" />
      <path d="M9.5 12h5M12 9.5v5" />
    </HelpIcon>
  );
}

export function PlusIcon(props: HelpIconProps) {
  return (
    <HelpIcon {...props}>
      <path d="M12 5v14M5 12h14" />
    </HelpIcon>
  );
}

export function LocationIcon(props: HelpIconProps) {
  return (
    <HelpIcon {...props}>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </HelpIcon>
  );
}

export function ClockIcon(props: HelpIconProps) {
  return (
    <HelpIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </HelpIcon>
  );
}

export function FilterIcon(props: HelpIconProps) {
  return (
    <HelpIcon {...props}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </HelpIcon>
  );
}
