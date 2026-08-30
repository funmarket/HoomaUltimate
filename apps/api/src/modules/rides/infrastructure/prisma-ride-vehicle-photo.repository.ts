import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  RideVehiclePhotoRecord,
  RideVehiclePhotoRepository,
} from "../application/ride-vehicle-photo.repository.js";

export const RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC = "ride.vehicle-photo.delete-object";

const rideVehiclePhotoSelect = Prisma.validator<Prisma.RideOfferVehiclePhotoSelect>()({
  id: true,
  rideOfferId: true,
  objectKey: true,
  contentType: true,
  sizeBytes: true,
  createdAt: true,
  updatedAt: true,
});

type RideVehiclePhotoRow = Prisma.RideOfferVehiclePhotoGetPayload<{
  select: typeof rideVehiclePhotoSelect;
}>;

export class PrismaRideVehiclePhotoRepository implements RideVehiclePhotoRepository {
  constructor(private readonly db: PrismaClient) {}

  async getForOffer(rideOfferId: string): Promise<RideVehiclePhotoRecord | null> {
    const row = await this.db.rideOfferVehiclePhoto.findUnique({
      where: { rideOfferId },
      select: rideVehiclePhotoSelect,
    });

    return row ? serializeRideVehiclePhoto(row) : null;
  }

  async replaceForOwner(input: {
    readonly rideOfferId: string;
    readonly driverUserId: string;
    readonly photo: {
      readonly id: string;
      readonly objectKey: string;
      readonly contentType: string;
      readonly sizeBytes: number;
    };
  }): Promise<{
    readonly current: RideVehiclePhotoRecord;
    readonly previousObjectKey: string | null;
  } | null> {
    return this.db.$transaction(async (tx) => {
      const offer = await lockRideOfferForVehiclePhotoMutation(tx, input.rideOfferId);
      if (!offer || offer.driverUserId !== input.driverUserId) return null;

      const existing = await tx.rideOfferVehiclePhoto.findUnique({
        where: { rideOfferId: input.rideOfferId },
        select: { objectKey: true },
      });
      const current = await tx.rideOfferVehiclePhoto.upsert({
        where: { rideOfferId: input.rideOfferId },
        create: {
          id: input.photo.id,
          rideOfferId: input.rideOfferId,
          objectKey: input.photo.objectKey,
          contentType: input.photo.contentType,
          sizeBytes: input.photo.sizeBytes,
        },
        update: {
          id: input.photo.id,
          objectKey: input.photo.objectKey,
          contentType: input.photo.contentType,
          sizeBytes: input.photo.sizeBytes,
        },
        select: rideVehiclePhotoSelect,
      });

      return {
        current: serializeRideVehiclePhoto(current),
        previousObjectKey: existing?.objectKey ?? null,
      };
    });
  }

  async deleteForOwner(
    rideOfferId: string,
    driverUserId: string,
  ): Promise<RideVehiclePhotoRecord | null> {
    return this.db.$transaction(async (tx) => {
      const offer = await lockRideOfferForVehiclePhotoMutation(tx, rideOfferId);
      if (!offer || offer.driverUserId !== driverUserId) return null;

      const existing = await tx.rideOfferVehiclePhoto.findUnique({
        where: { rideOfferId },
        select: rideVehiclePhotoSelect,
      });
      if (!existing) return null;

      await tx.rideOfferVehiclePhoto.delete({ where: { rideOfferId } });
      return serializeRideVehiclePhoto(existing);
    });
  }

  async scheduleObjectDeletion(input: {
    readonly objectKey: string;
    readonly reason: "REPLACED" | "DELETED" | "ORPHANED_AFTER_METADATA_FAILURE";
  }): Promise<void> {
    await this.db.outboxEvent.create({
      data: {
        topic: RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC,
        aggregateType: "RideOfferVehiclePhoto",
        aggregateId: input.objectKey,
        payload: {
          objectKey: input.objectKey,
          reason: input.reason,
        },
      },
    });
  }
}

async function lockRideOfferForVehiclePhotoMutation(
  tx: Prisma.TransactionClient,
  rideOfferId: string,
): Promise<{ readonly id: string; readonly driverUserId: string } | null> {
  const rows = await tx.$queryRaw<Array<{ id: string; driverUserId: string }>>(
    Prisma.sql`SELECT id, "driverUserId" AS "driverUserId" FROM "RideOffer" WHERE id = ${rideOfferId} FOR UPDATE`,
  );

  return rows[0] ?? null;
}

function serializeRideVehiclePhoto(row: RideVehiclePhotoRow): RideVehiclePhotoRecord {
  return {
    id: row.id,
    rideOfferId: row.rideOfferId,
    objectKey: row.objectKey,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
