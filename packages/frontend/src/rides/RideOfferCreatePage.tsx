import { useMemo, useState, type FormEvent } from "react";
import type { RideOfferCreateInput, RideOfferForOwner } from "@hooma/contracts/rides";
import { useHoomaFrontend } from "../context";
import { createRideApi } from "./api";
import { RideCompensationBadge } from "./RideCompensationBadge";
import {
  RideCompensationFields,
  buildRideOfferCompensationTerms,
  defaultRideCompensationState,
} from "./RideCompensationFields";
import { RideContextSelector, contextQuery, initialRideContext } from "./RideContextSelector";
import { RideDestinationFields } from "./RideDestinationFields";
import { RideSectionHeader } from "./RideSectionHeader";
import { RideVehiclePhotoPanel } from "./RideVehiclePhotoPanel";
import {
  dateTimeInputValue,
  destinationInput,
  destinationLabel,
  emptyDestination,
  toIsoDateTime,
} from "./ride-view-model";

export function RideOfferCreatePage() {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const [rideContext, setRideContext] = useState(initialRideContext());
  const [destination, setDestination] = useState(emptyDestination);
  const [originAreaLabel, setOriginAreaLabel] = useState("");
  const [departureAt, setDepartureAt] = useState(dateTimeInputValue(90));
  const [totalSeats, setTotalSeats] = useState("2");
  const [compensation, setCompensation] = useState(defaultRideCompensationState);
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [note, setNote] = useState("");
  const [savedOffer, setSavedOffer] = useState<RideOfferForOwner | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const input: RideOfferCreateInput = {
        context: rideContext,
        destination: destinationInput(destination),
        originAreaLabel: originAreaLabel.trim(),
        departureAt: toIsoDateTime(departureAt),
        totalSeats: Number(totalSeats),
        compensationTerms: buildRideOfferCompensationTerms(compensation),
        vehicleMake: vehicleMake.trim() || null,
        vehicleModel: vehicleModel.trim() || null,
        vehicleColor: vehicleColor.trim() || null,
        note: note.trim() || null,
        waypoints: [],
      };
      setSavedOffer(await api.createOffer(input));
    } catch (reason) {
      setError(protectedError(reason, "Unable to create Ride offer"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ride-page ride-form-page">
      <RideSectionHeader
        eyebrow="OFFER A RIDE"
        title="Create a Ride offer"
        body="Create the offer first. Vehicle photo upload is optional and happens after the RideOffer exists."
        actionHref={`/rides/offers${contextQuery(rideContext)}`}
        actionLabel="View offers"
      />
      {savedOffer ? (
        <section className="ride-created panel">
          <p className="eyebrow">RIDE OFFER CREATED</p>
          <h2>{destinationLabel(savedOffer.destination)}</h2>
          <RideCompensationBadge terms={savedOffer.compensationTerms} />
          <p>Your offer is live. You can add or replace the vehicle photo now.</p>
          <RideVehiclePhotoPanel
            offerId={savedOffer.id}
            hasVehiclePhoto={savedOffer.hasVehiclePhoto}
          />
          <div className="ride-actions">
            <a className="ride-button ride-button--primary" href={`/rides/offers/${savedOffer.id}`}>
              Manage offer
            </a>
            <a className="ride-button" href={`/rides/offers/new${contextQuery(rideContext)}`}>
              Create another
            </a>
          </div>
        </section>
      ) : (
        <form className="ride-form panel" onSubmit={submit}>
          <section className="ride-form-section">
            <p className="eyebrow">TRIP</p>
            <RideContextSelector value={rideContext} onChange={setRideContext} />
            <RideDestinationFields
              context={rideContext}
              destination={destination}
              onChange={setDestination}
            />
            <label className="ride-field">
              <span>Origin area</span>
              <input
                value={originAreaLabel}
                onChange={(event) => setOriginAreaLabel(event.target.value)}
                placeholder="Lac 2, downtown, north gate..."
                required
              />
            </label>
            <label className="ride-field">
              <span>Departure time</span>
              <input
                type="datetime-local"
                value={departureAt}
                onChange={(event) => setDepartureAt(event.target.value)}
                required
              />
            </label>
          </section>
          <section className="ride-form-section">
            <p className="eyebrow">SEATS</p>
            <label className="ride-field">
              <span>Total seats</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={totalSeats}
                onChange={(event) => setTotalSeats(event.target.value)}
                required
              />
            </label>
          </section>
          <RideCompensationFields mode="offer" value={compensation} onChange={setCompensation} />
          <section className="ride-form-section">
            <p className="eyebrow">VEHICLE</p>
            <div className="ride-form__grid">
              <label className="ride-field">
                <span>Vehicle make</span>
                <input
                  value={vehicleMake}
                  onChange={(event) => setVehicleMake(event.target.value)}
                />
              </label>
              <label className="ride-field">
                <span>Vehicle model</span>
                <input
                  value={vehicleModel}
                  onChange={(event) => setVehicleModel(event.target.value)}
                />
              </label>
              <label className="ride-field">
                <span>Vehicle color</span>
                <input
                  value={vehicleColor}
                  onChange={(event) => setVehicleColor(event.target.value)}
                />
              </label>
            </div>
          </section>
          <section className="ride-form-section">
            <p className="eyebrow">DETAILS</p>
            <label className="ride-field">
              <span>Note</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
            </label>
          </section>
          {error ? <p className="error">{error}</p> : null}
          <button className="ride-button ride-button--primary" type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create Ride offer"}
          </button>
        </form>
      )}
    </section>
  );
}
