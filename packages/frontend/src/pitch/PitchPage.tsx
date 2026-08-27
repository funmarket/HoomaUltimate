import { useEffect, useMemo, useState } from "react";
import type { PublicPlaceCapability } from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { createPlatformManagementApi } from "../places/platform-management-api";
import { PitchTicket } from "./PitchTicket";

export function PitchPage() {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [items, setItems] = useState<PublicPlaceCapability[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    void api.capability
      .list("PITCH")
      .then(setItems)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load Pitch"),
      );
  }, [api]);

  return (
    <section className="pitch-page">
      <header className="pitch-page__header">
        <div>
          <p className="eyebrow">PITCH</p>
          <h1>Find your pitch</h1>
          <p>Football grounds and rental offers from local venues.</p>
        </div>
        <a className="pitch-back-link pitch-suggest-link" href="/places/new?kind=PITCH">
          Suggest a pitch
        </a>
      </header>

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
