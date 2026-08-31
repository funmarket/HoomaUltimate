import type { PublicRideOffer } from "@hooma/contracts/rides";
import { destinationLabel, formatRideTime } from "./ride-view-model";

export function RideOfferCard({
  offer,
  photoUrl,
}: {
  readonly offer: PublicRideOffer;
  readonly photoUrl: string;
}) {
  return (
    <a className="ride-offer-card panel" href={`/rides/offers/${offer.id}`}>
      <div className="ride-offer-card__media">
        {offer.hasVehiclePhoto ? <img src={photoUrl} alt="" loading="lazy" /> : <span>RIDE</span>}
      </div>
      <div>
        <p className="eyebrow">{offer.status}</p>
        <h2>{destinationLabel(offer.destination)}</h2>
        <p>{formatRideTime(offer.departureAt)}</p>
        <small>
          From {offer.originAreaLabel} - {offer.availableSeats}/{offer.totalSeats} seats open
        </small>
      </div>
    </a>
  );
}
