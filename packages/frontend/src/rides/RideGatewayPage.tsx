import { useEffect, useMemo, useState } from "react";
import type { PublicRideOffer, PublicRideRequest } from "@hooma/contracts/rides";
import { useHoomaFrontend } from "../context";
import { createRideApi } from "./api";
import { RideCompensationBadge } from "./RideCompensationBadge";
import { contextQuery } from "./RideContextSelector";
import { RideFeatureGrid } from "./RideFeatureGrid";
import {
  RideBrowseIcon,
  RideCarPlusIcon,
  RideHistoryIcon,
  RideLockIcon,
  RideMapPinIcon,
} from "./RideIcons";
import { destinationLabel, errorMessage, formatRideTime } from "./ride-view-model";

export function RidesPage({ context }: { readonly context?: "MATCHDAY" | "GENERAL" }) {
  return context ? <RideGatewayPage context={context} /> : <RideGatewayPage />;
}

export function RideGatewayPage({ context }: { readonly context?: "MATCHDAY" | "GENERAL" }) {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const [offers, setOffers] = useState<PublicRideOffer[]>([]);
  const [requests, setRequests] = useState<PublicRideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const copy = heroCopy(context);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const query = { limit: 3, ...(context ? { context } : {}) };
    void Promise.all([api.listOffers(query), api.listRequests(query)])
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
  }, [api, context]);

  return (
    <section className="ride-page ride-gateway">
      <RideHero copy={copy} />
      <RideFeatureGrid />

      {loading ? <p className="ride-state panel">Loading Ride activity...</p> : null}
      {error ? (
        <p className="ride-state panel error">Ride activity unavailable. Try again shortly.</p>
      ) : null}

      <RideRecentOffers
        context={context}
        offers={offers}
        loading={loading}
        photoUrl={api.offerPhotoUrl}
      />
      <RideRecentRequests context={context} requests={requests} loading={loading} />
    </section>
  );
}

function RideHero({ copy }: { readonly copy: ReturnType<typeof heroCopy> }) {
  const scopedQuery = contextQuery(copy.context);
  return (
    <header className="ride-hero">
      <div className="ride-hero__media">
        <img
          className="ride-hero__banner"
          src="/rides/on-my-way-banner.png"
          alt="HOOMA ON MY WAY — going somewhere solo? See who's on your route, or bring someone along."
        />
      </div>
      <div className="ride-hero__sr-copy">
        <p>RIDE</p>
        <h1>ON MY WAY</h1>
        <p>{copy.subhead}</p>
        <p>{copy.support}</p>
      </div>
      <nav className="ride-hero__actions" aria-label="Ride actions">
        <a className="ride-button ride-button--primary" href={`/rides/request${scopedQuery}`}>
          <RideMapPinIcon />
          <span>Request a Ride</span>
        </a>
        <a className="ride-button" href={`/rides/offers${scopedQuery}`}>
          <RideBrowseIcon />
          <span>Browse Offers</span>
        </a>
        <a className="ride-button" href={`/rides/offers/new${scopedQuery}`}>
          <RideCarPlusIcon />
          <span>Offer Seats</span>
        </a>
      </nav>
      <p className="ride-privacy-chip">
        <RideLockIcon />
        <span>Where you meet stays between you.</span>
      </p>
    </header>
  );
}

function RideRecentOffers({
  context,
  offers,
  loading,
  photoUrl,
}: {
  readonly context: "MATCHDAY" | "GENERAL" | undefined;
  readonly offers: readonly PublicRideOffer[];
  readonly loading: boolean;
  readonly photoUrl: (offerId: string) => string;
}) {
  const scopedQuery = contextQuery(context);
  return (
    <section className="ride-home-panel panel">
      <RidePanelHeading
        eyebrow="RIDE OFFERS"
        actionHref={`/rides/offers${scopedQuery}`}
        actionLabel="View all"
      />
      <div className="ride-recent-list">
        {offers.map((offer) => (
          <a className="ride-recent-card" href={`/rides/offers/${offer.id}`} key={offer.id}>
            <span className="ride-recent-card__media" aria-label="Vehicle photo">
              {offer.hasVehiclePhoto ? (
                <img src={photoUrl(offer.id)} alt="Ride vehicle" />
              ) : (
                <RideCarPlusIcon />
              )}
            </span>
            <span className="ride-recent-card__body">
              <strong>{destinationLabel(offer.destination)}</strong>
              <span>From {offer.originAreaLabel}</span>
              <span>{formatRideTime(offer.departureAt)}</span>
              <span className="ride-recent-card__meta">
                <span>{offer.availableSeats} seats</span>
                <RideCompensationBadge terms={offer.compensationTerms} />
              </span>
            </span>
          </a>
        ))}
      </div>
      {!loading && !offers.length ? (
        <p className="ride-empty-state">No public Ride offers are available yet.</p>
      ) : null}
    </section>
  );
}

function RideRecentRequests({
  context,
  requests,
  loading,
}: {
  readonly context: "MATCHDAY" | "GENERAL" | undefined;
  readonly requests: readonly PublicRideRequest[];
  readonly loading: boolean;
}) {
  const scopedQuery = contextQuery(context);
  return (
    <section className="ride-home-panel panel">
      <RidePanelHeading
        eyebrow="RIDE REQUESTS"
        actionHref={`/rides/request${scopedQuery}`}
        actionLabel="View all"
      />
      <div className="ride-recent-list">
        {requests.map((requestItem) => (
          <article className="ride-recent-card ride-recent-card--request" key={requestItem.id}>
            <span className="ride-recent-card__avatar" aria-hidden="true">
              <RideHistoryIcon />
            </span>
            <span className="ride-recent-card__body">
              <strong>{destinationLabel(requestItem.destination)}</strong>
              <span>Pickup: {requestItem.pickupAreaLabel}</span>
              <span>{formatRideTime(requestItem.desiredDepartureAt)}</span>
              <span className="ride-recent-card__meta">
                <span>
                  {requestItem.passengerCount} passenger
                  {requestItem.passengerCount === 1 ? "" : "s"}
                </span>
                <RideCompensationBadge terms={requestItem.compensationTerms} mode="request" />
              </span>
            </span>
          </article>
        ))}
      </div>
      {!loading && !requests.length ? (
        <p className="ride-empty-state">No public Ride requests yet.</p>
      ) : null}
    </section>
  );
}

function RidePanelHeading({
  eyebrow,
  actionHref,
  actionLabel,
}: {
  readonly eyebrow: string;
  readonly actionHref: string;
  readonly actionLabel: string;
}) {
  return (
    <div className="ride-home-panel__header">
      <p className="eyebrow">{eyebrow}</p>
      <a className="ride-link" href={actionHref}>
        {actionLabel}
      </a>
    </div>
  );
}

function heroCopy(context: "MATCHDAY" | "GENERAL" | undefined) {
  if (context === "MATCHDAY") {
    return {
      subhead: "Going to the match solo? Why?",
      support: "See who's on your route — or if you've got a spare seat, bring someone along.",
      context: "MATCHDAY" as const,
    };
  }
  if (context === "GENERAL") {
    return {
      subhead: "Heading somewhere? See who's going your way.",
      support: "Airport, work, school, home or another city — travel together.",
      context: "GENERAL" as const,
    };
  }
  return {
    subhead: "Going somewhere solo? Why?",
    support: "See who's on your route — or if you've got a spare seat, bring someone along.",
    context: undefined,
  };
}
