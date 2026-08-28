import { useCallback, useEffect, useMemo, useState } from "react";
import type { PitchManagementState } from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { createPlatformManagementApi } from "../places/platform-management-api";
import { PitchCapabilityOnboarding } from "./PitchCapabilityOnboarding";
import { formatPitchHourlyRate } from "./pricing";

function priceLabel(hourlyRateMinor: number | null, currency: string | null) {
  if (
    hourlyRateMinor === null ||
    (currency !== "TND" && currency !== "EUR" && currency !== "USD")
  ) {
    return "Pricing unavailable in this historical submission";
  }
  return `${formatPitchHourlyRate(hourlyRateMinor, currency)} ${currency} / hour`;
}

export function PitchManagePage() {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const placeId = new URLSearchParams(window.location.search).get("placeId");
  const [management, setManagement] = useState<PitchManagementState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadManagement = useCallback(async () => {
    if (!placeId) {
      setManagement(null);
      setError("Choose a Pitch you own from its detail page first.");
      return;
    }
    setError("");
    try {
      setManagement(await api.capability.manage("PITCH", placeId));
    } catch (reason) {
      setManagement(null);
      setError(protectedError(reason, "Unable to load Pitch management"));
    }
  }, [api, placeId, protectedError]);

  useEffect(() => {
    setLoading(true);
    void loadManagement().finally(() => setLoading(false));
  }, [loadManagement]);

  if (loading) return <p className="status">Loading Pitch management…</p>;

  const approved = management?.approvedPitch ?? null;
  const pending = management?.pendingApplication ?? null;
  const rejected = management?.latestRejectedApplication ?? null;

  return (
    <section className="pitch-manage-page">
      <a className="pitch-back-link" href={placeId ? `/pitch/${placeId}` : "/pitch"}>
        ← Pitch
      </a>
      {error ? <p className="error">{error}</p> : null}
      {management ? (
        <>
          <section className="panel pitch-owner-state">
            <p className="eyebrow">CURRENTLY PUBLIC</p>
            <h2>{management.place.name}</h2>
            {approved ? (
              <>
                <strong>{priceLabel(approved.hourlyRateMinor, approved.currency)}</strong>
                {approved.summary ? <p>{approved.summary}</p> : null}
              </>
            ) : (
              <p className="muted">No approved Pitch rental profile is currently public.</p>
            )}
          </section>

          {pending ? (
            <section className="panel pitch-owner-state">
              <p className="eyebrow">PENDING REVIEW</p>
              <strong>{priceLabel(pending.hourlyRateMinor, pending.currency)}</strong>
              <p>{pending.summary}</p>
              <p className="muted">
                Current public Pitch details remain unchanged until approval.
              </p>
            </section>
          ) : null}

          {!pending && rejected ? (
            <section className="panel pitch-owner-state">
              <p className="eyebrow">LATEST UPDATE REJECTED</p>
              <strong>{priceLabel(rejected.hourlyRateMinor, rejected.currency)}</strong>
              <p>{rejected.summary}</p>
              {rejected.reviewNote ? (
                <p className="muted">App review note: {rejected.reviewNote}</p>
              ) : null}
            </section>
          ) : null}

          <PitchCapabilityOnboarding
            key={`${approved?.id ?? "none"}:${pending?.id ?? "none"}`}
            management={management}
            onSubmitted={loadManagement}
          />
        </>
      ) : null}
    </section>
  );
}
