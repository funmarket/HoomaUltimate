import { useMemo, useState, type FormEvent } from "react";
import type {
  PitchManagementState,
  PitchRentalCurrency,
} from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { createPlatformManagementApi } from "../places/platform-management-api";
import { pitchRateFromMinor, pitchRateToMinor } from "./pricing";

const RENTAL_CURRENCIES: readonly PitchRentalCurrency[] = ["TND", "EUR", "USD"];

export function PitchCapabilityOnboarding({
  management,
  onSubmitted,
}: {
  readonly management: PitchManagementState;
  readonly onSubmitted: () => Promise<void>;
}) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const approved = management.approvedPitch;
  const pending = management.pendingApplication;
  const canSubmit = management.verifiedOwnership && !pending && !submitting;
  const defaultCurrency = approved?.currency ?? "TND";
  const defaultHourlyRate = approved
    ? String(pitchRateFromMinor(approved.hourlyRateMinor, approved.currency))
    : "";
  let buttonLabel = "Submit for review";
  if (pending) buttonLabel = "Update pending review";
  if (submitting) buttonLabel = "Submitting…";

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    const data = new FormData(event.currentTarget);
    const hourlyRate = Number(data.get("hourlyRate") ?? 0);
    const rawCurrency = String(data.get("currency") ?? defaultCurrency);
    const currency =
      RENTAL_CURRENCIES.find((value) => value === rawCurrency) ?? defaultCurrency;
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      await api.capability.submit("PITCH", management.place.id, {
        summary: String(data.get("summary") ?? ""),
        hourlyRateMinor: pitchRateToMinor(hourlyRate, currency),
        currency,
      });
      setMessage(
        "Pitch rental details submitted for App review. Current public details remain unchanged until approval.",
      );
      await onSubmitted();
    } catch (reason) {
      setError(protectedError(reason, "Unable to submit Pitch application"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="panel place-business-form pitch-owner-form"
      onSubmit={(event) => void apply(event)}
    >
      <div className="place-business-form__heading">
        <p className="eyebrow">MANAGE PITCH</p>
        <h2>{management.place.name}</h2>
        <p className="muted">
          Update the rental offer after App review. Contact details come from the Place.
        </p>
      </div>

      {!management.verifiedOwnership ? (
        <p className="muted">
          Platform admin access is view-only here. A verified owner submits updates.
        </p>
      ) : null}
      {pending ? (
        <p className="muted">
          Editing is disabled while the current update is pending App review.
        </p>
      ) : null}

      <div className="place-business-rate-row">
        <label className="place-business-field">
          <span>Hourly rental price</span>
          <input
            name="hourlyRate"
            type="number"
            min="0"
            step="0.001"
            inputMode="decimal"
            placeholder="120.000"
            defaultValue={defaultHourlyRate}
            disabled={!canSubmit}
            required
          />
        </label>
        <label className="place-business-field">
          <span>Currency</span>
          <select
            name="currency"
            defaultValue={defaultCurrency}
            disabled={!canSubmit}
            required
          >
            {RENTAL_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="place-business-field">
        <span>Pitch offering</span>
        <textarea
          name="summary"
          placeholder="Pitch type, facilities, lighting, changing rooms and rental details"
          minLength={10}
          defaultValue={approved?.summary ?? ""}
          disabled={!canSubmit}
          required
        />
      </label>

      <button type="submit" disabled={!canSubmit}>
        {buttonLabel}
      </button>
      {message ? <p className="status place-business-message">{message}</p> : null}
      {error ? <p className="error place-business-message">{error}</p> : null}
    </form>
  );
}
