import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  createProfileApi,
  useHoomaFrontend,
  type WhistleList,
  type WhistleListItem,
} from "@hooma/frontend";

const MAX_GRAPHEMES = 33;

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

export function UserWhistlePanel({
  username,
  recipientName,
}: {
  readonly username: string;
  readonly recipientName: string;
}) {
  const { api, transport, protectedError } = useHoomaFrontend();
  const profileApi = useMemo(() => createProfileApi(transport), [transport]);
  const [isSelf, setIsSelf] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<WhistleList>({
    items: [],
    remainingToday: 11,
    resetsAt: "",
  });
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const count = graphemeCount(body);

  useEffect(() => {
    let active = true;
    void api.identity
      .meOptional()
      .then((me) => {
        if (active) setIsSelf(me?.presentation.username === username);
      })
      .catch(() => {
        if (active) setIsSelf(false);
      });
    return () => {
      active = false;
    };
  }, [api, username]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFeed(await profileApi.directWhistles(username));
      setError("");
    } catch (reason) {
      setError(protectedError(reason, "Could not load direct Whistles"));
    } finally {
      setLoading(false);
    }
  }, [profileApi, protectedError, username]);

  async function openPanel() {
    setOpen(true);
    await load();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !body.trim() ||
      count > MAX_GRAPHEMES ||
      sending ||
      feed.remainingToday <= 0
    )
      return;
    setSending(true);
    setError("");
    try {
      await profileApi.sendDirectWhistle(username, body);
      setBody("");
      await load();
    } catch (reason) {
      setError(protectedError(reason, "Could not send Whistle"));
    } finally {
      setSending(false);
    }
  }

  if (isSelf !== false) return null;

  if (!open) {
    return (
      <div className="profile-edit-form profile-inline-state">
        <span className="muted">
          Send a short private signal that disappears at the UTC reset.
        </span>
        <button type="button" onClick={() => void openPanel()}>
          Open Whistle
        </button>
      </div>
    );
  }

  return (
    <div
      className="profile-edit-form"
      aria-label={`Direct Whistle with ${recipientName}`}
    >
      <div className="profile-inline-state" aria-live="polite">
        {loading ? <span className="muted">Listening for Whistles…</span> : null}
        {!loading && !feed.items.length ? (
          <span className="muted">No Whistles between you today.</span>
        ) : null}
        {feed.items.map((whistle) => (
          <div key={whistle.id}>
            <strong>{authorName(whistle)}</strong>
            <p>{whistle.body}</p>
          </div>
        ))}
      </div>

      <form onSubmit={submit}>
        <label>
          <span>Whistle {recipientName}</span>
          <input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={`Whistle ${recipientName}`}
            aria-describedby="user-whistle-count"
          />
        </label>
        <small
          id="user-whistle-count"
          className={count > MAX_GRAPHEMES ? "is-over" : ""}
        >
          {count}/{MAX_GRAPHEMES} graphemes · {feed.remainingToday}/11 left today
        </small>
        <button
          type="submit"
          disabled={
            !body.trim() || count > MAX_GRAPHEMES || sending || feed.remainingToday <= 0
          }
        >
          {sending ? "Sending…" : "Whistle"}
        </button>
      </form>

      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
