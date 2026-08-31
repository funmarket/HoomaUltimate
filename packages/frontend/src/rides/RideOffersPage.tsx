import { useEffect, useMemo, useState } from "react";
import type { PublicRideOffer } from "@hooma/contracts/rides";
import { useHoomaFrontend } from "../context";
import { createRideApi } from "./api";
import { RideOfferCard } from "./RideOfferCard";
import { contextQuery, rideContextFromQuery } from "./RideContextSelector";
import { RideSectionHeader } from "./RideSectionHeader";
import { errorMessage } from "./ride-view-model";

export function RideOffersPage() {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const [offers, setOffers] = useState<PublicRideOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const rideContext = rideContextFromQuery();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api
      .listOffers({ limit: 30, ...(rideContext ? { context: rideContext } : {}) })
      .then((page) => {
        if (active) setOffers(page.items);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason, "Ride offers could not be loaded"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, rideContext]);

  const scopedQuery = contextQuery(rideContext);

  return (
    <section className="ride-page">
      <RideSectionHeader
        eyebrow="RIDE OFFERS"
        title="Drivers heading out"
        body="Public Ride offers come from the Ride API. Exact meeting points stay private."
        actionHref={`/rides/offers/new${scopedQuery}`}
        actionLabel="Offer a Ride"
      />
      {loading ? <p className="ride-state panel">Loading Ride offers...</p> : null}
      {error ? <p className="ride-state panel error">{error}</p> : null}
      <div className="ride-offer-list">
        {offers.map((offer) => (
          <RideOfferCard key={offer.id} offer={offer} photoUrl={api.offerPhotoUrl(offer.id)} />
        ))}
      </div>
      {!loading && !error && !offers.length ? (
        <p className="ride-state panel muted">No public Ride offers are available yet.</p>
      ) : null}
    </section>
  );
}
