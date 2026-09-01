import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  RideOfferCreateInput,
  RideOfferForOwner,
  RideOfferUpdateInput,
} from "@hooma/contracts/rides";
import { useHoomaFrontend } from "../context";
import { createRideApi } from "./api";
import { RideCompensationBadge } from "./RideCompensationBadge";
import {
  RideCompensationFields,
  buildRideOfferCompensationTerms,
  compensationFormStateFromTerms,
  defaultRideCompensationState,
} from "./RideCompensationFields";
import { RideContextSelector, contextQuery, initialRideContext } from "./RideContextSelector";
import { RideDestinationFields } from "./RideDestinationFields";
import { RideSectionHeader } from "./RideSectionHeader";
import { RideVehiclePhotoPanel } from "./RideVehiclePhotoPanel";
import {
  dateTimeInputValue,
  dateTimeInputValueFromIso,
  destinationFormState,
  destinationInput,
  destinationLabel,
  emptyDestination,
  toIsoDateTime,
} from "./ride-view-model";

export function RideOfferCreatePage({ offerId }: { readonly offerId?: string }) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const editing = Boolean(offerId);
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
  const [existingOffer, setExistingOffer] = useState<RideOfferForOwner | null>(null);
  const [savedOffer, setSavedOffer] = useState<RideOfferForOwner | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!offerId) return;
    let active = true;
    setLoadingExisting(true);
    setError("");
    void api
      .manageOffer(offerId)
      .then((offer) => {
        if (!active) return;
        setExistingOffer(offer);
        setRideContext(offer.context);
        setDestination(destinationFormState(offer.destination));
        setOriginAreaLabel(offer.originAreaLabel);
        setDepartureAt(dateTimeInputValueFromIso(offer.departureAt));
        setTotalSeats(String(offer.totalSeats));
        setCompensation(compensationFormStateFromTerms(offer.compensationTerms));
        setVehicleMake(offer.vehicleMake ?? "");
        setVehicleModel(offer.vehicleModel ?? "");
        setVehicleColor(offer.vehicleColor ?? "");
        setNote(offer.note ?? "");
      })
      .catch((reason) => {
        if (active) setError(protectedError(reason, "Unable to load this Ride offer"));
      })
      .finally(() => {
        if (active) setLoadingExisting(false);
      });
    return () => {
      active = false;
    };
  }, [api, offerId, protectedError]);

  const readOnly = existingOffer?.status === "CANCELLED" || existingOffer?.status === "COMPLETED";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError("");
    try {
      const baseInput: RideOfferCreateInput = {
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
        waypoints:
          existingOffer?.waypoints.map((waypoint) => ({
            sequence: waypoint.sequence,
            placeId: waypoint.placeId,
            areaLabel: waypoint.areaLabel,
          })) ?? [],
      };

      const updateInput: RideOfferUpdateInput = baseInput;
      const saved = offerId
        ? await api.updateOffer(offerId, updateInput)
        : await api.createOffer(baseInput);
      setExistingOffer(saved);
      setSavedOffer(saved);
    } catch (reason) {
      setError(
        protectedError(
          reason,
          editing ? "Unable to update Ride offer" : "Unable to create Ride offer",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (editing && loadingExisting) {
    return <p className="ride-state panel">Loading your Ride offer...</p>;
  }

  if (editing && !existingOffer && error) {
    return <p className="ride-state panel error">{error}</p>;
  }

  if (editing && existingOffer && readOnly) {
    return (
      <section className="ride-page ride-form-page">
        <RideSectionHeader
          eyebrow="MY OFFERS"
          title="Ride offer"
          body="Completed and cancelled Ride offers remain visible in My Rides but cannot be edited."
          actionHref="/rides/mine"
          actionLabel="Back to My Rides"
        />
        <section className="ride-created panel">
          <p className="eyebrow">{existingOffer.status}</p>
          <h2>{destinationLabel(existingOffer.destination)}</h2>
          <RideCompensationBadge terms={existingOffer.compensationTerms} />
          <p>This Ride offer is read-only.</p>
          <a
            className="ride-button ride-button--primary"
            href={`/rides/offers/${existingOffer.id}`}
          >
            View offer
          </a>
        </section>
      </section>
    );
  }

  return (
    <section className="ride-page ride-form-page">
      <RideSectionHeader
        eyebrow={editing ? "MY OFFERS" : "OFFER A RIDE"}
        title={editing ? "Edit Ride offer" : "Create a Ride offer"}
        body={
          editing
            ? "Update the same canonical RideOffer. Existing passenger activity and accepted-seat safety rules remain authoritative."
            : "Create the offer first. Vehicle photo upload is optional and happens after the RideOffer exists."
        }
        actionHref={editing ? "/rides/mine" : `/rides/offers${contextQuery(rideContext)}`}
        actionLabel={editing ? "Back to My Rides" : "View offers"}
      />

      {savedOffer ? (
        <section className="ride-created panel">
          <p className="eyebrow">{editing ? "RIDE OFFER UPDATED" : "RIDE OFFER CREATED"}</p>
          <h2>{destinationLabel(savedOffer.destination)}</h2>
          <RideCompensationBadge terms={savedOffer.compensationTerms} />
          <p>
            {editing
              ? "Your existing Ride offer was updated. Passenger activity stays attached to this same offer."
              : "Your offer is live. You can add or replace the vehicle photo now."}
          </p>
          <RideVehiclePhotoPanel
            offerId={savedOffer.id}
            hasVehiclePhoto={savedOffer.hasVehiclePhoto}
          />
          <div className="ride-actions">
            <a className="ride-button ride-button--primary" href={`/rides/offers/${savedOffer.id}`}>
              Manage offer
            </a>
            <a
              className="ride-button"
              href={editing ? "/rides/mine" : `/rides/offers/new${contextQuery(rideContext)}`}
            >
              {editing ? "Back to My Rides" : "Create another"}
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
            {saving
              ? editing
                ? "Saving..."
                : "Creating..."
              : editing
                ? "Save Ride offer"
                : "Create Ride offer"}
          </button>
        </form>
      )}
    </section>
  );
}
