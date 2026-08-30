export interface RideDestinationEventReference {
  readonly id: string;
  readonly title: string;
  readonly startsAt: Date;
  readonly status: "PUBLISHED" | "CANCELLED" | "COMPLETED";
}

export interface RideDestinationPlaceReference {
  readonly id: string;
  readonly name: string;
  readonly city: string | null;
  readonly houma: string | null;
  readonly status: "APPROVED";
}

export interface RideEventReferenceReader {
  resolveRideDestinationEvent(eventId: string): Promise<RideDestinationEventReference | null>;
}

export interface RidePlaceReferenceReader {
  resolveRideDestinationPlace(placeId: string): Promise<RideDestinationPlaceReference | null>;
}
