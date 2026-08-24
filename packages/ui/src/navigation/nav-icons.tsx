import type { SVGProps } from "react";

export interface HoomaNavIconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  readonly size?: number;
  readonly title?: string;
}

function accessibilityProps(title: string | undefined) {
  return title ? { role: "img" as const } : { "aria-hidden": true as const };
}

export function HomeIcon({ className, size = 24, title, ...props }: HoomaNavIconProps) {
  return (
    <svg
      {...props}
      {...accessibilityProps(title)}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M3.5 11.2 12 4l8.5 7.2v8.3H15v-5.4H9v5.4H3.5v-8.3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BallIcon({ className, size = 24, title, ...props }: HoomaNavIconProps) {
  return (
    <svg
      {...props}
      {...accessibilityProps(title)}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.7" />
      <path d="m12 7 3.3 2.4-1.25 3.9H9.95L8.7 9.4 12 7Z" fill="currentColor" />
      <path
        d="M12 2.75 9.9 6.1 6 7.2 3.8 10.4M12 2.75l2.1 3.35L18 7.2l2.2 3.2M3.3 14.5l3.6-.2 3.05 3.2-.8 3.25M20.7 14.5l-3.6-.2-3.05 3.2.8 3.25"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LiveIcon({ className, size = 24, title, ...props }: HoomaNavIconProps) {
  return (
    <svg
      {...props}
      {...accessibilityProps(title)}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <rect
        x="3.4"
        y="5.2"
        width="17.2"
        height="12.3"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="m10 9 5 2.4-5 2.6V9ZM8 20h8"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HoomaStampIcon({ className, size = 48, title, ...props }: HoomaNavIconProps) {
  return (
    <svg
      {...props}
      {...accessibilityProps(title)}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2" />
      <circle
        cx="24"
        cy="24"
        r="16.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <path d="m24 16 5 3.6-1.9 5.9h-6.2L19 19.6 24 16Z" fill="currentColor" />
      <path
        d="M16 12.5h-3M35 12.5h-3M15 35.5h-3M36 35.5h-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M11.5 24h3M33.5 24h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PitchIcon({ className, size = 24, title, ...props }: HoomaNavIconProps) {
  return (
    <svg
      {...props}
      {...accessibilityProps(title)}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M3.25 9.2 12 4l8.75 5.2v9.55H3.25V9.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 18.75v-5.1h11.6v5.1M9.3 13.65V10.2h5.4v3.45M3.25 9.2h17.5"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 7.8V5.9M18.5 7.8V5.9"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
    </svg>
  );
}
