import { useEffect, useState } from "react";

export interface TeamBadgeProps {
  readonly name: string;
  readonly src?: string | null;
  readonly className?: string;
}

export interface TeamBannerProps {
  readonly src?: string | null;
  readonly className?: string;
  readonly eager?: boolean;
}

export function TeamBadge({ name, src, className }: TeamBadgeProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initials = name.trim().slice(0, 2).toUpperCase() || "TM";
  const classes = ["team-brand-badge", className].filter(Boolean).join(" ");

  return (
    <span className={classes}>
      {src && !failed ? (
        <img src={src} alt={`${name} logo`} onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}

export function TeamBanner({ src, className, eager = false }: TeamBannerProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return null;

  const classes = ["team-brand-banner", className].filter(Boolean).join(" ");
  return (
    <img
      className={classes}
      src={src}
      alt=""
      aria-hidden="true"
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  );
}
