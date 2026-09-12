import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { WhistleListItem } from "../api";

type WhistleRoomProps = {
  readonly items: readonly WhistleListItem[];
  readonly loading?: boolean;
  readonly emptyText: string;
  readonly hasOlder?: boolean;
  readonly loadingOlder?: boolean;
  readonly onLoadOlder?: () => void;
};

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

export function WhistleRoom({
  items,
  loading = false,
  emptyText,
  hasOlder = false,
  loadingOlder = false,
  onLoadOlder,
}: WhistleRoomProps) {
  const roomRef = useRef<HTMLDivElement>(null);
  const wasPinnedRef = useRef(true);
  const previousLastIdRef = useRef<string | null>(null);
  const previousFirstIdRef = useRef<string | null>(null);
  const previousScrollHeightRef = useRef(0);
  const [showLatest, setShowLatest] = useState(false);

  const chronologicalItems = useMemo(
    () =>
      [...items].sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
      ),
    [items],
  );
  const firstId = chronologicalItems[0]?.id ?? null;
  const lastId = chronologicalItems.at(-1)?.id ?? null;

  function scrollToLatest(behavior: ScrollBehavior = "smooth") {
    const room = roomRef.current;
    if (!room) return;
    room.scrollTo({ top: room.scrollHeight, behavior });
    wasPinnedRef.current = true;
    setShowLatest(false);
  }

  useLayoutEffect(() => {
    const room = roomRef.current;
    if (!room) return;
    const prependedOlderHistory =
      previousFirstIdRef.current !== null &&
      firstId !== previousFirstIdRef.current &&
      lastId === previousLastIdRef.current;
    if (prependedOlderHistory) {
      room.scrollTop += room.scrollHeight - previousScrollHeightRef.current;
    }
    previousFirstIdRef.current = firstId;
    previousScrollHeightRef.current = room.scrollHeight;
  }, [firstId, lastId, hasOlder]);

  useLayoutEffect(() => {
    if (!lastId) {
      previousLastIdRef.current = null;
      return;
    }

    const isFirstLoadedMessage = previousLastIdRef.current === null;
    const hasNewMessage =
      previousLastIdRef.current !== null && previousLastIdRef.current !== lastId;

    if (isFirstLoadedMessage || (hasNewMessage && wasPinnedRef.current)) {
      scrollToLatest(isFirstLoadedMessage ? "auto" : "smooth");
    } else if (hasNewMessage) {
      setShowLatest(true);
    }

    previousLastIdRef.current = lastId;
  }, [lastId]);

  function onScroll() {
    const room = roomRef.current;
    if (!room) return;
    const distanceFromBottom = room.scrollHeight - room.scrollTop - room.clientHeight;
    const pinned = distanceFromBottom <= 48;
    wasPinnedRef.current = pinned;
    if (pinned) setShowLatest(false);
  }

  return (
    <div className="whistle-room-shell">
      <div
        ref={roomRef}
        className="whistle-room"
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {hasOlder && onLoadOlder ? (
          <button
            className="whistle-room__older"
            type="button"
            disabled={loadingOlder}
            onClick={onLoadOlder}
          >
            {loadingOlder ? "Loading older…" : "↑ Load older"}
          </button>
        ) : null}
        {loading ? <div className="whistle-room-state">Listening for Whistles…</div> : null}
        {!loading && !chronologicalItems.length ? (
          <div className="whistle-room-state">{emptyText}</div>
        ) : null}
        {chronologicalItems.map((whistle) => {
          const presentation = whistle.author?.presentation;
          const author = authorName(whistle);
          return (
            <article className="whistle-message" key={whistle.id}>
              <div className="whistle-message__avatar" aria-hidden="true">
                {presentation?.photoUrl ? (
                  <img src={presentation.photoUrl} alt="" />
                ) : (
                  <span>{authorInitials(whistle)}</span>
                )}
              </div>
              <div className="whistle-message__content">
                <div className="whistle-message__meta">
                  {presentation?.username ? (
                    <a
                      className="whistle-message__author"
                      href={`/profile/${encodeURIComponent(presentation.username)}`}
                    >
                      {author}
                    </a>
                  ) : (
                    <strong>{author}</strong>
                  )}
                  <time dateTime={whistle.createdAt}>{relativeTime(whistle.createdAt)}</time>
                </div>
                <p className="whistle-message__body">{whistle.body}</p>
              </div>
            </article>
          );
        })}
      </div>
      {showLatest ? (
        <button className="whistle-room__latest" type="button" onClick={() => scrollToLatest()}>
          ↓ Latest
        </button>
      ) : null}
    </div>
  );
}
