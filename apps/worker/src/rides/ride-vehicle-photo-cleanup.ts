import type { ObjectStorage } from "@hooma/storage";
import type { OutboxHandler, OutboxHandlerEvent } from "../outbox/outbox.runner.js";

export const RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC = "ride.vehicle-photo.delete-object";

export function createRideVehiclePhotoCleanupHandler(storage: ObjectStorage): OutboxHandler {
  return async (event: OutboxHandlerEvent) => {
    const objectKey = rideVehiclePhotoDeletionObjectKey(event.payload);
    await storage.remove(objectKey);
  };
}

function rideVehiclePhotoDeletionObjectKey(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Ride vehicle-photo cleanup payload must be an object");
  }
  const objectKey = (payload as { readonly objectKey?: unknown }).objectKey;
  if (typeof objectKey !== "string" || !objectKey.startsWith("ride-offer-vehicles/")) {
    throw new Error("Ride vehicle-photo cleanup payload objectKey is invalid");
  }
  return objectKey;
}
