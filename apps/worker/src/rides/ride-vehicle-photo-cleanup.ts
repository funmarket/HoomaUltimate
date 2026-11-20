import { rideVehiclePhotoCleanupPayloadSchema } from "@hooma/contracts/rides";
import type { PrismaClient } from "@hooma/database";
import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler } from "../outbox/outbox.runner.js";

export function createRideVehiclePhotoCleanupHandler(
  database: PrismaClient,
  storage: ObjectStorage,
): OutboxHandler {
  return async (event) => {
    const payload = rideVehiclePhotoCleanupPayloadSchema.parse(event.payload);
    const identity = rideVehiclePhotoIdentity(payload.objectKey);
    if (
      "rideOfferId" in payload &&
      (payload.rideOfferId !== identity.rideOfferId || payload.photoId !== identity.photoId)
    ) {
      throw new Error("Ride vehicle-photo cleanup key is outside the Ride ownership boundary");
    }
    const current = await database.rideOfferVehiclePhoto.findFirst({
      where: { objectKey: payload.objectKey },
      select: { id: true },
    });
    if (!current) await storage.remove(payload.objectKey);
  };
}

function rideVehiclePhotoIdentity(objectKey: string): {
  readonly rideOfferId: string;
  readonly photoId: string;
} {
  const match =
    /^ride-offer-vehicles\/([A-Za-z0-9][A-Za-z0-9_-]{0,127})\/([A-Za-z0-9][A-Za-z0-9_-]{0,127})$/.exec(
      objectKey,
    );
  if (!match) {
    throw new Error("Ride vehicle-photo cleanup key is outside the Ride ownership boundary");
  }
  return { rideOfferId: match[1]!, photoId: match[2]! };
}
