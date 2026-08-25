import { useMemo, useState, type FormEvent } from "react";
import type { PlaceCapabilityKind, PublicPlaceSummary } from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { createPlatformManagementApi } from "./platform-management-api";

function locationLabel(place: PublicPlaceSummary): string {
  return [place.houma, place.city].filter(Boolean).join(" · ") || place.address;
}

export function PlaceCapabilityOnboarding({
  kind,
  places,
}: {
  readonly kind: PlaceCapabilityKind;
  readonly places: readonly PublicPlaceSummary[];
}) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const title = kind === "WATCH" ? "Watch" : "Pitch";

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
        "Ownership claim submitted. After approval you can submit the business application.",
      );
    } catch (reason) {
      setError(protectedError(reason, "Unable to submit ownership claim"));
    }
  }

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setMessage("");
    try {
      await api.capability.submit(kind, String(data.get("placeId") ?? ""), {
        summary: String(data.get("summary") ?? ""),
        contactName: String(data.get("contactName") ?? ""),
        contactPhone: String(data.get("contactPhone") ?? "") || null,
        contactEmail: String(data.get("contactEmail") ?? "") || null,
      });
      event.currentTarget.reset();
      setMessage(`${title} business application submitted for App review.`);
    } catch (reason) {
      setError(protectedError(reason, `Unable to submit ${title} application`));
    }
  }

  return (
    <div className="place-business-grid">
      <form className="panel place-business-form" onSubmit={(event) => void claim(event)}>
        <p className="eyebrow">STEP 1</p>
        <h2>Verify Place ownership</h2>
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
        <textarea
          name="evidence"
          placeholder="Ownership or management evidence"
          minLength={10}
          required
        />
        <button type="submit">Submit ownership claim</button>
      </form>

      <form className="panel place-business-form" onSubmit={(event) => void apply(event)}>
        <p className="eyebrow">STEP 2</p>
        <h2>Apply for {title}</h2>
        <p className="muted">The selected Place must already be approved and verified as yours.</p>
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
        <textarea
          name="summary"
          placeholder={`${title} offering, facilities, services and business details`}
          minLength={10}
          required
        />
        <input name="contactName" placeholder="Business contact name" required />
        <input name="contactPhone" placeholder="Phone" />
        <input name="contactEmail" type="email" placeholder="Email" />
        <button type="submit">Submit {title} application</button>
      </form>

      {message ? <p className="status place-business-message">{message}</p> : null}
      {error ? <p className="error place-business-message">{error}</p> : null}
    </div>
  );
}
