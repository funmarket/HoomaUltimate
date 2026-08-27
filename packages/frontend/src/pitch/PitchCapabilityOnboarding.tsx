import { useMemo, useState, type FormEvent } from "react";
import type { PitchRentalCurrency, PublicPlaceSummary } from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { createPlatformManagementApi } from "../places/platform-management-api";
import { pitchRateToMinor } from "./pricing";

const RENTAL_CURRENCIES: readonly PitchRentalCurrency[] = ["TND", "EUR", "USD"];

function locationLabel(place: PublicPlaceSummary): string {
  return [place.houma, place.city].filter(Boolean).join(" · ") || place.address;
}

export function PitchCapabilityOnboarding({
  places,
}: {
  readonly places: readonly PublicPlaceSummary[];
}) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setMessage("");
    try {
      await api.places.claimOwnership(String(data.get("placeId") ?? ""), {
        evidence: String(data.get("evidence") ?? ""),
      });
      event.currentTarget.reset();
      setMessage(
        "Ownership claim submitted. After approval you can submit the Pitch application.",
      );
    } catch (reason) {
      setError(protectedError(reason, "Unable to submit ownership claim"));
    }
  }

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const hourlyRate = Number(data.get("hourlyRate") ?? 0);
    const rawCurrency = String(data.get("currency") ?? "TND");
    const currency = RENTAL_CURRENCIES.find((value) => value === rawCurrency) ?? "TND";
    setError("");
    setMessage("");
    try {
      await api.capability.submit("PITCH", String(data.get("placeId") ?? ""), {
        summary: String(data.get("summary") ?? ""),
        hourlyRateMinor: pitchRateToMinor(hourlyRate, currency),
        currency,
        contactName: String(data.get("contactName") ?? ""),
        contactPhone: String(data.get("contactPhone") ?? "") || null,
        contactEmail: String(data.get("contactEmail") ?? "") || null,
      });
      event.currentTarget.reset();
      setMessage("Pitch business application submitted for App review.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to submit Pitch application"));
    }
  }

  return (
    <div className="place-business-grid">
      <form className="panel place-business-form" onSubmit={(event) => void claim(event)}>
        <div className="place-business-form__heading">
          <p className="eyebrow">STEP 1</p>
          <h2>Verify Place ownership</h2>
          <p className="muted">Choose the approved Place you own or manage.</p>
        </div>

        <label className="place-business-field">
          <span>Approved Place</span>
          <select name="placeId" required defaultValue="">
            <option value="" disabled>
              Select approved Place
            </option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name} · {locationLabel(place)}
              </option>
            ))}
          </select>
        </label>

        <label className="place-business-field">
          <span>Ownership or management evidence</span>
          <textarea
            name="evidence"
            placeholder="Describe how you own or manage this Place"
            minLength={10}
            required
          />
        </label>

        <button type="submit">Submit ownership claim</button>
      </form>

      <form className="panel place-business-form" onSubmit={(event) => void apply(event)}>
        <div className="place-business-form__heading">
          <p className="eyebrow">STEP 2</p>
          <h2>Apply for Pitch</h2>
          <p className="muted">
            The selected Place must already be approved and verified as yours.
          </p>
        </div>

        <label className="place-business-field">
          <span>Approved Place</span>
          <select name="placeId" required defaultValue="">
            <option value="" disabled>
              Select approved Place
            </option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name} · {locationLabel(place)}
              </option>
            ))}
          </select>
        </label>

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

        <label className="place-business-field">
          <span>Business contact name</span>
          <input name="contactName" placeholder="Name" required />
        </label>

        <label className="place-business-field">
          <span>Phone</span>
          <input name="contactPhone" placeholder="Phone" inputMode="tel" />
        </label>

        <label className="place-business-field">
          <span>Email</span>
          <input name="contactEmail" type="email" placeholder="Email" autoComplete="email" />
        </label>

        <button type="submit">Submit Pitch application</button>
      </form>

      {message ? <p className="status place-business-message">{message}</p> : null}
      {error ? <p className="error place-business-message">{error}</p> : null}
    </div>
  );
}
