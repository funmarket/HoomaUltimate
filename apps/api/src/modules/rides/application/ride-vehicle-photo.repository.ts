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
  prepareUpload(photoId: string, rideOfferId: string, objectKey: string): Promise<void>;
  replacePreparedUploadForOwner(input: {
    readonly photoId: string;
    readonly rideOfferId: string;
    readonly driverUserId: string;
    readonly photo: {
      readonly objectKey: string;
      readonly contentType: string;
      readonly sizeBytes: number;
    };
  }): Promise<RideVehiclePhotoRecord | null>;
  deleteForOwner(rideOfferId: string, driverUserId: string): Promise<RideVehiclePhotoRecord | null>;
}
