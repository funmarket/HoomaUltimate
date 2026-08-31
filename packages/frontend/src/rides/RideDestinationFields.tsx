import { useEffect, useMemo, useState } from "react";
import type { PublicEvent } from "@hooma/contracts/events";
import type { RideDestinationInput } from "@hooma/contracts/rides";
import type { PublicPlaceSummary } from "@hooma/contracts/places";
import { useHoomaFrontend } from "../context";
import { createEventApi } from "../events/api";
import { createPlacesApi } from "../places/api";
import type { DestinationFormState } from "./ride-view-model";

export function RideDestinationFields({
  destination,
  onChange,
}: {
  readonly destination: DestinationFormState;
  readonly onChange: (destination: DestinationFormState) => void;
}) {
  const { transport } = useHoomaFrontend();
  const eventApi = useMemo(() => createEventApi(transport), [transport]);
  const placesApi = useMemo(() => createPlacesApi(transport), [transport]);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [places, setPlaces] = useState<PublicPlaceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([eventApi.publicPlay(), eventApi.publicWatch(), placesApi.list()])
      .then(([playEvents, watchEvents, placeItems]) => {
        if (!active) return;
        setEvents([...playEvents.items, ...watchEvents.items]);
        setPlaces(placeItems);
      })
      .catch(() => {
        if (!active) return;
        setEvents([]);
        setPlaces([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventApi, placesApi]);

  function setType(type: RideDestinationInput["type"]) {
    onChange({ type, eventId: "", placeId: "", customDestinationLabel: "" });
  }

  return (
    <div className="ride-form__destination">
      <label className="ride-field">
        <span>Destination type</span>
        <select
          value={destination.type}
          onChange={(event) => setType(event.target.value as RideDestinationInput["type"])}
        >
          <option value="CUSTOM">Custom destination</option>
          <option value="EVENT">Published event</option>
          <option value="PLACE">Approved place</option>
        </select>
      </label>

      {destination.type === "EVENT" ? (
        <label className="ride-field">
          <span>Published event</span>
          <select
            value={destination.eventId}
            onChange={(event) => onChange({ ...destination, eventId: event.target.value })}
            required
          >
            <option value="">{loading ? "Loading events..." : "Choose a published event"}</option>
            {events.map((eventItem) => (
              <option key={eventItem.id} value={eventItem.id}>
                {eventLabel(eventItem)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {destination.type === "PLACE" ? (
        <label className="ride-field">
          <span>Approved place</span>
          <select
            value={destination.placeId}
            onChange={(event) => onChange({ ...destination, placeId: event.target.value })}
            required
          >
            <option value="">{loading ? "Loading places..." : "Choose an approved place"}</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {placeLabel(place)}
              </option>
            ))}
          </select>
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

function eventLabel(eventItem: PublicEvent): string {
  const when = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(eventItem.startsAt));
  const place = eventItem.place?.name ?? eventItem.venueName ?? eventItem.address;
  return [eventItem.title, when, place].filter(Boolean).join(" - ");
}

function placeLabel(place: PublicPlaceSummary): string {
  return [place.name, place.houma, place.city].filter(Boolean).join(" - ");
}
