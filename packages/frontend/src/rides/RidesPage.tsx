import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  PublicRideOffer,
  PublicRideRequest,
  RideDestinationInput,
  RideDestinationSummary,
  RideMeetingPoint,
  RideOfferCreateInput,
  RideOfferForOwner,
  RideParticipation,
  RideRequestCreateInput,
  RideRequestForOwner,
} from "@hooma/contracts/rides";
import { useHoomaFrontend } from "../context";
import { HoomaApiError } from "../http";
import { createRideApi } from "./api";

type DestinationFormState = {
  readonly type: RideDestinationInput["type"];
  readonly eventId: string;
  readonly placeId: string;
  readonly customDestinationLabel: string;
};

const emptyDestination: DestinationFormState = {
  type: "CUSTOM",
  eventId: "",
  placeId: "",
  customDestinationLabel: "",
};

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

function isExpectedPrivateMiss(reason: unknown): boolean {
  return (
    reason instanceof HoomaApiError &&
    ["AUTH_REQUIRED", "RIDE_OFFER_MANAGE_FORBIDDEN", "RIDE_REQUEST_MANAGE_FORBIDDEN"].includes(
      reason.code ?? "",
    )
  );
}

function dateTimeInputValue(minutesFromNow: number): string {
  const date = new Date(Date.now() + minutesFromNow * 60_000);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string): string {
  return new Date(value).toISOString();
}

function destinationInput(state: DestinationFormState): RideDestinationInput {
  if (state.type === "EVENT") return { type: "EVENT", eventId: state.eventId.trim() };
  if (state.type === "PLACE") return { type: "PLACE", placeId: state.placeId.trim() };
  return { type: "CUSTOM", customDestinationLabel: state.customDestinationLabel.trim() };
}

function destinationLabel(destination: RideDestinationSummary): string {
  switch (destination.type) {
    case "EVENT":
      return destination.title;
    case "PLACE":
      return [destination.name, destination.houma, destination.city].filter(Boolean).join(" · ");
    case "CUSTOM":
      return destination.label;
  }
}

function formatRideTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function RideSectionHeader({
  eyebrow,
  title,
  body,
  actionHref,
  actionLabel,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly actionHref?: string;
  readonly actionLabel?: string;
}) {
  return (
    <header className="ride-section-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
      {actionHref && actionLabel ? (
        <a className="ride-button ride-button--primary" href={actionHref}>
          {actionLabel}
        </a>
      ) : null}
    </header>
  );
}

function RideDestinationFields({
  destination,
  onChange,
}: {
  readonly destination: DestinationFormState;
  readonly onChange: (destination: DestinationFormState) => void;
}) {
  return (
    <div className="ride-form__destination">
      <label className="ride-field">
        <span>Destination type</span>
        <select
          value={destination.type}
          onChange={(event) =>
            onChange({ ...destination, type: event.target.value as RideDestinationInput["type"] })
          }
        >
          <option value="CUSTOM">Custom destination</option>
          <option value="EVENT">Event ID</option>
          <option value="PLACE">Place ID</option>
        </select>
      </label>

      {destination.type === "EVENT" ? (
        <label className="ride-field">
          <span>Published Event ID</span>
          <input
            value={destination.eventId}
            onChange={(event) => onChange({ ...destination, eventId: event.target.value })}
            required
          />
        </label>
      ) : null}

      {destination.type === "PLACE" ? (
        <label className="ride-field">
          <span>Approved Place ID</span>
          <input
            value={destination.placeId}
            onChange={(event) => onChange({ ...destination, placeId: event.target.value })}
            required
          />
        </label>
      ) : null}

      {destination.type === "CUSTOM" ? (
        <label className="ride-field">
          <span>Destination label</span>
          <input
            value={destination.customDestinationLabel}
            onChange={(event) =>
              onChange({ ...destination, customDestinationLabel: event.target.value })
            }
            placeholder="Stade Olympique, Fan Zone, derby night..."
            required
          />
        </label>
      ) : null}
    </div>
  );
}

