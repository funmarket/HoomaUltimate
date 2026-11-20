import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@hooma/database";
import type { ObjectStorage, StoredObject, StoredObjectDescriptor } from "@hooma/storage";
import { createRideVehiclePhotoCleanupHandler } from "../apps/worker/src/rides/ride-vehicle-photo-cleanup.js";

const payload = {
  rideOfferId: "offer-1",
  photoId: "photo-1",
  objectKey: "ride-offer-vehicles/offer-1/photo-1",
};

test("Ride vehicle-photo cleanup preserves a currently referenced object", async () => {
  const storage = new CleanupStorage();
  const database = cleanupDatabase({ id: "photo-1" });
  const handler = createRideVehiclePhotoCleanupHandler(database, storage);

  await handler(outboxEvent(payload));

  assert.deepEqual(storage.removedKeys, []);
});

test("Ride vehicle-photo cleanup rejects malformed and cross-offer object keys", async () => {
  const storage = new CleanupStorage();
  const database = cleanupDatabase(null);
  const handler = createRideVehiclePhotoCleanupHandler(database, storage);

  await assert.rejects(
    handler(
      outboxEvent({
        ...payload,
        objectKey: "ride-offer-vehicles/other-offer/photo-1",
      }),
    ),
    /ownership boundary/,
  );
  await assert.rejects(
    handler(
      outboxEvent({
        ...payload,
        objectKey: "ride-offer-vehicles/offer-1/photo-1/extra",
      }),
    ),
    /ownership boundary/,
  );
  assert.deepEqual(storage.removedKeys, []);
});

test("Ride vehicle-photo cleanup removes an exact unreferenced key", async () => {
  const storage = new CleanupStorage();
  const handler = createRideVehiclePhotoCleanupHandler(cleanupDatabase(null), storage);

  await handler(outboxEvent(payload));
  await handler(
    outboxEvent({
      objectKey: payload.objectKey,
      reason: "REPLACED",
    }),
  );

  assert.deepEqual(storage.removedKeys, [payload.objectKey, payload.objectKey]);
});

function outboxEvent(eventPayload: unknown) {
  return {
    id: "event-1",
    topic: "ride.vehicle-photo.delete-object",
    aggregateType: "RideOfferVehiclePhoto",
    aggregateId: "offer-1",
    payload: eventPayload,
    attempts: 0,
  };
}

function cleanupDatabase(reference: { readonly id: string } | null): PrismaClient {
  return {
    rideOfferVehiclePhoto: {
      findFirst: async () => reference,
    },
  } as unknown as PrismaClient;
}

class CleanupStorage implements ObjectStorage {
  readonly removedKeys: string[] = [];

  async put(): Promise<StoredObjectDescriptor> {
    throw new Error("not used");
  }

  async get(): Promise<StoredObject> {
    throw new Error("not used");
  }

  async remove(key: string): Promise<void> {
    this.removedKeys.push(key);
  }
}
