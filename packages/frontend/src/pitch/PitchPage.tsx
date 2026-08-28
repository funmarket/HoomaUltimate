import { useEffect, useMemo, useState } from "react";
import type { PublicPitch } from "@hooma/contracts/pitch";
import { useHoomaFrontend } from "../context";
import { createPitchApi } from "./api";
import { PitchTicket } from "./PitchTicket";

export function PitchPage() {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createPitchApi(transport), [transport]);
  const [items, setItems] = useState<PublicPitch[]>([]);
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
          Suggest a Pitch
        </a>
      </nav>

      {error ? <p className="error">{error}</p> : null}

      <div className="pitch-directory">
        {items.map((item) => (
          <PitchTicket item={item} key={item.id} />
        ))}

        {!items.length && !error ? (
          <div className="pitch-empty panel">
            <h2>No verified pitches yet</h2>
            <p className="muted">Approved football venues will appear here.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
