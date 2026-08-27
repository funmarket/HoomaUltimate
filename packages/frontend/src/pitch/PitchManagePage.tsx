import { useEffect, useMemo, useState } from "react";
import type { PublicPlaceSummary } from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { createPlatformManagementApi } from "../places/platform-management-api";
import { PitchCapabilityOnboarding } from "./PitchCapabilityOnboarding";

export function PitchManagePage() {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const placeId = new URLSearchParams(window.location.search).get("placeId");
  const [place, setPlace] = useState<PublicPlaceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    if (!placeId) {
      setError("Choose a Pitch you own from its detail page first.");
      setLoading(false);
      return;
    }

    void Promise.all([api.places.get(placeId), api.places.ownershipStatus(placeId)])
      .then(([publicPlace, ownership]) => {
        if (!ownership.verified) {
          throw new Error("Verified Place ownership is required to manage this Pitch.");
        }
        setPlace(publicPlace);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Verified Place ownership is required to manage this Pitch.",
        ),
      )
      .finally(() => setLoading(false));
  }, [api, placeId]);

  if (loading) return <p className="status">Loading Pitch management…</p>;

  return (
    <section className="pitch-manage-page">
      <a className="pitch-back-link" href={placeId ? `/pitch/${placeId}` : "/pitch"}>
        ← Pitch
      </a>
      {error ? <p className="error">{error}</p> : null}
      {place ? <PitchCapabilityOnboarding place={place} /> : null}
    </section>
  );
}
