import { useEffect, useState, type ReactNode } from "react";

export interface TeamBadgeProps {
  readonly name: string;
  readonly src?: string | null;
  readonly className?: string;
}

export interface TeamBannerProps {
  readonly name: string;
  readonly src?: string | null;
  readonly className?: string;
  readonly children?: ReactNode;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "TM";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

export function TeamBadge({ name, src, className = "" }: TeamBadgeProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div className={`team-media-badge ${className}`.trim()}>
      {src && !failed ? (
        <img src={src} alt={`${name} crest`} onError={() => setFailed(true)} />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}

export function TeamBanner({ name, src, className = "", children }: TeamBannerProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const visible = Boolean(src) && !failed;

  return (
    <div className={`team-media-banner ${visible ? "has-image" : "is-fallback"} ${className}`.trim()}>
      {visible ? (
        <img
          className="team-media-banner__image"
          src={src ?? undefined}
          alt={`${name} banner`}
          onError={() => setFailed(true)}
        />
      ) : null}
      <div className="team-media-banner__overlay" aria-hidden="true" />
      {children ? <div className="team-media-banner__content">{children}</div> : null}
    </div>
  );
}
