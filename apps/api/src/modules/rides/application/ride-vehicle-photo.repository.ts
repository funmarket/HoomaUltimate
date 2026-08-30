export interface RideVehiclePhotoMetadata {
  readonly id: string;
  readonly rideOfferId: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RideVehiclePhotoRecord extends RideVehiclePhotoMetadata {
  readonly objectKey: string;
}

export interface RideVehiclePhotoRepository {
  getForOffer(rideOfferId: string): Promise<RideVehiclePhotoRecord | null>;
  replaceForOwner(input: {
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
  } | null>;
  deleteForOwner(rideOfferId: string, driverUserId: string): Promise<RideVehiclePhotoRecord | null>;
  scheduleObjectDeletion(input: {
    readonly objectKey: string;
    readonly reason: "REPLACED" | "DELETED" | "ORPHANED_AFTER_METADATA_FAILURE";
  }): Promise<void>;
}
