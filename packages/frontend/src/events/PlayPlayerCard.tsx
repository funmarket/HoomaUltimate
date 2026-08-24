import type { PublicPlayPlayerListing } from "./play-api";

type PlayPlayerCardProps = {
  listing: PublicPlayPlayerListing;
  onHire?: (listing: PublicPlayPlayerListing) => void;
  offerSent?: boolean;
};

export function PlayPlayerCard({ listing, onHire, offerSent = false }: PlayPlayerCardProps) {
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
      />

      <div className="play-player-card__topline">
        <span className="play-looking-badge">
          <i aria-hidden="true" />
          LOOKING FOR {lookingForGame ? "A GAME" : "A TEAM"}
        </span>
        <span className="play-player-card__open-profile">OPEN PROFILE ›</span>
      </div>

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
        {presentation.bio ? <p>{presentation.bio}</p> : null}
      </div>

      <div className="play-player-card__facts" aria-label="Availability details">
        <div>
          <span>STATUS</span>
          <strong>AVAILABLE</strong>
        </div>
        <div>
          <span>LOOKING FOR</span>
          <strong>{lookingForGame ? "GAME" : "TEAM"}</strong>
        </div>
        <div>
          <span>UPDATED</span>
          <strong>{updatedLabel}</strong>
        </div>
        <div>
          <span>IDENTITY</span>
          <strong>HOOMA</strong>
        </div>
      </div>

      <div className="play-player-card__action-zone">
        <span>ORGANIZER ACTION</span>
        {lookingForGame ? (
          <div className="play-player-card__action" aria-disabled="true">
            <span className="play-player-card__action-icon" aria-hidden="true">
              ↗
            </span>
            <span>
              <strong>INVITE</strong>
              <small>Game invitations are handled separately by Events</small>
            </span>
            <b aria-hidden="true">›</b>
          </div>
        ) : (
          <button
            className="play-player-card__action play-player-card__action--button"
            type="button"
            disabled={offerSent}
            onClick={() => onHire?.(listing)}
          >
            <span className="play-player-card__action-icon" aria-hidden="true">
              {offerSent ? "✓" : "+"}
            </span>
            <span>
              <strong>{offerSent ? "OFFER SENT" : "HIRE PLAYER"}</strong>
              <small>
                {offerSent ? "Waiting for the player" : "Offer this player a spot on your Team"}
              </small>
            </span>
            <b aria-hidden="true">›</b>
          </button>
        )}
      </div>

      <div className="play-player-card__footer">
        <span>TAP CARD = PLAYER PROFILE</span>
        <span>ONE IDENTITY</span>
      </div>
    </article>
  );
}
