import { useEffect, useMemo, useState } from "react";
import type { PublicPlaceSummary } from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { createPlatformManagementApi } from "../places/platform-management-api";
import { PitchCapabilityOnboarding } from "./PitchCapabilityOnboarding";

export function PitchManagePage() {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [places, setPlaces] = useState<PublicPlaceSummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    void api.places
      .list()
      .then(setPlaces)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load approved Places"),
      );
  }, [api]);

  return (
    <section className="pitch-manage-page">
      <a className="pitch-back-link" href="/pitch">
        ← Pitch
      </a>
      <header className="pitch-owner-entry__heading">
        <p className="eyebrow">VENUE OPERATORS</p>
        <h1>List a football pitch</h1>
        <p>
          Verify the approved Place you operate, then submit its rental offer and hourly price for
          App review.
        </p>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <PitchCapabilityOnboarding places={places} />
    </section>
  );
}
