import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { readonly children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function RequestIcon(props: IconProps) {
  return <Icon {...props}><path d="M4 5.5h16v11H9l-5 3v-14Z" /><path d="M8 9h8M8 13h5" /></Icon>;
}

export function FundMeIcon(props: IconProps) {
  return <Icon {...props}><path d="M4 7h16v11H4z" /><path d="M7 7V5h10v2M8 12h8M12 9v6" /></Icon>;
}

export function GiftIcon(props: IconProps) {
  return <Icon {...props}><path d="M3 10h18v10H3zM2 7h20v3H2zM12 7v13" /><path d="M12 7H8.5a2.5 2.5 0 1 1 2.2-3.7L12 7Zm0 0h3.5a2.5 2.5 0 1 0-2.2-3.7L12 7Z" /></Icon>;
}

export function PlusIcon(props: IconProps) {
  return <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>;
}

export function LocationIcon(props: IconProps) {
  return <Icon {...props}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></Icon>;
}

export function ClockIcon(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
}

export function FilterIcon(props: IconProps) {
  return <Icon {...props}><path d="M4 6h16M7 12h10M10 18h4" /></Icon>;
}
