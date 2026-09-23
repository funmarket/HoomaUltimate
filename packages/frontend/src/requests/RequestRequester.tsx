import type { HelpRequest } from "@hooma/contracts/requests";

type RequesterPresentation = NonNullable<HelpRequest["requester"]>;

export function RequestRequester({
  requester,
}: {
  readonly requester: RequesterPresentation | null | undefined;
}) {
  if (!requester) return null;

  const initial = requester.displayName.trim().charAt(0).toUpperCase() || "H";

  return (
    <a className="request-requester" href={`/profile/${encodeURIComponent(requester.username)}`}>
      <span className="request-requester__avatar" aria-hidden="true">
        {requester.photoUrl ? (
          <img src={requester.photoUrl} alt="" loading="lazy" />
        ) : (
          <span>{initial}</span>
        )}
      </span>
      <span className="request-requester__copy">
        <strong>{requester.displayName}</strong>
        <span>@{requester.username}</span>
      </span>
    </a>
  );
}
