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
  readonly href: string;
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

const STYLES = `
.hooma-now-list { display: grid; gap: 12px; }
.hooma-now-card {
  --now-accent: #d8b56a;
  position: relative;
  display: grid;
  grid-template-columns: 5px minmax(0, 1fr);
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(199, 163, 88, .34);
  border-radius: 18px;
  background: linear-gradient(145deg, rgba(18,18,14,.98), rgba(6,7,5,.98));
  color: #f5efe0;
  text-decoration: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 12px 28px rgba(0,0,0,.24);
  transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
}
.hooma-now-card[data-tone="green"] { --now-accent: #99ff18; }
.hooma-now-card[data-tone="orange"] { --now-accent: #ff9d2e; }
.hooma-now-card:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--now-accent) 55%, #7f6a3d); }
.hooma-now-card:focus-visible { outline: 2px solid var(--now-accent); outline-offset: 3px; }
.hooma-now-card__rail { background: var(--now-accent); box-shadow: 0 0 18px color-mix(in srgb, var(--now-accent) 44%, transparent); }
.hooma-now-card__body { min-width: 0; padding: 15px 16px 16px; }
.hooma-now-card__top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 9px; }
.hooma-now-card__source {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #b9aa87;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .11em;
  text-transform: uppercase;
}
.hooma-now-card__status {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 1px solid color-mix(in srgb, var(--now-accent) 48%, transparent);
  border-radius: 999px;
  color: var(--now-accent);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .08em;
}
.hooma-now-card__dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; box-shadow: 0 0 10px currentColor; }
.hooma-now-card[data-tone="green"] .hooma-now-card__dot,
.hooma-now-card[data-tone="orange"] .hooma-now-card__dot { animation: hooma-now-pulse 1.9s ease-in-out infinite; }
.hooma-now-card__title { margin: 0; color: #fffaf0; font-size: clamp(18px, 4.8vw, 23px); line-height: 1.05; letter-spacing: -.025em; }
.hooma-now-card__summary { margin: 6px 0 0; color: #a9a69c; font-size: 14px; line-height: 1.35; }
.hooma-now-card__meta { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-top: 12px; color: #d9cfba; font-size: 13px; }
.hooma-now-card__meta span::before { content: '•'; margin-right: 6px; color: var(--now-accent); }
.hooma-now-card__cta { display: inline-flex; margin-top: 13px; color: var(--now-accent); font-size: 13px; font-weight: 800; letter-spacing: .02em; }
@keyframes hooma-now-pulse { 0%,100% { opacity: .68; transform: scale(.9); } 50% { opacity: 1; transform: scale(1.15); } }
@media (prefers-reduced-motion: reduce) {
  .hooma-now-card, .hooma-now-card__dot { transition: none; animation: none !important; }
}
`;

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

export function HoomaNowFeed({ items }: HoomaNowFeedProps) {
  return (
    <>
      <style>{STYLES}</style>
      <div className="hooma-now-list">
        {items.map((item) => {
          const presentation = urgencyPresentation[item.urgency];
          const place = contextLabel(item);
          const time = timeLabel(item);
          return (
            <a className="hooma-now-card" data-tone={presentation.tone} href={item.href} key={item.id}>
              <span className="hooma-now-card__rail" aria-hidden="true" />
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
                <span className="hooma-now-card__cta">Open activity ↗</span>
              </span>
            </a>
          );
        })}
      </div>
    </>
  );
}
