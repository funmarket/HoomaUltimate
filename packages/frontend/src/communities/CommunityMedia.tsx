import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "H"
  );
}

export function CommunityMediaSurface({
  bannerUrl,
  className,
  children,
  gradient,
  as = "div",
}: {
  readonly bannerUrl: string | null | undefined;
  readonly className: string;
  readonly children: ReactNode;
  readonly gradient?: string;
  readonly as?: "div" | "section";
}) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

  useEffect(() => {
    const source = bannerUrl?.trim();
    setLoadedUrl(null);
    if (!source) return;

    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active) setLoadedUrl(source);
    };
    image.onerror = () => {
      if (active) setLoadedUrl(null);
    };
    image.src = source;
    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [bannerUrl]);

  const style: CSSProperties | undefined = loadedUrl
    ? {
        backgroundImage: `${gradient ? `${gradient}, ` : ""}url(${JSON.stringify(loadedUrl)})`,
      }
    : undefined;
  const Surface = as;

  return (
    <Surface className={className} style={style}>
      {children}
    </Surface>
  );
}

export function CommunityLogo({
  logoUrl,
  name,
  className,
  alt,
}: {
  readonly logoUrl: string | null | undefined;
  readonly name: string;
  readonly className: string;
  readonly alt?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const source = logoUrl?.trim() || null;
  const displayUrl = source && source !== failedUrl ? source : null;

  useEffect(() => {
    setFailedUrl(null);
  }, [source]);

  return (
    <div className={className}>
      {displayUrl ? (
        <img
          className="hooma-community-logo-image"
          src={displayUrl}
          alt={alt ?? ""}
          onError={() => setFailedUrl(displayUrl)}
        />
      ) : (
        <span className="hooma-community-logo-fallback">{initials(name)}</span>
      )}
    </div>
  );
}
