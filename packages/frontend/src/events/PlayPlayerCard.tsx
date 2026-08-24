import type { PublicPlayPlayerListing } from "./play-api";

export function PlayPlayerCard({ listing }: { listing: PublicPlayPlayerListing }) {
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
      <a className="play-player-card__profile-link" href={profileHref} aria-label={`Open ${presentation.displayName}'s player profile`} />

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
        <div><span>STATUS</span><strong>AVAILABLE</strong></div>
        <div><span>LOOKING FOR</span><strong>{lookingForGame ? "GAME" : "TEAM"}</strong></div>
        <div><span>UPDATED</span><strong>{updatedLabel}</strong></div>
        <div><span>IDENTITY</span><strong>HOOMA</strong></div>
      </div>

      <div className="play-player-card__action-zone">
        <span>ORGANIZER ACTION</span>
        <div className="play-player-card__action" aria-disabled="true">
          <span className="play-player-card__action-icon" aria-hidden="true">
            {lookingForGame ? "↗" : "+"}
          </span>
          <span>
            <strong>{lookingForGame ? "INVITE" : "HIRE PLAYER"}</strong>
            <small>
              {lookingForGame
                ? "Event invitation handoff is being added in Events"
                : "Recruitment handoff is being added in Teams"}
            </small>
          </span>
          <b aria-hidden="true">›</b>
        </div>
      </div>

      <div className="play-player-card__footer">
        <span>TAP CARD = PLAYER PROFILE</span>
        <span>ONE IDENTITY</span>
      </div>
    </article>
  );
}
