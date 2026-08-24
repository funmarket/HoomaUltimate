import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useHoomaFrontend } from "../context";
import type { WhistleList, WhistleListItem } from "../api";

const MAX_GRAPHEMES = 33;
const REFRESH_INTERVAL_MS = 10_000;

function graphemeCount(value: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(value)).length;
}

function authorName(whistle: WhistleListItem): string {
  return (
    whistle.author?.presentation?.displayName ||
    whistle.author?.presentation?.username ||
    "HOOMA member"
  );
}

function authorInitials(whistle: WhistleListItem): string {
  return (
    authorName(whistle)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "H"
  );
}

function relativeTime(value: string): string {
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (deltaSeconds < 60) return "just now";
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function resetLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "00:00 UTC"
    : new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      }).format(date);
}

export function HoomaWhistleBoard({ communityId }: { readonly communityId: string }) {
  const { api, protectedError } = useHoomaFrontend();
  const [feed, setFeed] = useState<WhistleList>({ items: [], remainingToday: 11, resetsAt: "" });
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const count = graphemeCount(body);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const next = await api.whistles.community(communityId);
        setFeed(next);
        setError("");
      } catch (reason) {
        setError(protectedError(reason, "Could not load Whistles"));
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [api, communityId, protectedError],
  );

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || count > MAX_GRAPHEMES || sending || feed.remainingToday <= 0) return;
    setSending(true);
    setError("");
    try {
      await api.whistles.sendToCommunity(communityId, body);
      setBody("");
      await load(true);
    } catch (reason) {
      setError(protectedError(reason, "Could not send Whistle"));
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="panel hooma-hq-module whistle-module hooma-whistle-board">
      <div className="whistle-heading">
        <div>
          <span className="eyebrow">PRIVATE · MEMBERS ONLY</span>
          <h2>Whistle Board</h2>
        </div>
        <span className="whistle-quota">
          <strong>{feed.remainingToday}</strong>/11 left today
        </span>
      </div>
      <p className="whistle-rule">
        33 graphemes per Whistle. Every member starts fresh with 11 at 00:00 UTC. Today's Whistles
        disappear at the same reset.
      </p>
      {feed.resetsAt ? (
        <small className="muted">Next reset: {resetLabel(feed.resetsAt)}</small>
      ) : null}

      <form className="whistle-composer" onSubmit={submit}>
        <label>
          <span>Send a signal</span>
          <div className="whistle-input-row">
            <input
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Pitch at 7? ⚽"
              aria-describedby="whistle-count"
            />
            <button
              className="button"
              type="submit"
              disabled={
                !body.trim() || count > MAX_GRAPHEMES || sending || feed.remainingToday <= 0
              }
            >
              {sending ? "Sending…" : "Whistle"}
            </button>
          </div>
        </label>
        <small id="whistle-count" className={count > MAX_GRAPHEMES ? "is-over" : ""}>
          {count}/{MAX_GRAPHEMES} graphemes
        </small>
      </form>

      {error ? <div className="error-box">{error}</div> : null}
      {loading ? <div className="whistle-empty">Listening for Whistles…</div> : null}
      {!loading && !feed.items.length ? (
        <div className="whistle-empty">
          <strong>Quiet in the HOOMA.</strong>
          <span>Be the first to send a short signal today.</span>
        </div>
      ) : null}

      {feed.items.length ? (
        <div className="whistle-list">
          {feed.items.map((whistle) => {
            const presentation = whistle.author?.presentation;
            return (
              <div className="whistle-card is-revealed" key={whistle.id}>
                <div className="whistle-author">
                  {presentation?.photoUrl ? (
                    <img src={presentation.photoUrl} alt="" />
                  ) : (
                    <span>{authorInitials(whistle)}</span>
                  )}
                  <div>
                    <strong>{authorName(whistle)}</strong>
                    <small>{relativeTime(whistle.createdAt)}</small>
                  </div>
                </div>
                <div className="whistle-body-zone">
                  <p className="whistle-body">{whistle.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
