import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  PublicRideOffer,
  RideMeetingPoint,
  RideOfferForOwner,
  RideParticipation,
} from "@hooma/contracts/rides";
import { useHoomaFrontend } from "../context";
import { createRideApi } from "./api";
import { isExpectedPrivateMiss } from "./ride-private";
import { destinationLabel, errorMessage, formatRideTime, passengerLabel } from "./ride-view-model";
import { RideVehiclePhotoPanel } from "./RideVehiclePhotoPanel";

export function RideOfferDetailPage({ offerId }: { readonly offerId: string }) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const [offer, setOffer] = useState<PublicRideOffer | null>(null);
  const [ownerOffer, setOwnerOffer] = useState<RideOfferForOwner | null>(null);
  const [myParticipation, setMyParticipation] = useState<RideParticipation | null>(null);
  const [meetingPoint, setMeetingPoint] = useState<RideMeetingPoint | null>(null);
  const [seatCount, setSeatCount] = useState("1");
  const [meetingParticipationId, setMeetingParticipationId] = useState("");
  const [meetingLabel, setMeetingLabel] = useState("");
  const [meetingLatitude, setMeetingLatitude] = useState("");
  const [meetingLongitude, setMeetingLongitude] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setMeetingPoint(null);
    void Promise.all([
      api.getOffer(offerId),
      api.manageOffer(offerId).catch((reason) => {
        if (isExpectedPrivateMiss(reason)) return null;
        throw reason;
      }),
      api.getMyParticipation(offerId).catch((reason) => {
        if (isExpectedPrivateMiss(reason)) return null;
        throw reason;
      }),
    ])
      .then(async ([publicOffer, privateOffer, restoredParticipation]) => {
        let restoredMeetingPoint: RideMeetingPoint | null = null;
        if (restoredParticipation?.status === "ACCEPTED") {
          restoredMeetingPoint = await api
            .getMeetingPoint(restoredParticipation.id)
            .catch((reason) => {
              if (isExpectedPrivateMiss(reason)) return null;
              throw reason;
            });
        }
        if (!active) return;
        setOffer(publicOffer);
        setOwnerOffer(privateOffer);
        setMyParticipation(restoredParticipation);
        setMeetingPoint(restoredMeetingPoint);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason, "Ride offer could not be loaded"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, offerId, refreshToken]);

  async function requestSeat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMemberError("");
    setNotice("");
    try {
      const participation = await api.requestParticipation(offerId, {
        seatCount: Number(seatCount),
      });
      setMyParticipation(participation);
      setNotice(
        "Ride participation requested. The driver must accept before exact meeting details are visible.",
      );
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to request this Ride"));
    } finally {
      setBusy(false);
    }
  }

  async function setParticipationStatus(
    participation: RideParticipation,
    action: "accept" | "reject" | "cancel",
  ) {
    setBusy(true);
    setMemberError("");
    setNotice("");
    try {
      if (action === "accept") await api.acceptParticipation(offerId, participation.id);
      if (action === "reject") await api.rejectParticipation(offerId, participation.id);
      if (action === "cancel") await api.cancelParticipation(offerId, participation.id);
      setRefreshToken((value) => value + 1);
      setNotice(
        `Participation ${action === "accept" ? "accepted" : action === "reject" ? "rejected" : "cancelled"}.`,
      );
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to update participation"));
    } finally {
      setBusy(false);
    }
  }

  async function saveMeetingPoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!meetingParticipationId) return;
    setBusy(true);
    setMemberError("");
    setNotice("");
    try {
      const saved = await api.setMeetingPoint(offerId, meetingParticipationId, {
        label: meetingLabel.trim(),
        latitude: meetingLatitude ? Number(meetingLatitude) : null,
        longitude: meetingLongitude ? Number(meetingLongitude) : null,
      });
      setMeetingPoint(saved);
      setNotice("Exact meeting point saved for authorized Ride parties.");
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to save meeting point"));
    } finally {
      setBusy(false);
    }
  }

  async function cancelOffer() {
    setBusy(true);
    setMemberError("");
    setNotice("");
    try {
      await api.cancelOffer(offerId);
      setRefreshToken((value) => value + 1);
      setNotice("Ride offer cancelled.");
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to cancel Ride offer"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="ride-state panel">Loading Ride offer...</p>;
  if (error) return <p className="ride-state panel error">{error}</p>;
  if (!offer) return <p className="ride-state panel">Ride offer not found.</p>;

  const acceptedParticipations =
    ownerOffer?.participations.filter((participation) => participation.status === "ACCEPTED") ?? [];

  return (
    <section className="ride-page ride-detail">
      <article className="ride-detail-card panel">
        <div className="ride-detail-card__photo">
          {offer.hasVehiclePhoto ? (
            <img src={api.offerPhotoUrl(offer.id)} alt="" />
          ) : (
            <span>RIDE</span>
          )}
        </div>
        <div>
          <p className="eyebrow">{offer.status}</p>
          <h1>{destinationLabel(offer.destination)}</h1>
          <p>{formatRideTime(offer.departureAt)}</p>
          <p>
            From {offer.originAreaLabel} - {offer.availableSeats}/{offer.totalSeats} seats open
          </p>
          {[offer.vehicleColor, offer.vehicleMake, offer.vehicleModel].filter(Boolean).length ? (
            <p className="muted">
              {[offer.vehicleColor, offer.vehicleMake, offer.vehicleModel]
                .filter(Boolean)
                .join(" ")}
            </p>
          ) : null}
          {offer.note ? <p>{offer.note}</p> : null}
        </div>
      </article>

      <figure className="ride-map-preview panel">
        <img
          className="ride-map-preview__image"
          src={api.offerMapPreviewUrl(offer.id)}
          alt={`Public Ride map preview for ${destinationLabel(offer.destination)}`}
        />
        <figcaption>
          <p className="eyebrow">PUBLIC MAP PREVIEW</p>
          <p className="muted">Approximate destination only. Exact meeting points stay private.</p>
        </figcaption>
      </figure>

      {notice ? <p className="ride-state panel success">{notice}</p> : null}
      {memberError ? <p className="ride-state panel error">{memberError}</p> : null}

      {ownerOffer ? (
        <section className="ride-owner panel">
          <div>
            <p className="eyebrow">DRIVER CONTROLS</p>
            <h2>Manage this Ride</h2>
          </div>
          <RideVehiclePhotoPanel offerId={offer.id} hasVehiclePhoto={offer.hasVehiclePhoto} />
          <button
            className="ride-button"
            type="button"
            disabled={busy}
            onClick={() => void cancelOffer()}
          >
            Cancel Ride offer
          </button>
          <div className="ride-participations">
            <h3>Participation requests</h3>
            {ownerOffer.participations.map((participation) => (
              <article className="ride-participation" key={participation.id}>
                <div>
                  <strong>{participation.status}</strong>
                  <span>
                    {passengerLabel(participation)} - {participation.seatCount} seat
                    {participation.seatCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="ride-actions">
                  {participation.status === "REQUESTED" ? (
                    <>
                      <button
                        className="ride-button ride-button--primary"
                        type="button"
                        disabled={busy}
                        onClick={() => void setParticipationStatus(participation, "accept")}
                      >
                        Accept
                      </button>
                      <button
                        className="ride-button"
                        type="button"
                        disabled={busy}
                        onClick={() => void setParticipationStatus(participation, "reject")}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
            {!ownerOffer.participations.length ? (
              <p className="muted">No participation requests yet.</p>
            ) : null}
          </div>
          {acceptedParticipations.length ? (
            <form className="ride-form ride-meeting-form" onSubmit={saveMeetingPoint}>
              <h3>Private meeting point</h3>
              <label className="ride-field">
                <span>Accepted passenger</span>
                <select
                  value={meetingParticipationId}
                  onChange={(event) => setMeetingParticipationId(event.target.value)}
                  required
                >
                  <option value="">Choose accepted passenger</option>
                  {acceptedParticipations.map((participation) => (
                    <option key={participation.id} value={participation.id}>
                      {passengerLabel(participation)} - {participation.seatCount} seat
                    </option>
                  ))}
                </select>
              </label>
              <label className="ride-field">
                <span>Meeting label</span>
                <input
                  value={meetingLabel}
                  onChange={(event) => setMeetingLabel(event.target.value)}
                  required
                />
              </label>
              <div className="ride-form__grid">
                <label className="ride-field">
                  <span>Latitude optional</span>
                  <input
                    type="number"
                    step="any"
                    value={meetingLatitude}
                    onChange={(event) => setMeetingLatitude(event.target.value)}
                  />
                </label>
                <label className="ride-field">
                  <span>Longitude optional</span>
                  <input
                    type="number"
                    step="any"
                    value={meetingLongitude}
                    onChange={(event) => setMeetingLongitude(event.target.value)}
                  />
                </label>
              </div>
              <button className="ride-button ride-button--primary" type="submit" disabled={busy}>
                Save meeting point
              </button>
              {meetingPoint ? (
                <>
                  <p className="success">Saved: {meetingPoint.label}</p>
                  <figure className="ride-map-preview ride-map-preview--private">
                    <img
                      className="ride-map-preview__image"
                      src={api.meetingPointMapPreviewUrl(meetingPoint.participationId)}
                      alt={`Private meeting point preview for ${meetingPoint.label}`}
                    />
                    <figcaption>
                      <p className="eyebrow">PRIVATE EXACT PREVIEW</p>
                      <p className="muted">Visible only to the driver and accepted passenger.</p>
                    </figcaption>
                  </figure>
                </>
              ) : null}
            </form>
          ) : null}
        </section>
      ) : (
        <PassengerParticipationPanel
          busy={busy}
          meetingPoint={meetingPoint}
          myParticipation={myParticipation}
          onRequestSeat={requestSeat}
          seatCount={seatCount}
          setSeatCount={setSeatCount}
        />
      )}
    </section>
  );
}

function PassengerParticipationPanel({
  busy,
  meetingPoint,
  myParticipation,
  onRequestSeat,
  seatCount,
  setSeatCount,
}: {
  readonly busy: boolean;
  readonly meetingPoint: RideMeetingPoint | null;
  readonly myParticipation: RideParticipation | null;
  readonly onRequestSeat: (event: FormEvent<HTMLFormElement>) => void;
  readonly seatCount: string;
  readonly setSeatCount: (value: string) => void;
}) {
  if (myParticipation) {
    return (
      <section className="ride-form panel">
        <p className="eyebrow">YOUR RIDE REQUEST</p>
        <h2>{myParticipation.status}</h2>
        <p>
          {myParticipation.seatCount} seat{myParticipation.seatCount === 1 ? "" : "s"} requested.
          This status is restored from your signed-in Ride participation.
        </p>
        {myParticipation.status === "ACCEPTED" ? (
          <div className="ride-meeting-point">
            <strong>Private meeting point</strong>
            {meetingPoint ? (
              <span>
                {meetingPoint.label}
                {meetingPoint.latitude !== null && meetingPoint.longitude !== null
                  ? ` (${meetingPoint.latitude}, ${meetingPoint.longitude})`
                  : ""}
              </span>
            ) : (
              <span>The driver has not shared the exact meeting point yet.</span>
            )}
          </div>
        ) : (
          <p className="muted">
            Exact meeting details remain private until the driver accepts this Ride participation.
          </p>
        )}
      </section>
    );
  }

  return (
    <form className="ride-form panel" onSubmit={onRequestSeat}>
      <p className="eyebrow">JOIN THIS RIDE</p>
      <label className="ride-field">
        <span>Seats requested</span>
        <input
          type="number"
          min="1"
          inputMode="numeric"
          value={seatCount}
          onChange={(event) => setSeatCount(event.target.value)}
          required
        />
      </label>
      <button className="ride-button ride-button--primary" type="submit" disabled={busy}>
        {busy ? "Requesting..." : "Request participation"}
      </button>
    </form>
  );
}
