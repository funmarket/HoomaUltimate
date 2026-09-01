import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { MeResponse, PlayEventVisibility, WatchEventKind } from "@hooma/contracts";
import type { PublicPlaceSummary } from "@hooma/contracts/places";
import type { PublicPitch } from "@hooma/contracts/pitch";
import { useHoomaFrontend } from "../context";
import { GameLocationPicker } from "../game-location/GameLocationPicker";
import { createPlacesApi } from "../places/api";
import { createPitchApi } from "../pitch/api";
import { useEventApi } from "./useEventApi";
import { WatchEventForm, type WatchEventFormValue } from "./WatchEventForm";

export function CreateEventPage() {
  const eventApi = useEventApi();
  const { api, transport, protectedError } = useHoomaFrontend();
  const placesApi = useMemo(() => createPlacesApi(transport), [transport]);
  const pitchApi = useMemo(() => createPitchApi(transport), [transport]);
  const searchParams = new URLSearchParams(window.location.search);
  const watchMode = searchParams.get("type") === "WATCH";
  const initialWatchKind: WatchEventKind =
    searchParams.get("kind") === "CULTURAL" ? "CULTURAL" : "MATCH";
  const initialPlaceId = searchParams.get("placeId") ?? "";
  const [me, setMe] = useState<MeResponse | null>(null);
  const [places, setPlaces] = useState<PublicPlaceSummary[]>([]);
  const [pitches, setPitches] = useState<PublicPitch[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    if (watchMode) {
      void Promise.all([api.identity.me(), placesApi.list()])
        .then(([identity, placeRows]) => {
          setMe(identity);
          setPlaces(placeRows);
        })
        .catch((reason) => setError(protectedError(reason, "Authentication required")));
      return;
    }
    void Promise.all([api.identity.me(), pitchApi.list()])
      .then(([identity, pitchRows]) => {
        setMe(identity);
        setPitches(pitchRows);
      })
      .catch((reason) => setError(protectedError(reason, "Authentication required")));
  }, [api, pitchApi, placesApi, protectedError, watchMode]);

  const communities =
    me?.communities.filter(
      (membership) => membership.role === "FOUNDER" || membership.role === "COACH",
    ) ?? [];

  async function submitWatch(value: WatchEventFormValue) {
    if (!value.placeId) return;
    setPending(true);
    setError("");
    try {
      const created = await eventApi.create({
        communityId: null,
        placeId: value.placeId,
        type: "WATCH",
        title: value.title,
        description: value.description,
        startsAt: value.startsAt,
        endsAt: value.endsAt,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Tunis",
        venueName: null,
        address: null,
        capacity: value.capacity,
        waitlistEnabled: true,
        entryFeeMinor: 0,
        currency: "TND",
        play: null,
        watch: value.watch,
      });
      window.location.href = `/events/${created.id}`;
    } catch (reason) {
      setError(protectedError(reason, "Unable to create Watch event"));
    } finally {
      setPending(false);
    }
  }

  function submitPlay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const startsAt = new Date(String(data.get("startsAt")));
    const endsValue = String(data.get("endsAt") || "");
    const endsAt = endsValue ? new Date(endsValue) : null;
    const placeId = String(data.get("placeId") || "").trim() || null;
    const venueName = placeId ? null : String(data.get("venueName") || "").trim() || null;
    const address = placeId ? null : String(data.get("address") || "").trim() || null;
    setError("");

    void eventApi
      .create({
        title: String(data.get("title")),
        description: String(data.get("description")) || null,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt?.toISOString() ?? null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Tunis",
        capacity: data.get("capacity") ? Number(data.get("capacity")) : null,
        waitlistEnabled: true,
        entryFeeMinor: 0,
        currency: "TND",
        communityId: String(data.get("communityId")),
        placeId,
        type: "PLAY",
        venueName,
        address,
        play: {
          pitchType: String(data.get("pitchType")) as "FIVE_A_SIDE",
          skillLevel: String(data.get("skillLevel")) as "MIXED",
          format: String(data.get("format")) as "FIVE_V_FIVE",
          visibility: String(data.get("visibility")) as PlayEventVisibility,
        },
        watch: null,
      })
      .then((created) => {
        window.location.href = `/events/${created.id}`;
      })
      .catch((reason) => setError(protectedError(reason, "Unable to create game")));
  }

  if (!me && error)
    return (
      <section className="panel">
        <p className="error">{error}</p>
      </section>
    );

  if (watchMode) {
    return (
      <section className="watch-event-form-page">
        <header className="watch-event-form-page__header">
          <p className="eyebrow">WATCH</p>
          <h1>Create Event</h1>
          <p>Create a Match watch night or a Cultural event at one approved Place.</p>
        </header>
        {!places.length ? (
          <div className="panel">
            <p className="status">
              An approved Place is required before a Watch event can be created.
            </p>
            <a href="/places/new">Add a Place</a>
          </div>
        ) : (
          <WatchEventForm
            places={places}
            initialKind={initialWatchKind}
            initialPlaceId={initialPlaceId}
            submitLabel="Publish Watch Event"
            pending={pending}
            onSubmit={submitWatch}
          />
        )}
        {error ? <p className="error">{error}</p> : null}
      </section>
    );
  }

  return (
    <section>
      <p className="eyebrow">PLAY</p>
      <h2>Create a game</h2>
      {!communities.length ? (
        <p className="status">
          You need Founder or Coach authority in a HOOMA community to create a community game.
        </p>
      ) : (
        <form className="event-form panel" onSubmit={submitPlay}>
          <label>
            HOOMA community
            <select name="communityId" required>
              {communities.map((community) => (
                <option value={community.id} key={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Game title
            <input name="title" required />
          </label>
          <label>
            Description
            <textarea name="description" rows={4} />
          </label>
          <div className="form-grid">
            <label>
              Starts
              <input name="startsAt" type="datetime-local" required />
            </label>
            <label>
              Ends
              <input name="endsAt" type="datetime-local" />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Capacity
              <input name="capacity" type="number" min="1" max="1000" />
            </label>
            <label>
              Match visibility
              <select name="visibility" defaultValue="OPEN">
                <option value="OPEN">Open match</option>
                <option value="PRIVATE">Private match</option>
              </select>
              <span className="muted">
                Open matches are visible to every signed-in HOOMA account.
              </span>
            </label>
          </div>
          <div className="form-grid">
            <label>
              Format
              <select name="format" defaultValue="FIVE_V_FIVE">
                <option value="FIVE_V_FIVE">5 v 5</option>
                <option value="SEVEN_V_SEVEN">7 v 7</option>
                <option value="ELEVEN_V_ELEVEN">11 v 11</option>
              </select>
            </label>
            <label>
              Pitch type
              <select name="pitchType" defaultValue="FIVE_A_SIDE">
                <option value="FIVE_A_SIDE">5-a-side</option>
                <option value="SEVEN_A_SIDE">7-a-side</option>
                <option value="ELEVEN_A_SIDE">11-a-side</option>
                <option value="FUTSAL">Futsal</option>
                <option value="STREET">Street</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
          </div>
          <label>
            Skill level
            <select name="skillLevel" defaultValue="MIXED">
              <option value="MIXED">Mixed</option>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
          </label>
          <GameLocationPicker pitches={pitches} />
          <p className="muted">
            Paid game entry is intentionally disabled until Cash and Telegram Stars are wired into
            Payments.
          </p>
          <button type="submit">Publish game</button>
          {error ? <p className="error">{error}</p> : null}
        </form>
      )}
    </section>
  );
}