export function RidesPage() {
  return <RideGatewayPage />;
}

export function RideGatewayPage() {
  return (
    <section className="ride-page ride-gateway">
      <header className="ride-hero">
        <p className="eyebrow">RIDE</p>
        <h1>Get there with HOOMA</h1>
        <p>
          Create a real Ride request, browse available Ride offers, and keep private pickup details
          visible only to the right people.
        </p>
      </header>

      <div className="ride-gateway__grid" aria-label="Ride gateway">
        <a className="ride-gateway-card ride-gateway-card--primary" href="/rides/request">
          <span>TAKE ME TO THE GAME</span>
          <strong>Request a seat</strong>
          <small>
            Tell the Ride domain where you need to go. No fake matching, no fare collection.
          </small>
        </a>
        <a className="ride-gateway-card" href="/rides/offers">
          <span>RIDE OFFERS</span>
          <strong>Find a driver</strong>
          <small>Browse public offers and request participation through the real API.</small>
        </a>
      </div>
    </section>
  );
}

export function RideOffersPage() {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const [offers, setOffers] = useState<PublicRideOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api
      .listOffers({ limit: 30 })
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
  }, [api]);

  return (
    <section className="ride-page">
      <RideSectionHeader
        eyebrow="RIDE OFFERS"
        title="Drivers heading out"
        body="Public Ride offers come from the Ride API. Exact meeting points stay private."
        actionHref="/rides/offers/new"
        actionLabel="Offer a Ride"
      />
      {loading ? <p className="ride-state panel">Loading Ride offers…</p> : null}
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

function RideOfferCard({
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
          From {offer.originAreaLabel} · {offer.availableSeats}/{offer.totalSeats} seats open
        </small>
      </div>
    </a>
  );
}

export function RideOfferCreatePage() {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const [destination, setDestination] = useState<DestinationFormState>(emptyDestination);
  const [originAreaLabel, setOriginAreaLabel] = useState("");
  const [departureAt, setDepartureAt] = useState(dateTimeInputValue(90));
  const [totalSeats, setTotalSeats] = useState("2");
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
        destination: destinationInput(destination),
        originAreaLabel: originAreaLabel.trim(),
        departureAt: toIsoDateTime(departureAt),
        totalSeats: Number(totalSeats),
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
        actionHref="/rides/offers"
        actionLabel="View offers"
      />
      {savedOffer ? (
        <section className="ride-created panel">
          <p className="eyebrow">RIDE OFFER CREATED</p>
          <h2>{destinationLabel(savedOffer.destination)}</h2>
          <p>Your offer is live. You can add or replace the vehicle photo now.</p>
          <RideVehiclePhotoPanel
            offerId={savedOffer.id}
            hasVehiclePhoto={savedOffer.hasVehiclePhoto}
          />
          <div className="ride-actions">
            <a className="ride-button ride-button--primary" href={`/rides/offers/${savedOffer.id}`}>
              Manage offer
            </a>
            <a className="ride-button" href="/rides/offers/new">
              Create another
            </a>
          </div>
        </section>
      ) : (
        <form className="ride-form panel" onSubmit={submit}>
          <RideDestinationFields destination={destination} onChange={setDestination} />
          <label className="ride-field">
            <span>Origin area</span>
            <input
              value={originAreaLabel}
              onChange={(event) => setOriginAreaLabel(event.target.value)}
              placeholder="Lac 2, downtown, north gate..."
              required
            />
          </label>
          <div className="ride-form__grid">
            <label className="ride-field">
              <span>Departure time</span>
              <input
                type="datetime-local"
                value={departureAt}
                onChange={(event) => setDepartureAt(event.target.value)}
                required
              />
            </label>
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
          </div>
          <div className="ride-form__grid">
            <label className="ride-field">
              <span>Vehicle make</span>
              <input value={vehicleMake} onChange={(event) => setVehicleMake(event.target.value)} />
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
          <label className="ride-field">
            <span>Note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="ride-button ride-button--primary" type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create Ride offer"}
          </button>
        </form>
      )}
    </section>
  );
}

