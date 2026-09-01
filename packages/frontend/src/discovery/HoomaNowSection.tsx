import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { DiscoveryNowItem } from "@hooma/contracts/discovery";
import type { RideRequestCommunityFeedItem } from "@hooma/contracts/rides";
import type { RideRequestCommunityInteraction } from "@hooma/contracts/ride-community-interaction";
import { HoomaNowFeed, type HoomaNowFeedItem } from "@hooma/ui";
import { useHoomaFrontend } from "../context";
import { createRideApi } from "../rides/api";
import { getRideRequestCommunityInteraction } from "../rides/community-interaction-api";
import { destinationLabel } from "../rides/ride-view-model";
import { minorUnitsToAmountLabel } from "../rides/ride-money";
import { sendDirectUserWhistle } from "../whistle/direct-user-api";
import { createDiscoveryApi } from "./api";

const WHISTLE_MAX_GRAPHEMES = 33;

function messageFrom(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unable to load live activity";
}

function filterLiveRideItems(
  items: readonly RideRequestCommunityFeedItem[],
  now = new Date(),
): RideRequestCommunityFeedItem[] {
  const nowMs = now.getTime();
  return items.filter(
    (item) => item.status === "OPEN" && new Date(item.expiresAt).getTime() > nowMs,
  );
}

function compensationLabel(item: RideRequestCommunityFeedItem): string {
  if (item.compensationTerms.type === "FREE") return "FREE";
  return `CASH ${minorUnitsToAmountLabel(
    item.compensationTerms.amountMinor,
    item.compensationTerms.currency,
  )}`;
}

function rideTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "time to confirm";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function rideSummary(item: RideRequestCommunityFeedItem): string {
  return [
    `Pickup: ${item.pickupAreaLabel}`,
    `Depart: ${rideTimeLabel(item.desiredDepartureAt)}`,
    `${item.passengerCount} passenger${item.passengerCount === 1 ? "" : "s"}`,
    compensationLabel(item),
  ].join(" · ");
}

