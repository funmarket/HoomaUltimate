import { useEffect, useMemo, useState } from "react";
import type { PublicRideOffer, PublicRideRequest } from "@hooma/contracts/rides";
import { useHoomaFrontend } from "../context";
import { createRideApi } from "./api";
import { RideOfferCard } from "./RideOfferCard";
import { destinationLabel, errorMessage, formatRideTime } from "./ride-view-model";

export function RidesPage() {
  return <RideGatewayPage />;
}

export function RideGatewayPage() {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const [offers, setOffers] = useState<PublicRideOffer[]>([]);
  const [requests, setRequests] = useState<PublicRideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([api.listOffers({ limit: 3 }), api.listRequests({ limit: 3 })])
      .then(([offerPage, requestPage]) => {
        if (!active) return;
        setOffers(offerPage.items);
        setRequests(requestPage.items);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason, "Ride home could not be loaded"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  return (
    <section className="ride-page ride-gateway">
      <header className="ride-hero">
        <p className="eyebrow">RIDE</p>
        <h1>Get there with HOOMA</h1>
        <p>
          Browse real Ride offers, post a Ride request, and keep exact meeting points private until
          a driver accepts.
        </p>
        <div className="ride-actions">
          <a className="ride-button ride-button--primary" href="/rides/request">
            Request a Ride
          </a>
          <a className="ride-button" href="/rides/offers">
            Browse offers
          </a>
          <a className="ride-button" href="/rides/offers/new">
            Offer seats
          </a>
        </div>
      </header>

      {loading ? <p className="ride-state panel">Loading Ride activity...</p> : null}
      {error ? <p className="ride-state panel error">{error}</p> : null}

      <section className="ride-home-grid" aria-label="Ride home">
        <div className="panel ride-home-panel">
          <div className="ride-home-panel__header">
            <div>
              <p className="eyebrow">RIDE OFFERS</p>
              <h2>Drivers heading out</h2>
            </div>
            <a className="ride-link" href="/rides/offers">
              View all
            </a>
          </div>
          <div className="ride-offer-list ride-offer-list--compact">
            {offers.map((offer) => (
              <RideOfferCard key={offer.id} offer={offer} photoUrl={api.offerPhotoUrl(offer.id)} />
            ))}
          </div>
          {!loading && !offers.length ? (
            <p className="muted">No public Ride offers are available yet.</p>
          ) : null}
        </div>

        <div className="panel ride-home-panel">
          <div className="ride-home-panel__header">
            <div>
              <p className="eyebrow">RIDE REQUESTS</p>
              <h2>Fans looking for seats</h2>
            </div>
            <a className="ride-link" href="/rides/request">
              Create request
            </a>
          </div>
          {requests.map((requestItem) => (
            <article className="ride-request-row" key={requestItem.id}>
              <strong>{destinationLabel(requestItem.destination)}</strong>
              <span>
                {requestItem.pickupAreaLabel} - {requestItem.passengerCount} passenger
                {requestItem.passengerCount === 1 ? "" : "s"} -{" "}
                {formatRideTime(requestItem.desiredDepartureAt)}
              </span>
            </article>
          ))}
          {!loading && !requests.length ? (
            <p className="muted">No public Ride requests yet.</p>
          ) : null}
        </div>
      </section>
    </section>
  );
}