export function RideOfferDetailPage({ offerId }: { readonly offerId: string }) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const [offer, setOffer] = useState<PublicRideOffer | null>(null);
  const [ownerOffer, setOwnerOffer] = useState<RideOfferForOwner | null>(null);
  const [requestedParticipation, setRequestedParticipation] = useState<RideParticipation | null>(
    null,
  );
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
    void Promise.all([
      api.getOffer(offerId),
      api.manageOffer(offerId).catch((reason) => {
        if (isExpectedPrivateMiss(reason)) return null;
        throw reason;
      }),
    ])
      .then(([publicOffer, privateOffer]) => {
        if (!active) return;
        setOffer(publicOffer);
        setOwnerOffer(privateOffer);
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
      setRequestedParticipation(participation);
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

  if (loading) return <p className="ride-state panel">Loading Ride offer…</p>;
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
            From {offer.originAreaLabel} · {offer.availableSeats}/{offer.totalSeats} seats open
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
                    {participation.seatCount} seat{participation.seatCount === 1 ? "" : "s"} ·{" "}
                    {participation.id}
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
                <span>Accepted participation</span>
                <select
                  value={meetingParticipationId}
                  onChange={(event) => setMeetingParticipationId(event.target.value)}
                  required
                >
                  <option value="">Choose accepted passenger</option>
                  {acceptedParticipations.map((participation) => (
                    <option key={participation.id} value={participation.id}>
                      {participation.id} · {participation.seatCount} seat
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
              {meetingPoint ? <p className="success">Saved: {meetingPoint.label}</p> : null}
            </form>
          ) : null}
        </section>
      ) : (
        <form className="ride-form panel" onSubmit={requestSeat}>
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
            {busy ? "Requesting…" : "Request participation"}
          </button>
          {requestedParticipation ? (
            <p className="muted">
              Request saved as {requestedParticipation.id}. Exact meeting details are private until
              the driver accepts.
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}

function RideVehiclePhotoPanel({
  offerId,
  hasVehiclePhoto,
}: {
  readonly offerId: string;
  readonly hasVehiclePhoto: boolean;
}) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await api.replaceOfferVehiclePhoto(offerId, file);
      setFile(null);
      setMessage("Vehicle photo saved. Refresh the offer to see the latest image.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to save vehicle photo"));
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await api.deleteOfferVehiclePhoto(offerId);
      setMessage("Vehicle photo removed.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to remove vehicle photo"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ride-photo-panel">
      <form onSubmit={upload}>
        <label className="ride-field">
          <span>{hasVehiclePhoto ? "Replace vehicle photo" : "Vehicle photo"}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <div className="ride-actions">
          <button
            className="ride-button ride-button--primary"
            type="submit"
            disabled={!file || busy}
          >
            {busy ? "Saving…" : "Upload photo"}
          </button>
          {hasVehiclePhoto ? (
            <button
              className="ride-button"
              type="button"
              disabled={busy}
              onClick={() => void removePhoto()}
            >
              Remove photo
            </button>
          ) : null}
        </div>
      </form>
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

export function RideRequestCreatePage() {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const [destination, setDestination] = useState<DestinationFormState>(emptyDestination);
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
            {saving ? "Creating…" : "Create Ride request"}
          </button>
        </form>
      )}

      <section className="ride-request-preview panel">
        <p className="eyebrow">PUBLIC RIDE REQUESTS</p>
        {loadingRequests ? <p className="muted">Loading recent Ride requests…</p> : null}
        {!loadingRequests && !publicRequests.length ? (
          <p className="muted">No public Ride requests yet.</p>
        ) : null}
        {publicRequests.map((requestItem) => (
          <article className="ride-request-row" key={requestItem.id}>
            <strong>{destinationLabel(requestItem.destination)}</strong>
            <span>
              {requestItem.pickupAreaLabel} · {requestItem.passengerCount} passenger
              {requestItem.passengerCount === 1 ? "" : "s"}
            </span>
          </article>
        ))}
      </section>
    </section>
  );
}
