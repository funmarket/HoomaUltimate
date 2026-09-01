import { useEffect, useMemo, useState } from "react";
import type {
  RideMine,
  RideParticipationForPassenger,
  RideRequestForOwner,
} from "@hooma/contracts/rides";
import { useHoomaFrontend } from "../context";
import { createRideApi } from "./api";
import { RideCompensationBadge } from "./RideCompensationBadge";
import { RideHistoryIcon } from "./RideIcons";
import { destinationLabel, errorMessage, formatRideTime } from "./ride-view-model";

const EMPTY_MINE: RideMine = {
  offers: { items: [], nextCursor: null },
  requests: { items: [], nextCursor: null },
  participations: { items: [], nextCursor: null },
};

function rideContextLabel(context: "MATCHDAY" | "GENERAL"): string {
  return context === "MATCHDAY" ? "Matchday" : "Anywhere";
}

function requestAudienceLabel(request: RideRequestForOwner): string {
  if (request.audience.scope === "GLOBAL") return "Everyone";
  if (request.audience.communities.length === 1) {
    return request.audience.communities[0]?.name ?? "One HOOMA";
  }
  return `${request.audience.communities.length} HOOMAs`;
}

function canEditOffer(status: string): boolean {
  return status !== "CANCELLED" && status !== "COMPLETED";
}

function canEditRequest(status: string): boolean {
  return status !== "CANCELLED" && status !== "EXPIRED" && status !== "COMPLETED";
}

export function RideMinePage() {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const [mine, setMine] = useState<RideMine>(EMPTY_MINE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api
      .getMyRides({ limit: 20 })
      .then((payload) => {
        if (active) setMine(payload);
      })
      .catch((reason) => {
        if (active)
          setError(protectedError(reason, errorMessage(reason, "My Rides could not be loaded")));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, protectedError]);

  return (
    <section className="ride-page ride-mine">
      <header className="ride-section-header panel">
        <p className="eyebrow">MY RIDES</p>
        <h1>Your Ride activity</h1>
        <p>Your offers, requests and trips — all in one place.</p>
      </header>

      {loading ? <p className="ride-state panel">Loading My Rides...</p> : null}
      {error ? <p className="ride-state panel error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <section className="ride-home-panel panel">
            <RideMineHeading title="My Offers" count={mine.offers.items.length} />
            <div className="ride-recent-list">
              {mine.offers.items.map((offer) => (
                <article className="ride-recent-card ride-recent-card--owned" key={offer.id}>
                  <span className="ride-recent-card__avatar" aria-hidden="true">
                    <RideHistoryIcon />
                  </span>
                  <span className="ride-recent-card__body">
                    <strong>{destinationLabel(offer.destination)}</strong>
                    <span>
                      {rideContextLabel(offer.context)} · {offer.status} ·{" "}
                      {formatRideTime(offer.departureAt)}
                    </span>
                    <span>
                      {offer.availableSeats}/{offer.totalSeats} seats open from{" "}
                      {offer.originAreaLabel}
                    </span>
                    <span className="ride-recent-card__meta">
                      <RideCompensationBadge terms={offer.compensationTerms} />
                      <span>{offer.participationCount} passenger updates</span>
                    </span>
                    <span className="ride-recent-card__actions">
                      <a className="ride-link" href={`/rides/offers/${offer.id}`}>
                        Manage offer
                      </a>
                      {canEditOffer(offer.status) ? (
                        <a className="ride-link" href={`/rides/offers/${offer.id}/edit`}>
                          Edit offer
                        </a>
                      ) : (
                        <span className="muted">Read-only</span>
                      )}
                    </span>
                  </span>
                </article>
              ))}
            </div>
            <RideMineEmpty show={!mine.offers.items.length} label="No Ride offers yet." />
            <RideMineMore nextCursor={mine.offers.nextCursor} />
          </section>

          <section className="ride-home-panel panel">
            <RideMineHeading title="My Requests" count={mine.requests.items.length} />
            <div className="ride-recent-list">
              {mine.requests.items.map((request) => (
                <article className="ride-recent-card ride-recent-card--request" key={request.id}>
                  <span className="ride-recent-card__avatar" aria-hidden="true">
                    <RideHistoryIcon />
                  </span>
                  <span className="ride-recent-card__body">
                    <strong>{destinationLabel(request.destination)}</strong>
                    <span>
                      {rideContextLabel(request.context)} · {request.status} ·{" "}
                      {formatRideTime(request.desiredDepartureAt)}
                    </span>
                    <span>
                      {request.passengerCount} passenger{request.passengerCount === 1 ? "" : "s"}{" "}
                      from {request.pickupAreaLabel}
                    </span>
                    <span>Shared with: {requestAudienceLabel(request)}</span>
                    <span className="ride-recent-card__meta">
                      <RideCompensationBadge terms={request.compensationTerms} mode="request" />
                    </span>
                    <span className="ride-recent-card__actions">
                      {canEditRequest(request.status) ? (
                        <a className="ride-link" href={`/rides/requests/${request.id}/edit`}>
                          Edit request
                        </a>
                      ) : (
                        <span className="muted">Read-only</span>
                      )}
                    </span>
                  </span>
                </article>
              ))}
            </div>
            <RideMineEmpty show={!mine.requests.items.length} label="No Ride requests yet." />
            <RideMineMore nextCursor={mine.requests.nextCursor} />
          </section>

          <section className="ride-home-panel panel">
            <RideMineHeading
              title="My Trips / Participations"
              count={mine.participations.items.length}
            />
            <div className="ride-recent-list">
              {mine.participations.items.map((participation) => (
                <PassengerTripCard participation={participation} key={participation.id} />
              ))}
            </div>
            <RideMineEmpty
              show={!mine.participations.items.length}
              label="No passenger trips yet."
            />
            <RideMineMore nextCursor={mine.participations.nextCursor} />
          </section>
        </>
      ) : null}
    </section>
  );
}

function PassengerTripCard({
  participation,
}: {
  readonly participation: RideParticipationForPassenger;
}) {
  return (
    <a className="ride-recent-card" href={`/rides/offers/${participation.offer.id}`}>
      <span className="ride-recent-card__avatar" aria-hidden="true">
        <RideHistoryIcon />
      </span>
      <span className="ride-recent-card__body">
        <strong>{destinationLabel(participation.offer.destination)}</strong>
        <span>
          {rideContextLabel(participation.offer.context)} · {participation.status} ·{" "}
          {formatRideTime(participation.offer.departureAt)}
        </span>
        <span>
          {participation.seatCount} seat{participation.seatCount === 1 ? "" : "s"} requested
        </span>
        <span className="ride-recent-card__meta">
          <RideCompensationBadge terms={participation.offer.compensationTerms} />
        </span>
      </span>
    </a>
  );
}

function RideMineHeading({ title, count }: { readonly title: string; readonly count: number }) {
  return (
    <div className="ride-home-panel__header">
      <p className="eyebrow">{title}</p>
      <span className="ride-count-badge">{count}</span>
    </div>
  );
}

function RideMineEmpty({ show, label }: { readonly show: boolean; readonly label: string }) {
  return show ? <p className="ride-empty-state">{label}</p> : null;
}

function RideMineMore({ nextCursor }: { readonly nextCursor: string | null }) {
  return nextCursor ? <p className="ride-empty-state">More Ride history is available.</p> : null;
}
