import { TeamBadge, TeamBanner } from "./TeamMedia.js";

export interface TeamDiscoveryCardProps {
  readonly id: string;
  readonly name: string;
  readonly badgeUrl?: string | null;
  readonly bannerUrl?: string | null;
  readonly city?: string | null;
  readonly houma?: string | null;
  readonly motto?: string | null;
  readonly playerCount: number;
  readonly challengeHref?: string | null;
}

export function TeamDiscoveryCard({
  id,
  name,
  badgeUrl,
  bannerUrl,
  city,
  houma,
  motto,
  playerCount,
  challengeHref
}: TeamDiscoveryCardProps) {
  const location = [houma, city].filter(Boolean).join(" · ") || "Location TBA";
  return (
    <article className="team-discovery-card-pro">
      {bannerUrl ? <TeamBanner name={name} src={bannerUrl} className="team-discovery-banner" /> : null}
      <TeamBadge name={name} src={badgeUrl} className="team-discovery-badge" />
      <div className="team-discovery-main">
        <div className="team-discovery-heading">
          <div>
            <h3>{name}</h3>
            <p>{location}</p>
          </div>
          <span>Public team</span>
        </div>
        <p className="team-discovery-motto">{motto || "Ready for the next challenge."}</p>
        <div className="team-discovery-meta"><b>{playerCount}</b> active players</div>
        <div className="team-discovery-actions">
          <a href={`/teams/${encodeURIComponent(id)}`}>View team</a>
          {challengeHref ? <a className="primary" href={challengeHref}>Challenge</a> : null}
        </div>
      </div>
    </article>
  );
}
