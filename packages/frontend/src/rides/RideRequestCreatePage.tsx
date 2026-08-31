import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  PublicRideRequest,
  RideRequestCreateInput,
  RideRequestForOwner,
} from "@hooma/contracts/rides";
import { useHoomaFrontend } from "../context";
import { createRideApi } from "./api";
import { RideDestinationFields } from "./RideDestinationFields";
import { RideSectionHeader } from "./RideSectionHeader";
import {
  dateTimeInputValue,
  destinationInput,
  destinationLabel,
  emptyDestination,
  toIsoDateTime,
} from "./ride-view-model";

export function RideRequestCreatePage() {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const [destination, setDestination] = useState(emptyDestination);
  const [pickupAreaLabel, setPickupAreaLabel] = useState("");
  const [desiredDepartureAt, setDesiredDepartureAt] = useState(dateTimeInputValue(90));
  const [expiresAt, setExpiresAt] = useState(dateTimeInputValue(24 * 60));
  const [passengerCount, setPassengerCount] = useState("1");
  const [note, setNote] = useState("");
  const [savedRequest, setSavedRequest] = useState<RideRequestForOwner | null>(null);
  const [publicRequests, setPublicRequests] = useState<PublicRideRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoadingRequests(true);
    void api
      .listRequests({ limit: 10 })
      .then((page) => {
        if (active) setPublicRequests(page.items);
      })
      .catch(() => {
        if (active) setPublicRequests([]);
      })
      .finally(() => {
        if (active) setLoadingRequests(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const input: RideRequestCreateInput = {
        destination: destinationInput(destination),
        pickupAreaLabel: pickupAreaLabel.trim(),
        desiredDepartureAt: toIsoDateTime(desiredDepartureAt),
        passengerCount: Number(passengerCount),
        note: note.trim() || null,
        expiresAt: toIsoDateTime(expiresAt),
      };
      setSavedRequest(await api.createRequest(input));
    } catch (reason) {
      setError(protectedError(reason, "Unable to create Ride request"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ride-page ride-form-page">
      <RideSectionHeader
        eyebrow="TAKE ME TO THE GAME"
        title="Request a Ride"
        body="Create a real RideRequest. This does not create fake matching, fare collection, drivers, or bookings."
        actionHref="/rides/offers"
        actionLabel="Browse offers"
      />
      {savedRequest ? (
        <section className="ride-created panel">
          <p className="eyebrow">RIDE REQUEST CREATED</p>
          <h2>{destinationLabel(savedRequest.destination)}</h2>
          <p>
            Your request is live from {savedRequest.pickupAreaLabel}. Matching remains a later
            Ride-owned capability.
          </p>
          <a className="ride-button ride-button--primary" href="/rides">
            Back to Ride
          </a>
        </section>
      ) : (
        <form className="ride-form panel" onSubmit={submit}>
          <RideDestinationFields destination={destination} onChange={setDestination} />
          <label className="ride-field">
            <span>Pickup area</span>
            <input
              value={pickupAreaLabel}
              onChange={(event) => setPickupAreaLabel(event.target.value)}
              placeholder="Public area only, not an exact private address"
              required
            />
          </label>
          <div className="ride-form__grid">
            <label className="ride-field">
              <span>Desired departure</span>
              <input
                type="datetime-local"
                value={desiredDepartureAt}
                onChange={(event) => setDesiredDepartureAt(event.target.value)}
                required
              />
            </label>
            <label className="ride-field">
              <span>Request expires</span>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                required
              />
            </label>
            <label className="ride-field">
              <span>Passengers</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={passengerCount}
                onChange={(event) => setPassengerCount(event.target.value)}
                required
              />
            </label>
          </div>
          <label className="ride-field">
            <span>Note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="ride-button ride-button--primary" type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create Ride request"}
          </button>
        </form>
      )}

      <section className="ride-request-preview panel">
        <p className="eyebrow">PUBLIC RIDE REQUESTS</p>
        {loadingRequests ? <p className="muted">Loading recent Ride requests...</p> : null}
        {!loadingRequests && !publicRequests.length ? (
          <p className="muted">No public Ride requests yet.</p>
        ) : null}
        {publicRequests.map((requestItem) => (
          <article className="ride-request-row" key={requestItem.id}>
            <strong>{destinationLabel(requestItem.destination)}</strong>
            <span>
              {requestItem.pickupAreaLabel} - {requestItem.passengerCount} passenger
              {requestItem.passengerCount === 1 ? "" : "s"}
            </span>
          </article>
        ))}
      </section>
    </section>
  );
}
