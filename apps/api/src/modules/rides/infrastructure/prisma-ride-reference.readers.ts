import { type PrismaClient } from "@hooma/database";
import type {
  RideDestinationEventReference,
  RideDestinationPlaceReference,
  RideEventReferenceReader,
  RidePlaceReferenceReader,
} from "../application/ride-reference.readers.js";

export class PrismaRideReferenceReader
  implements RideEventReferenceReader, RidePlaceReferenceReader
{
  constructor(private readonly db: PrismaClient) {}

  async resolveRideDestinationEvent(
    eventId: string,
  ): Promise<RideDestinationEventReference | null> {
    const event = await this.db.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, startsAt: true, status: true },
    });

    return event;
  }

  async resolveRideDestinationPlace(
    placeId: string,
  ): Promise<RideDestinationPlaceReference | null> {
    const place = await this.db.place.findFirst({
      where: { id: placeId, moderationStatus: "APPROVED", archivedAt: null },
      select: { id: true, name: true, city: true, houma: true },
    });
    if (!place) return null;

    return { ...place, status: "APPROVED" };
  }
}
