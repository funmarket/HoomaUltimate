import type { PublicPlayPlayerListing } from "./play-api";

type PlayPlayerCardProps = {
  listing: PublicPlayPlayerListing;
  onInvite?: (listing: PublicPlayPlayerListing) => void;
  onHire?: (listing: PublicPlayPlayerListing) => void;
  actionDisabled?: boolean;
};

export function PlayPlayerCard({
  listing,
  onInvite,
  onHire,
  actionDisabled = false,
}: PlayPlayerCardProps) {
  const presentation = listing.presentation;
  if (!presentation) return null;

  const lookingForGame = listing.lookingFor === "GAME";
  const profileHref = `/profile/${encodeURIComponent(presentation.username)}`;
  const updatedLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(listing.updatedAt));
  return (
    <article
      className={`play-player-card play-player-card--${lookingForGame ? "game" : "team"}`}
      aria-label={`${presentation.displayName}, looking for ${lookingForGame ? "a game" : "a team"}`}
    >
      <a
        className="play-player-card__profile-link"
        href={profileHref}
        aria-label={`Open ${presentation.displayName}'s player profile`}
      >
        <div className="play-player-card__portrait" aria-hidden="true">
          {presentation.photoUrl ? (
            <img src={presentation.photoUrl} alt="" />
          ) : (
            <span>{presentation.displayName.slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        <div className="play-player-card__identity">
          <strong>{presentation.displayName}</strong>
          <small>@{presentation.username}</small>
          <div className="play-player-card__meta">
            <span className="play-looking-badge">
              <i aria-hidden="true" />
              {lookingForGame ? "Looking for a game" : "Looking for a team"}
            </span>
            <span className="play-player-card__updated">{updatedLabel}</span>
          </div>
        </div>
      </a>

      <button
        className={`play-player-card__action play-player-card__action--${lookingForGame ? "invite" : "offer"}`}
        type="button"
        disabled={actionDisabled}
        onClick={() => (lookingForGame ? onInvite?.(listing) : onHire?.(listing))}
      >
        {lookingForGame ? "Invite" : "Offer a spot"}
      </button>
    </article>
  );
}
