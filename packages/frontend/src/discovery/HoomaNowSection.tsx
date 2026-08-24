import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiscoveryNowItem } from "@hooma/contracts/discovery";
import { HoomaNowFeed } from "@hooma/ui";
import { useHoomaFrontend } from "../context";
import { createDiscoveryApi } from "./api";

function messageFrom(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unable to load live activity";
}

export function HoomaNowSection() {
  const { transport } = useHoomaFrontend();
  const discoveryApi = useMemo(() => createDiscoveryApi(transport), [transport]);
  const [items, setItems] = useState<DiscoveryNowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refreshSeconds = useRef(30);

  const load = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const response = await discoveryApi.now(30);
        setItems(response.items);
        refreshSeconds.current = response.refreshAfterSeconds;
        setError("");
      } catch (reason) {
        setError(messageFrom(reason));
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [discoveryApi],
  );

  useEffect(() => {
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
  }, [load]);

  return (
    <section className="hooma-now" aria-labelledby="hooma-now-title">
      <header className="hooma-now__header">
        <div>
          <p className="hooma-now__eyebrow">LIVE AROUND YOU</p>
          <h2 id="hooma-now-title" className="hooma-now__title">
            HOOMA NOW
          </h2>
          <p className="hooma-now__intro">What’s happening across HOOMA right now.</p>
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
