import type { RideDestinationInput, RideDestinationSummary } from "@hooma/contracts/rides";

export type DestinationFormState = {
  readonly type: RideDestinationInput["type"];
  readonly eventId: string;
  readonly placeId: string;
  readonly customDestinationLabel: string;
};

export const emptyDestination: DestinationFormState = {
  type: "CUSTOM",
  eventId: "",
  placeId: "",
  customDestinationLabel: "",
};

export function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

export function dateTimeInputValue(minutesFromNow: number): string {
  const date = new Date(Date.now() + minutesFromNow * 60_000);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function dateTimeInputValueFromIso(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function toIsoDateTime(value: string): string {
  return new Date(value).toISOString();
}

export function destinationInput(state: DestinationFormState): RideDestinationInput {
  if (state.type === "EVENT") return { type: "EVENT", eventId: state.eventId.trim() };
  if (state.type === "PLACE") return { type: "PLACE", placeId: state.placeId.trim() };
  return { type: "CUSTOM", customDestinationLabel: state.customDestinationLabel.trim() };
}

export function destinationFormState(destination: RideDestinationSummary): DestinationFormState {
  if (destination.type === "EVENT") {
    return {
      type: "EVENT",
      eventId: destination.eventId,
      placeId: "",
      customDestinationLabel: "",
    };
  }
  if (destination.type === "PLACE") {
    return {
      type: "PLACE",
      eventId: "",
      placeId: destination.placeId,
      customDestinationLabel: "",
    };
  }
  return {
    type: "CUSTOM",
    eventId: "",
    placeId: "",
    customDestinationLabel: destination.label,
  };
}

export function destinationLabel(destination: RideDestinationSummary): string {
  switch (destination.type) {
    case "EVENT":
      return destination.title;
    case "PLACE":
      return [destination.name, destination.houma, destination.city].filter(Boolean).join(" - ");
    case "CUSTOM":
      return destination.label;
  }
}

export function formatRideTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function passengerLabel(participation: {
  readonly passengerUserId: string;
  readonly passenger: {
    readonly displayName: string;
    readonly username: string;
    readonly photoUrl: string | null;
  } | null;
}): string {
  const presentation = participation.passenger;
  if (presentation) return `${presentation.displayName} (@${presentation.username})`;
  return `Passenger ${participation.passengerUserId.slice(0, 8)}`;
}
