import type { RequestRequesterPresentation } from "@hooma/contracts/requests";

/**
 * Requester identity, rendered only from the canonical identity projection.
 * When the reader is not wired (`requester` is null) the block is omitted
 * rather than filled with a placeholder name or avatar.
 */
export function RequestCardIdentity({
  requester,
}: {
  readonly requester: RequestRequesterPresentation | null | undefined;
}) {
  if (!requester) return null;

  return (
    <div className="request-card__identity">
      <span className="request-card__avatar" aria-hidden="true">
        {requester.photoUrl ? (
          <img
            src={requester.photoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="request-card__avatar-fallback">
            {requester.displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <span className="request-card__identity-copy">
        <strong>{requester.displayName}</strong>
        <small>@{requester.username}</small>
      </span>
    </div>
  );
}
