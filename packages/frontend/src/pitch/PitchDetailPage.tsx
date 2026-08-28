import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PublicPlaceSummary } from "@hooma/contracts/places";
import type { PublicPitch } from "@hooma/contracts/pitch";
import { useHoomaFrontend } from "../context";
import { HoomaApiError } from "../http";
import { PlaceGallery } from "../places/PlaceGallery";
import { createPlacesApi } from "../places/api";
import { InfoIcon, PhoneIcon, PinIcon } from "../ui/HoomaIcons";
import { createPitchApi } from "./api";
import { formatPitchHourlyRate } from "./pricing";

function mapHref(place: PublicPlaceSummary): string {
  const query =
    place.latitude != null && place.longitude != null
      ? `${place.latitude},${place.longitude}`
      : [place.address, place.houma, place.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function PitchDetailPage({ placeId }: { readonly placeId: string }) {
  const { transport, protectedError } = useHoomaFrontend();
  const pitchApi = useMemo(() => createPitchApi(transport), [transport]);
  const placesApi = useMemo(() => createPlacesApi(transport), [transport]);
  const [item, setItem] = useState<PublicPitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifiedOwner, setVerifiedOwner] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimPending, setClaimPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    void pitchApi
      .get(placeId)
      .then(setItem)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load Pitch"),
      )
      .finally(() => setLoading(false));

    void placesApi
      .ownershipStatus(placeId)
      .then((status) => setVerifiedOwner(status.verified))
      .catch((reason) => {
        if (reason instanceof HoomaApiError && [401, 403].includes(reason.status)) return;
      });
  }, [pitchApi, placesApi, placeId]);

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setClaimPending(true);
    setError("");
    setMessage("");
    try {
      await placesApi.claimOwnership(placeId, {
        evidence: String(data.get("evidence") ?? ""),
      });
      event.currentTarget.reset();
      setClaimOpen(false);
      setMessage("Ownership claim submitted for App review.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to submit ownership claim"));
    } finally {
      setClaimPending(false);
    }
  }

  if (loading) return <p className="status">Loading pitch…</p>;
  if (error && !item) return <p className="error">{error}</p>;
  if (!item) {
    return (
      <section className="pitch-detail-page">
        <div className="panel pitch-empty">
          <h1>Pitch unavailable</h1>
          <p className="muted">This pitch is not currently approved or publicly available.</p>
          <a className="pitch-back-link" href="/pitch">
            Back to Pitch
          </a>
        </div>
      </section>
    );
  }

  const place = item.place;
  const rate = formatPitchHourlyRate(item.hourlyRateMinor, item.currency);
  const description =
    item.summary ?? place.description ?? "Rent this football pitch through HOOMA.";
  const hasContact = Boolean(place.phone || place.email || place.websiteUrl);

  return (
    <section className="pitch-detail-page">
      <nav className="pitch-actions" aria-label="Pitch sections">
        <a className="pitch-action pitch-action--active" href="/pitch">
          Pitches
        </a>
        <a className="pitch-action pitch-action--primary" href="/places/new?kind=PITCH">
          Suggest a Pitch
        </a>
      </nav>

      <div className="pitch-detail-toolbar">
        <a className="pitch-back-link" href="/pitch" aria-label="Back to Pitch">
          ← Pitch
        </a>
        {verifiedOwner ? (
          <a
            className="pitch-owner-link pitch-owner-link--toolbar"
            href={`/pitch/manage?placeId=${encodeURIComponent(place.id)}`}
          >
            Manage pitch
          </a>
        ) : null}
      </div>

      <header className="pitch-detail-hero">
        <p className="pitch-detail-hero__eyebrow">PITCH RENTAL</p>
        <h1>{place.name}</h1>
        <p className="pitch-detail-hero__description">{description}</p>
        <div className="pitch-detail-rate" aria-label="Hourly rental price">
          <strong>{rate}</strong>
          <span>{item.currency} / hour</span>
        </div>
      </header>

      <div className="place-info-grid pitch-info-grid">
        <article>
          <div className="place-info-card__heading">
            <PinIcon />
            <span>Address</span>
          </div>
          <strong>{place.address}</strong>
          {place.city ? <span className="place-info-card__secondary">{place.city}</span> : null}
        </article>
        <article>
          <div className="place-info-card__heading">
            <PinIcon />
            <span>Houma</span>
          </div>
          <strong>{place.houma || "—"}</strong>
          <a
            className="place-info-card__action"
            href={mapHref(place)}
            target="_blank"
            rel="noreferrer"
          >
            View on map
          </a>
        </article>
        <article>
          <div className="place-info-card__heading">
            <PhoneIcon />
            <span>Contact</span>
          </div>
          {hasContact ? (
            <div className="place-info-values">
              {place.phone ? <a href={`tel:${place.phone}`}>{place.phone}</a> : null}
              {place.email ? <a href={`mailto:${place.email}`}>{place.email}</a> : null}
              {place.websiteUrl ? (
                <a href={place.websiteUrl} target="_blank" rel="noreferrer">
                  Website
                </a>
              ) : null}
            </div>
          ) : (
            <strong>—</strong>
          )}
          {place.phone ? (
            <a className="place-info-card__action" href={`tel:${place.phone}`}>
              <PhoneIcon size={16} /> Call
            </a>
          ) : null}
        </article>
        <article>
          <div className="place-info-card__heading">
            <InfoIcon />
            <span>About</span>
          </div>
          <strong>{place.description || item.summary || "—"}</strong>
        </article>
      </div>

      <PlaceGallery place={place} />

      <div className="pitch-detail-actions">
        {place.phone ? (
          <a
            className="pitch-detail-action pitch-detail-action--primary"
            href={`tel:${place.phone}`}
          >
            <PhoneIcon size={18} />
            Contact venue
          </a>
        ) : null}
        {!verifiedOwner ? (
          <button
            className="pitch-detail-action pitch-detail-action--secondary"
            type="button"
            onClick={() => setClaimOpen((value) => !value)}
          >
            Own this pitch?
          </button>
        ) : null}
      </div>

      {claimOpen && !verifiedOwner ? (
        <form className="panel pitch-claim-form" onSubmit={(event) => void claim(event)}>
          <div>
            <p className="eyebrow">CLAIM THIS PITCH</p>
            <h2>{place.name}</h2>
            <p className="muted">Tell the App Admin how you own or manage this venue.</p>
          </div>
          <label>
            Ownership or management evidence
            <textarea name="evidence" minLength={10} required />
          </label>
          <button type="submit" disabled={claimPending}>
            {claimPending ? "Submitting…" : "Submit claim"}
          </button>
        </form>
      ) : null}

      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
