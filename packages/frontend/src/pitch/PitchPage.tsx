import { useEffect, useMemo, useState } from "react";
import type { PublicPitch } from "@hooma/contracts/pitch";
import type { PlaceSubmissionOrigin } from "@hooma/contracts/places";
import { useHoomaFrontend } from "../context";
import { createPitchApi } from "./api";
import { PitchTicket } from "./PitchTicket";

export function PitchPage() {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createPitchApi(transport), [transport]);
  const [items, setItems] = useState<PublicPitch[]>([]);
  const [pitchOrigin, setPitchOrigin] = useState<PlaceSubmissionOrigin>("OWNER");
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

  const visiblePitches = useMemo(
    () => items.filter((item) => item.place.submissionOrigin === pitchOrigin),
    [items, pitchOrigin],
  );
  const unclassifiedPitches = useMemo(
    () => items.filter((item) => item.place.submissionOrigin === null),
    [items],
  );

  return (
    <section className="pitch-page">
      <header className="pitch-hero">
        <div>
          <h1>Pitch</h1>
          <p>Find your pitch. Football grounds and rental offers around your Houma.</p>
        </div>
      </header>

      <nav className="pitch-actions" aria-label="Pitch sections">
        <a className="pitch-action pitch-action--active" href="/pitch">
          Pitches
        </a>
        <a className="pitch-action pitch-action--primary" href="/places/new?kind=PITCH">
          Add a Pitch
        </a>
      </nav>

      <div className="place-source-tabs" role="tablist" aria-label="Pitch source">
        <button
          type="button"
          role="tab"
          aria-selected={pitchOrigin === "OWNER"}
          className={pitchOrigin === "OWNER" ? "place-source-tab is-active" : "place-source-tab"}
          onClick={() => setPitchOrigin("OWNER")}
        >
          By Owner
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pitchOrigin === "FANHUB"}
          className={pitchOrigin === "FANHUB" ? "place-source-tab is-active" : "place-source-tab"}
          onClick={() => setPitchOrigin("FANHUB")}
        >
          FanHub
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="pitch-directory">
        {visiblePitches.map((item) => (
          <PitchTicket item={item} key={item.id} />
        ))}

        {!visiblePitches.length && !error ? (
          <div className="pitch-empty panel">
            <h2>
              {pitchOrigin === "OWNER"
                ? "No owner-submitted pitches yet"
                : "No FanHub pitches yet"}
            </h2>
            <p className="muted">Approved football venues will appear here.</p>
          </div>
        ) : null}
      </div>

      {unclassifiedPitches.length ? (
        <section className="panel">
          <p className="eyebrow">SOURCE PENDING VERIFICATION</p>
          <p className="muted">
            These existing Pitches predate durable source tracking. HOOMA keeps them visible
            without inventing whether they were added by an owner or FanHub.
          </p>
          <div className="pitch-directory">
            {unclassifiedPitches.map((item) => (
              <PitchTicket item={item} key={item.id} />
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
