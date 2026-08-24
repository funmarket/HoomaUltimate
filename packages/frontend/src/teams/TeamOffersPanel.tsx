import { useCallback, useEffect, useMemo, useState } from "react";
import { useHoomaFrontend } from "../context";
import { createTeamOfferApi, type TeamPlayerOffer } from "./team-offer-api";

export function TeamOffersPanel({ onAccepted }: { onAccepted?: () => void | Promise<void> }) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createTeamOfferApi(transport), [transport]);
  const [offers, setOffers] = useState<TeamPlayerOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const incoming = await api.incoming();
    setOffers(incoming);
  }, [api]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void api
      .incoming()
      .then((incoming) => {
        if (active) setOffers(incoming);
      })
      .catch((reason) => {
        if (active) setError(protectedError(reason, "Unable to load Team offers"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, protectedError]);

  async function accept(offer: TeamPlayerOffer) {
    setBusyOfferId(offer.id);
    setError("");
    try {
      await api.accept(offer.id);
      await onAccepted?.();
      await load();
    } catch (reason) {
      setError(protectedError(reason, "Unable to accept Team offer"));
    } finally {
      setBusyOfferId(null);
    }
  }

  async function decline(offer: TeamPlayerOffer) {
    setBusyOfferId(offer.id);
    setError("");
    try {
      await api.decline(offer.id);
      await load();
    } catch (reason) {
      setError(protectedError(reason, "Unable to decline Team offer"));
    } finally {
      setBusyOfferId(null);
    }
  }

  if (loading) return null;
  if (!offers.length && !error) return null;

  return (
    <section className="panel team-offers-panel">
      <div>
        <p className="eyebrow">TEAM OFFERS</p>
        <h3>Teams want you</h3>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="team-offers-list">
        {offers.map((offer) => (
          <article className="team-offer-request" key={offer.id}>
            <div className="team-offer-request__team">
              {offer.team.badgeUrl ? <img src={offer.team.badgeUrl} alt="" /> : null}
              <div>
                <strong>{offer.team.name} wants you</strong>
                <span>They offered you a spot on their Team.</span>
              </div>
            </div>
            {offer.message ? (
              <p className="team-offer-request__message">“{offer.message}”</p>
            ) : null}
            <div className="team-offer-request__actions">
              <button
                type="button"
                className="button"
                disabled={busyOfferId === offer.id}
                onClick={() => void accept(offer)}
              >
                {busyOfferId === offer.id ? "Working…" : "Accept Spot"}
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busyOfferId === offer.id}
                onClick={() => void decline(offer)}
              >
                Decline
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
