import { useMemo, useState, type FormEvent } from "react";
import type {
  PitchRentalCurrency,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { createPlatformManagementApi } from "../places/platform-management-api";
import { pitchRateToMinor } from "./pricing";

const RENTAL_CURRENCIES: readonly PitchRentalCurrency[] = ["TND", "EUR", "USD"];

export function PitchCapabilityOnboarding({
  place,
}: {
  readonly place: PublicPlaceSummary;
}) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const hourlyRate = Number(data.get("hourlyRate") ?? 0);
    const rawCurrency = String(data.get("currency") ?? "TND");
    const currency = RENTAL_CURRENCIES.find((value) => value === rawCurrency) ?? "TND";
    setError("");
    setMessage("");
    try {
      await api.capability.submit("PITCH", place.id, {
        summary: String(data.get("summary") ?? ""),
        hourlyRateMinor: pitchRateToMinor(hourlyRate, currency),
        currency,
      });
      event.currentTarget.reset();
      setMessage("Pitch rental details submitted for App review.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to submit Pitch application"));
    }
  }

  return (
    <form className="panel place-business-form pitch-owner-form" onSubmit={(event) => void apply(event)}>
      <div className="place-business-form__heading">
        <p className="eyebrow">MANAGE PITCH</p>
        <h2>{place.name}</h2>
        <p className="muted">
          Update the rental offer shown after App review. Contact details come from the canonical Place.
        </p>
      </div>

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
            required
          />
        </label>
        <label className="place-business-field">
          <span>Currency</span>
          <select name="currency" defaultValue="TND" required>
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
          required
        />
      </label>

      <button type="submit">Submit for review</button>
      {message ? <p className="status place-business-message">{message}</p> : null}
      {error ? <p className="error place-business-message">{error}</p> : null}
    </form>
  );
}
