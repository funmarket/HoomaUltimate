import type { ButtonHTMLAttributes, ReactNode } from "react";

type WhistleActionProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  readonly label: string;
  readonly trailing?: ReactNode;
};

export function WhistleAction({ label, trailing, className = "", ...props }: WhistleActionProps) {
  return (
    <button {...props} className={`whistle-action ${className}`.trim()}>
      <span className="whistle-action__signal" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M4 13h4.2l3.2-5.2h5.3l2.3 3.7-2.3 3.7h-5.3L8.2 10H4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2.5 8.5h3M2.5 17.5h3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="whistle-action__label">{label}</span>
      {trailing ? <span className="whistle-action__trailing">{trailing}</span> : null}
    </button>
  );
}
