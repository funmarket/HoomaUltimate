import type { HelpRequest } from "@hooma/contracts/requests";

type RequesterPresentation = NonNullable<HelpRequest["requester"]>;

export function RequestProfileLink({
  presentation,
}: {
  readonly presentation: RequesterPresentation | null | undefined;
}) {
  if (!presentation) return null;

  const initial = presentation.displayName.trim().charAt(0).toUpperCase() || "H";

  return (
    <a className="request-requester" href={`/profile/${encodeURIComponent(presentation.username)}`}>
      <span className="request-requester__avatar" aria-hidden="true">
        {presentation.photoUrl ? (
          <img src={presentation.photoUrl} alt="" loading="lazy" />
        ) : (
          <span>{initial}</span>
        )}
      </span>
      <span className="request-requester__copy">
        <strong>{presentation.displayName}</strong>
        <span>@{presentation.username}</span>
      </span>
    </a>
  );
}

export function RequestRequester({
  requester,
}: {
  readonly requester: RequesterPresentation | null | undefined;
}) {
  return <RequestProfileLink presentation={requester} />;
}
