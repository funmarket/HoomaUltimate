import { useEffect, useMemo, useState } from "react";
import type { PublicPitch } from "@hooma/contracts/pitch";
import { useHoomaFrontend } from "../context";
import { createPitchApi } from "./api";
import { PitchTicket } from "./PitchTicket";

type PitchSource = "OWNER" | "FANHUB" | "LEGACY";

export function PitchPage() {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createPitchApi(transport), [transport]);
  const [items, setItems] = useState<PublicPitch[]>([]);
  const [activeSource, setActiveSource] = useState<PitchSource>("OWNER");
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    void api
      .list()
      .then(setItems)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load Pitch"),
      );
  }, [api]);

  const grouped = useMemo(
    () => ({
      OWNER: items.filter((item) => item.place.submissionOrigin === "OWNER"),
      FANHUB: items.filter((item) => item.place.submissionOrigin === "FANHUB"),
      LEGACY: items.filter((item) => item.place.submissionOrigin == null),
    }),
    [items],
  );

  const visibleItems = grouped[activeSource];

  const sourceSummary =
    activeSource === "OWNER"
      ? `${visibleItems.length} ${visibleItems.length === 1 ? "pitch" : "pitches"} from owners`
      : activeSource === "FANHUB"
        ? `${visibleItems.length} ${visibleItems.length === 1 ? "pitch" : "pitches"} from FanHub`
        : `${visibleItems.length} ${visibleItems.length === 1 ? "pitch" : "pitches"} with source pending`;

  return (
    <section className="pitch-page">
      <header className="pitch-discovery-hero">
        <div className="pitch-discovery-hero__copy">
          <p className="pitch-discovery-hero__eyebrow">PITCHES</p>
          <h1>Find your pitch</h1>
          <p>Book football pitches near you. By real owners or from FanHub.</p>
        </div>
        <a className="pitch-add-action" href="/places/new?kind=PITCH">
          <span aria-hidden="true">+</span>
          Add a Pitch
        </a>
      </header>

      <div className="pitch-source-tabs" role="tablist" aria-label="Pitch source">
        <button
          type="button"
          role="tab"
          aria-selected={activeSource === "OWNER"}
          className={activeSource === "OWNER" ? "pitch-source-tab is-active" : "pitch-source-tab"}
          onClick={() => setActiveSource("OWNER")}
        >
          <span>By Owner</span>
          <small>{grouped.OWNER.length}</small>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSource === "FANHUB"}
          className={activeSource === "FANHUB" ? "pitch-source-tab is-active" : "pitch-source-tab"}
          onClick={() => setActiveSource("FANHUB")}
        >
          <span>FanHub</span>
          <small>{grouped.FANHUB.length}</small>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSource === "LEGACY"}
          className={activeSource === "LEGACY" ? "pitch-source-tab is-active" : "pitch-source-tab"}
          onClick={() => setActiveSource("LEGACY")}
        >
          <span>Source pending</span>
          <small>{grouped.LEGACY.length}</small>
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="pitch-directory-heading">
        <strong>{sourceSummary}</strong>
      </div>

      <div className="pitch-directory">
        {visibleItems.map((item) => (
          <PitchTicket item={item} key={item.id} />
        ))}

        {!visibleItems.length && !error ? (
          <div className="pitch-empty panel">
            <h2>No pitches in this section yet</h2>
            <p className="muted">
              {activeSource === "LEGACY"
                ? "Approved historical pitches with unresolved source will appear here."
                : "Approved pitches will appear here when available."}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
