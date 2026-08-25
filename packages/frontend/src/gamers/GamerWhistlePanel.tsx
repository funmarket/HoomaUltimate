import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { WhistleList, WhistleListItem } from "../api";
import { useHoomaFrontend } from "../context";
import { listGamerWhistles, sendGamerWhistle } from "./gamer-whistle-api";

const MAX_GRAPHEMES = 33;

function graphemeCount(value: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(value)).length;
}

function authorName(whistle: WhistleListItem): string {
  return (
    whistle.author?.presentation?.displayName ||
    whistle.author?.presentation?.username ||
    "HOOMA gamer"
  );
}

export function GamerWhistlePanel({
  otherProfileId,
  recipientName,
  onClose,
}: {
  readonly otherProfileId: string;
  readonly recipientName: string;
  readonly onClose: () => void;
}) {
  const { transport, protectedError } = useHoomaFrontend();
  const [feed, setFeed] = useState<WhistleList>({
    items: [],
    remainingToday: 11,
    resetsAt: "",
  });
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const count = graphemeCount(body);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFeed(await listGamerWhistles(transport, otherProfileId));
      setError("");
    } catch (reason) {
      setError(protectedError(reason, "Could not load Gamer Whistles"));
    } finally {
      setLoading(false);
    }
  }, [otherProfileId, protectedError, transport]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || count > MAX_GRAPHEMES || sending || feed.remainingToday <= 0) return;
    setSending(true);
    setError("");
    try {
      await sendGamerWhistle(transport, otherProfileId, body);
      setBody("");
      await load();
    } catch (reason) {
      setError(protectedError(reason, "Could not send Gamer Whistle"));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="gamer-whistle-panel" aria-label={`Whistle ${recipientName}`}>
      <div className="gamer-whistle-panel-heading">
        <div>
          <span>DIRECT WHISTLE</span>
          <strong>{recipientName}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Whistle composer">
          ×
        </button>
      </div>

      <div className="gamer-whistle-feed" aria-live="polite">
        {loading ? <small>Listening…</small> : null}
        {!loading && !feed.items.length ? (
          <small>No Whistles between you today.</small>
        ) : null}
        {feed.items.slice(0, 4).map((whistle) => (
          <div className="gamer-whistle-message" key={whistle.id}>
            <strong>{authorName(whistle)}</strong>
            <p>{whistle.body}</p>
          </div>
        ))}
      </div>

      <form className="gamer-whistle-composer" onSubmit={submit}>
        <div className="gamer-whistle-input-row">
          <input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={`Whistle ${recipientName}`}
            aria-label={`Whistle ${recipientName}`}
          />
          <button
            type="submit"
            disabled={
              !body.trim() || count > MAX_GRAPHEMES || sending || feed.remainingToday <= 0
            }
          >
            {sending ? "..." : "SEND"}
          </button>
        </div>
        <small className={count > MAX_GRAPHEMES ? "is-over" : ""}>
          {count}/{MAX_GRAPHEMES} · {feed.remainingToday}/11 left today
        </small>
      </form>

      {error ? <div className="gamer-whistle-error">{error}</div> : null}
    </section>
  );
}