function rideTimeRemaining(item: RideRequestCommunityFeedItem, now = new Date()): string {
  const remainingMs = new Date(item.expiresAt).getTime() - now.getTime();
  if (remainingMs <= 0) return "expired";
  const minutes = Math.ceil(remainingMs / 60000);
  if (minutes < 60) return `${minutes} min remaining`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hr remaining`;
}

function graphemeCount(value: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(value)).length;
}

function requesterInitials(interaction: RideRequestCommunityInteraction): string {
  const label =
    interaction.requester?.displayName || interaction.requester?.username || "Ride requester";
  return (
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "R"
  );
}

function CommunityRideRequestExpansion({
  communityId,
  item,
}: {
  readonly communityId: string;
  readonly item: RideRequestCommunityFeedItem;
}) {
  const { transport, protectedError } = useHoomaFrontend();
  const [interaction, setInteraction] = useState<RideRequestCommunityInteraction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const count = graphemeCount(body);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getRideRequestCommunityInteraction(transport, communityId, item.id)
      .then((response) => {
        if (active) setInteraction(response);
      })
      .catch((reason) => {
        if (active) setError(protectedError(reason, "Unable to open this Ride request"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [communityId, item.id, protectedError, transport]);

  async function submitWhistle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requester = interaction?.requester;
    if (!requester || !interaction.canWhistle || !body.trim() || count > WHISTLE_MAX_GRAPHEMES) {
      return;
    }
    setSending(true);
    setError("");
    setNotice("");
    try {
      await sendDirectUserWhistle(transport, requester.username, body.trim());
      setBody("");
      setNotice(`Whistle sent to ${requester.displayName}.`);
    } catch (reason) {
      setError(protectedError(reason, "Could not send Whistle"));
    } finally {
      setSending(false);
    }
  }

  if (loading) return <p className="hooma-now-ride-detail__state">Loading requester…</p>;
  if (error && !interaction)
    return <p className="hooma-now-ride-detail__state is-error">{error}</p>;

  const requester = interaction?.requester ?? null;

  return (
    <div className="hooma-now-ride-detail">
      <div className="hooma-now-ride-detail__requester">
        {requester?.photoUrl ? (
          <img src={requester.photoUrl} alt="" />
        ) : (
          <span className="hooma-now-ride-detail__avatar" aria-hidden="true">
            {interaction ? requesterInitials(interaction) : "R"}
          </span>
        )}
        <div>
          <small>REQUESTED BY</small>
          {requester ? (
            <>
              <strong>{requester.displayName}</strong>
              <a href={`/profile/${encodeURIComponent(requester.username)}`}>
                @{requester.username}
              </a>
            </>
          ) : (
            <strong>Requester profile unavailable</strong>
          )}
        </div>
      </div>

      <dl className="hooma-now-ride-detail__facts">
        <div>
          <dt>Pickup</dt>
          <dd>{item.pickupAreaLabel}</dd>
        </div>
        <div>
          <dt>Departure</dt>
          <dd>{rideTimeLabel(item.desiredDepartureAt)}</dd>
        </div>
        <div>
          <dt>Passengers</dt>
          <dd>{item.passengerCount}</dd>
        </div>
        <div>
          <dt>Terms</dt>
          <dd>{compensationLabel(item)}</dd>
        </div>
      </dl>

      {item.note ? <p className="hooma-now-ride-detail__note">{item.note}</p> : null}

      {interaction && !interaction.canWhistle ? (
        <p className="hooma-now-ride-detail__state">This is your Ride request.</p>
      ) : null}

      {interaction?.canWhistle && requester ? (
        <form className="hooma-now-ride-detail__whistle" onSubmit={submitWhistle}>
          <label>
            <span>Whistle {requester.displayName}</span>
            <div className="hooma-now-ride-detail__whistle-row">
              <input
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="I can help with this ride"
                aria-describedby={`ride-whistle-count-${item.id}`}
              />
              <button
                className="button"
                type="submit"
                disabled={!body.trim() || count > WHISTLE_MAX_GRAPHEMES || sending}
              >
                {sending ? "Sending…" : "Whistle"}
              </button>
            </div>
          </label>
          <small
            id={`ride-whistle-count-${item.id}`}
            className={count > WHISTLE_MAX_GRAPHEMES ? "is-over" : ""}
          >
            {count}/{WHISTLE_MAX_GRAPHEMES} graphemes
          </small>
        </form>
      ) : null}

      {notice ? <p className="hooma-now-ride-detail__state is-success">{notice}</p> : null}
      {error && interaction ? (
        <p className="hooma-now-ride-detail__state is-error">{error}</p>
      ) : null}
    </div>
  );
}

function rideToHoomaNowItem(
  item: RideRequestCommunityFeedItem,
  communityId: string,
): HoomaNowFeedItem {
  return {
    id: `ride-request-${item.id}`,
    title: `NEEDS A RIDE · ${destinationLabel(item.destination)}`,
    summary: rideSummary(item),
    sourceLabel: "Ride",
    urgency: "ACTIVE",
    startsAt: item.desiredDepartureAt,
    endsAt: item.expiresAt,
    occurredAt: item.createdAt,
    context: {
      communityName: null,
      city: null,
      houma: null,
    },
    detailRows: [
      `Request ID ${item.id}`,
      rideTimeRemaining(item),
      item.note ? `Note: ${item.note}` : "Public pickup area only",
    ],
    actionLabel: "View ride request",
    expansion: <CommunityRideRequestExpansion communityId={communityId} item={item} />,
  };
}

function nextRideExpiryDelay(items: readonly RideRequestCommunityFeedItem[]): number | null {
  const now = Date.now();
  const nextExpiry = items
    .map((item) => new Date(item.expiresAt).getTime())
    .filter((time) => Number.isFinite(time) && time > now)
    .sort((left, right) => left - right)[0];
  if (!nextExpiry) return null;
  return Math.max(1000, nextExpiry - now + 250);
}

export function HoomaNowSection() {
  const { api, transport } = useHoomaFrontend();
  const discoveryApi = useMemo(() => createDiscoveryApi(transport), [transport]);
  const [items, setItems] = useState<DiscoveryNowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [focusCommunityId, setFocusCommunityId] = useState<string | undefined>();
  const [focusReady, setFocusReady] = useState(false);
  const refreshSeconds = useRef(30);

  useEffect(() => {
    let active = true;
    void api.identity
      .meOptional()
      .then((me) => {
        if (active) setFocusCommunityId(me?.communities[0]?.id);
      })
      .catch(() => {
        if (active) setFocusCommunityId(undefined);
      })
      .finally(() => {
        if (active) setFocusReady(true);
      });
    return () => {
      active = false;
    };
  }, [api]);

  const load = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const response = await discoveryApi.now(30, focusCommunityId);
        setItems(response.items);
        refreshSeconds.current = response.refreshAfterSeconds;
        setError("");
      } catch (reason) {
        setError(messageFrom(reason));
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [discoveryApi, focusCommunityId],
  );

  useEffect(() => {
    if (!focusReady) return;
    let active = true;
    let timer = 0;

    const refresh = async (showLoading = false) => {
      if (!active) return;
      await load(showLoading);
      if (!active) return;
      timer = window.setTimeout(() => {
        if (document.visibilityState === "visible") void refresh(false);
        else timer = window.setTimeout(() => void refresh(false), refreshSeconds.current * 1000);
      }, refreshSeconds.current * 1000);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void load(false);
    };

    void refresh(true);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [focusReady, load]);

  return (
    <section className="hooma-now" aria-labelledby="hooma-now-title">
      <header className="hooma-now__header">
        <div>
          <p className="hooma-now__eyebrow">LIVE AROUND YOU</p>
          <h2 id="hooma-now-title" className="hooma-now__title">
            HOOMA NOW
          </h2>
          <p className="hooma-now__intro">
            {focusCommunityId
              ? "Your HOOMA first, then what’s happening across HOOMA right now."
              : "What’s happening across HOOMA right now."}
          </p>
        </div>
        <span className="hooma-now__live" aria-label="Live activity feed">
          <span aria-hidden="true" /> LIVE
        </span>
      </header>

      {loading ? <p className="hooma-now__state">Finding what’s happening now…</p> : null}
      {!loading && error && items.length === 0 ? (
        <div className="hooma-now__state hooma-now__state--error" role="status">
          <p>{error}</p>
          <button type="button" onClick={() => void load(true)}>
            Try again
          </button>
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="hooma-now__state">Nothing urgent is happening right now. Check back soon.</p>
      ) : null}
      {items.length > 0 ? <HoomaNowFeed items={items} /> : null}
      {error && items.length > 0 ? (
        <p className="hooma-now__refresh-warning" role="status">
          Live refresh paused. Showing the latest activity we have.
        </p>
      ) : null}
    </section>
  );
}

export function CommunityHoomaNowSection({ communityId }: { readonly communityId: string }) {
  const { transport, protectedError } = useHoomaFrontend();
  const rideApi = useMemo(() => createRideApi(transport), [transport]);
  const [rideItems, setRideItems] = useState<RideRequestCommunityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const visibleRideItems = useMemo(() => filterLiveRideItems(rideItems), [rideItems]);
  const feedItems = useMemo(
    () => visibleRideItems.map((item) => rideToHoomaNowItem(item, communityId)),
    [communityId, visibleRideItems],
  );

  const load = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const response = await rideApi.listCommunityRequests(communityId, { limit: 30 });
        setRideItems(filterLiveRideItems(response.items));
        setError("");
      } catch (reason) {
        setError(protectedError(reason, "Unable to load HOOMA NOW"));
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [communityId, protectedError, rideApi],
  );

  useEffect(() => {
    let active = true;
    let timer = 0;
    const refresh = async (showLoading = false) => {
      if (!active) return;
      await load(showLoading);
      if (!active) return;
      timer = window.setTimeout(() => void refresh(false), 30000);
    };
    void refresh(true);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useEffect(() => {
    const delay = nextRideExpiryDelay(visibleRideItems);
    if (!delay) return;
    const timer = window.setTimeout(() => {
      setRideItems((current) => filterLiveRideItems(current));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [visibleRideItems]);

  return (
    <section className="hooma-now hooma-now--community" aria-labelledby="community-hooma-now-title">
      <header className="hooma-now__header">
        <div>
          <p className="hooma-now__eyebrow">MEMBERS LIVE FEED</p>
          <h2 id="community-hooma-now-title" className="hooma-now__title">
            HOOMA NOW
          </h2>
          <p className="hooma-now__intro">
            Active Ride requests shared with this HOOMA appear here while open and unexpired.
          </p>
        </div>
        <span className="hooma-now__live" aria-label="Live community activity feed">
          <span aria-hidden="true" /> LIVE
        </span>
      </header>

      {loading ? <p className="hooma-now__state">Finding live HOOMA activity…</p> : null}
      {!loading && error && feedItems.length === 0 ? (
        <div className="hooma-now__state hooma-now__state--error" role="status">
          <p>{error}</p>
          <button type="button" onClick={() => void load(true)}>
            Try again
          </button>
        </div>
      ) : null}
      {!loading && !error && feedItems.length === 0 ? (
        <p className="hooma-now__state">No live Ride requests in HOOMA NOW right now.</p>
      ) : null}
      {feedItems.length > 0 ? <HoomaNowFeed items={feedItems} /> : null}
      {error && feedItems.length > 0 ? (
        <p className="hooma-now__refresh-warning" role="status">
          Live refresh paused. Showing the latest activity we have.
        </p>
      ) : null}
    </section>
  );
}
