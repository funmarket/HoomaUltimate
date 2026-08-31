export function RideSectionHeader({
  eyebrow,
  title,
  body,
  actionHref,
  actionLabel,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly actionHref?: string;
  readonly actionLabel?: string;
}) {
  return (
    <header className="ride-section-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
      {actionHref && actionLabel ? (
        <a className="ride-button ride-button--primary" href={actionHref}>
          {actionLabel}
        </a>
      ) : null}
    </header>
  );
}
