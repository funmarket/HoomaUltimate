import { RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC } from "@hooma/contracts/rides";
import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  RideVehiclePhotoRecord,
  RideVehiclePhotoRepository,
} from "../application/ride-vehicle-photo.repository.js";

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

  async prepareUpload(photoId: string, rideOfferId: string, objectKey: string): Promise<void> {
    await this.db.outboxEvent.upsert({
      where: { id: photoId },
      create: {
        id: photoId,
        topic: RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC,
        aggregateType: "RideOfferVehiclePhoto",
        aggregateId: rideOfferId,
        payload: { rideOfferId, photoId, objectKey },
        availableAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      update: { payload: { rideOfferId, photoId, objectKey } },
    });
  }

  async replacePreparedUploadForOwner(input: {
    readonly photoId: string;
    readonly rideOfferId: string;
    readonly driverUserId: string;
    readonly photo: {
      readonly objectKey: string;
      readonly contentType: string;
      readonly sizeBytes: number;
    };
  }): Promise<RideVehiclePhotoRecord | null> {
    return this.db.$transaction(async (tx) => {
      const offer = await lockRideOfferForVehiclePhotoMutation(tx, input.rideOfferId);
      if (!offer || offer.driverUserId !== input.driverUserId) return null;

      const intent = await tx.outboxEvent.deleteMany({
        where: {
          id: input.photoId,
          topic: RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC,
          aggregateId: input.rideOfferId,
          payload: {
            equals: {
              rideOfferId: input.rideOfferId,
              photoId: input.photoId,
              objectKey: input.photo.objectKey,
            },
          },
          status: "PENDING",
          attempts: 0,
          availableAt: { gt: new Date() },
        },
      });
      if (intent.count !== 1) throw new Error("Ride vehicle-photo upload intent is unavailable");

      const existing = await tx.rideOfferVehiclePhoto.findUnique({
        where: { rideOfferId: input.rideOfferId },
        select: { objectKey: true },
      });
      const current = await tx.rideOfferVehiclePhoto.upsert({
        where: { rideOfferId: input.rideOfferId },
        create: {
          id: input.photoId,
          rideOfferId: input.rideOfferId,
          objectKey: input.photo.objectKey,
          contentType: input.photo.contentType,
          sizeBytes: input.photo.sizeBytes,
        },
        update: {
          id: input.photoId,
          objectKey: input.photo.objectKey,
          contentType: input.photo.contentType,
          sizeBytes: input.photo.sizeBytes,
        },
        select: rideVehiclePhotoSelect,
      });

      if (existing?.objectKey && existing.objectKey !== current.objectKey) {
        await scheduleCleanup(tx, input.rideOfferId, existing.objectKey);
      }
      return serializeRideVehiclePhoto(current);
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
      await scheduleCleanup(tx, rideOfferId, existing.objectKey);
      return serializeRideVehiclePhoto(existing);
    });
  }
}

async function scheduleCleanup(
  tx: Prisma.TransactionClient,
  rideOfferId: string,
  objectKey: string,
): Promise<void> {
  const photoId = objectKey.split("/").at(-1);
  if (!photoId) throw new Error("Ride vehicle-photo object key is invalid");
  await tx.outboxEvent.create({
    data: {
      topic: RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC,
      aggregateType: "RideOfferVehiclePhoto",
      aggregateId: rideOfferId,
      payload: { rideOfferId, photoId, objectKey },
      availableAt: new Date(),
    },
  });
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
