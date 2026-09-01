import { useState, type ReactNode } from "react";

export type HoomaNowUrgency =
  | "LIVE_NOW"
  | "JUST_STARTED"
  | "ACTIVE"
  | "STARTING_SOON"
  | "ENDING_SOON"
  | "FINAL_MINUTES"
  | "UPCOMING";

export interface HoomaNowFeedItem {
  readonly id: string;
  readonly href?: string;
  readonly title: string;
  readonly summary: string | null;
  readonly sourceLabel: string;
  readonly urgency: HoomaNowUrgency;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly occurredAt: string | null;
  readonly context: {
    readonly communityName: string | null;
    readonly city: string | null;
    readonly houma: string | null;
  };
  readonly detailRows?: readonly string[];
  readonly actionLabel?: string;
  readonly expansion?: ReactNode;
}

export interface HoomaNowFeedProps {
  readonly items: readonly HoomaNowFeedItem[];
}

const urgencyPresentation: Readonly<
  Record<HoomaNowUrgency, { label: string; tone: "green" | "orange" | "gold" }>
> = {
  LIVE_NOW: { label: "LIVE NOW", tone: "green" },
  JUST_STARTED: { label: "JUST STARTED", tone: "green" },
  ACTIVE: { label: "ACTIVE", tone: "green" },
  STARTING_SOON: { label: "STARTING SOON", tone: "gold" },
  ENDING_SOON: { label: "ENDING SOON", tone: "orange" },
  FINAL_MINUTES: { label: "FINAL MINUTES", tone: "orange" },
  UPCOMING: { label: "UPCOMING", tone: "gold" },
};

function contextLabel(item: HoomaNowFeedItem): string | null {
  return item.context.communityName ?? item.context.houma ?? item.context.city;
}

function timeLabel(item: HoomaNowFeedItem): string | null {
  const value = item.startsAt ?? item.occurredAt;
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function FeedCardBody({
  item,
  action,
}: {
  readonly item: HoomaNowFeedItem;
  readonly action: ReactNode;
}) {
  const presentation = urgencyPresentation[item.urgency];
  const place = contextLabel(item);
  const time = timeLabel(item);

  return (
    <span className="hooma-now-card__body">
      <span className="hooma-now-card__top">
        <span className="hooma-now-card__source">
          {place ? `${place} · ${item.sourceLabel}` : item.sourceLabel}
        </span>
        <span className="hooma-now-card__status">
          <span className="hooma-now-card__dot" aria-hidden="true" />
          {presentation.label}
        </span>
      </span>
      <h3 className="hooma-now-card__title">{item.title}</h3>
      {item.summary ? <p className="hooma-now-card__summary">{item.summary}</p> : null}
      {time ? (
        <span className="hooma-now-card__meta">
          <span>{time}</span>
        </span>
      ) : null}
      {item.detailRows?.length ? (
        <span className="hooma-now-card__ride-meta">
          {item.detailRows.map((row) => (
            <span key={row}>{row}</span>
          ))}
        </span>
      ) : null}
      {action}
    </span>
  );
}

export function HoomaNowFeed({ items }: HoomaNowFeedProps) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  return (
    <div className="hooma-now-list">
      {items.map((item) => {
        const presentation = urgencyPresentation[item.urgency];
        const expanded = expandedItemId === item.id;

        if (item.expansion) {
          return (
            <article className="hooma-now-card" data-tone={presentation.tone} key={item.id}>
              <span className="hooma-now-card__rail" aria-hidden="true" />
              <span className="hooma-now-card__interactive">
                <FeedCardBody
                  item={item}
                  action={
                    <button
                      className="hooma-now-card__cta hooma-now-card__cta-button"
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedItemId(expanded ? null : item.id)}
                    >
                      {expanded ? "Close ride request" : (item.actionLabel ?? "View activity")}
                    </button>
                  }
                />
                {expanded ? (
                  <div className="hooma-now-card__expansion">{item.expansion}</div>
                ) : null}
              </span>
            </article>
          );
        }

        if (!item.href) {
          return (
            <article className="hooma-now-card" data-tone={presentation.tone} key={item.id}>
              <span className="hooma-now-card__rail" aria-hidden="true" />
              <FeedCardBody item={item} action={null} />
            </article>
          );
        }

        return (
          <a
            className="hooma-now-card"
            data-tone={presentation.tone}
            href={item.href}
            key={item.id}
          >
            <span className="hooma-now-card__rail" aria-hidden="true" />
            <FeedCardBody
              item={item}
              action={
                <span className="hooma-now-card__cta">{item.actionLabel ?? "Open activity ↗"}</span>
              }
            />
          </a>
        );
      })}
    </div>
  );
}
