import assert from "node:assert/strict";
import test from "node:test";
import type {
  PublicRideOffer,
  PublicRideRequest,
  RideDestinationInput,
  RideMeetingPoint,
  RideMeetingPointInput,
  RideMineOffer,
  RideOfferCreateInput,
  RideOfferStatus,
  RideParticipation,
  RideParticipationStatus,
  RideRequestCreateInput,
  RideRequestForOwner,
  RideRequestStatus,
} from "@hooma/contracts/rides";
import type { ObjectStorage, StoredObject, StoredObjectDescriptor } from "@hooma/storage";
import type {
  RideMeetingPointRepository,
  RideOfferListInput,
  RideOfferForOwnerRecord,
  RideOfferRepository,
  RideParticipationRepository,
} from "../apps/api/src/modules/rides/application/ride-offer.repository.js";
import type {
  RideCommunityMembershipReader,
  RideCommunitySummary,
} from "../apps/api/src/modules/rides/application/ride-community-membership.reader.js";
import type {
  RideDestinationEventReference,
  RideDestinationPlaceReference,
  RideEventReferenceReader,
  RidePlaceReferenceReader,
} from "../apps/api/src/modules/rides/application/ride-reference.readers.js";
import type {
  RideRequestListInput,
  RideRequestRepository,
} from "../apps/api/src/modules/rides/application/ride-request.repository.js";
import type {
  RideVehiclePhotoRecord,
  RideVehiclePhotoRepository,
} from "../apps/api/src/modules/rides/application/ride-vehicle-photo.repository.js";
import type {
  UserPresentationReader,
  UserPresentationSummary,
} from "../apps/api/src/modules/identity/application/user-presentation.reader.js";
import { RideService } from "../apps/api/src/modules/rides/application/ride.service.js";
import { RideError, type RideErrorCode } from "../apps/api/src/modules/rides/domain/ride-error.js";
import { RidePolicyError } from "../apps/api/src/modules/rides/domain/ride-policy.js";

const now = new Date("2026-08-30T12:00:00.000Z").toISOString();

test("RideService derives driver identity and validates Event destination before creating an offer", async () => {
  const fixture = createServiceFixture();
  fixture.events.event = {
    id: "event-1",
    title: "Derby watch",
    startsAt: new Date(now),
    status: "PUBLISHED",
  };

  const created = await fixture.service.createOffer("driver-1", {
    ...offerCreateInput(),
    destination: { type: "EVENT", eventId: "event-1" },
  });

  assert.equal(created.driverUserId, "driver-1");
  assert.equal(fixture.offers.createdDriverUserId, "driver-1");
  assert.deepEqual(fixture.events.resolvedEventIds, ["event-1"]);
});

test("RideService rejects unavailable Event and Place destinations before repository writes", async () => {
  const fixture = createServiceFixture();
  await assertRideError(
    () =>
      fixture.service.createOffer("driver-1", {
        ...offerCreateInput(),
        destination: { type: "EVENT", eventId: "missing-event" },
      }),
    404,
    "RIDE_DESTINATION_EVENT_NOT_FOUND",
  );
  assert.equal(fixture.offers.createCalls, 0);

  fixture.events.event = {
    id: "event-2",
    title: "Cancelled watch",
    startsAt: new Date(now),
    status: "CANCELLED",
  };
  await assertRideError(
    () =>
      fixture.service.createOffer("driver-1", {
        ...offerCreateInput(),
        destination: { type: "EVENT", eventId: "event-2" },
      }),
    404,
    "RIDE_DESTINATION_EVENT_NOT_FOUND",
  );
  assert.equal(fixture.offers.createCalls, 0);

  await assertRideError(
    () =>
      fixture.service.createRequest("requester-1", {
        ...requestCreateInput(),
        destination: { type: "PLACE", placeId: "missing-place" },
      }),
    404,
    "RIDE_DESTINATION_PLACE_NOT_FOUND",
  );
  assert.equal(fixture.requests.createCalls, 0);
});

test("RideService validates Community Ride request audiences before repository writes", async () => {
  const fixture = createServiceFixture();

  await assertRideError(
    () =>
      fixture.service.createRequest("requester-1", {
        ...requestCreateInput(),
        audience: { scope: "COMMUNITY", selection: "ONE", communityId: "community-a" },
      }),
    403,
    "RIDE_REQUEST_COMMUNITY_TARGET_FORBIDDEN",
  );
  assert.equal(fixture.requests.createCalls, 0);

  fixture.communityMemberships.activeCommunityIds.add("community-a");
  await fixture.service.createRequest("requester-1", {
    ...requestCreateInput(),
    audience: { scope: "COMMUNITY", selection: "ONE", communityId: "community-a" },
  });
  assert.equal(fixture.requests.createCalls, 1);
});

test("RideService rejects ALL_CURRENT when the requester has no active HOOMAs", async () => {
  const fixture = createServiceFixture();

  await assertRideError(
    () =>
      fixture.service.createRequest("requester-1", {
        ...requestCreateInput(),
        audience: { scope: "COMMUNITY", selection: "ALL_CURRENT" },
      }),
    409,
    "RIDE_REQUEST_COMMUNITY_AUDIENCE_EMPTY",
  );
  assert.equal(fixture.requests.createCalls, 0);

  fixture.communityMemberships.communities = [
    { id: "community-a", name: "La Marsa HOOMA", slug: "la-marsa" },
  ];
  await fixture.service.createRequest("requester-1", {
    ...requestCreateInput(),
    audience: { scope: "COMMUNITY", selection: "ALL_CURRENT" },
  });
  assert.equal(fixture.requests.createCalls, 1);
});

test("RideService authorizes Community Ride feed viewers through Community membership", async () => {
  const fixture = createServiceFixture();

  await assertRideError(
    () => fixture.service.listCommunityRequests("viewer-1", "community-a", { limit: 10 }),
    403,
    "RIDE_REQUEST_COMMUNITY_FEED_FORBIDDEN",
  );

  fixture.communityMemberships.activeCommunityIds.add("community-a");
  const page = await fixture.service.listCommunityRequests("viewer-1", "community-a", {
    limit: 10,
  });
  assert.equal(page.items[0]?.id, "request-1");
});

test("RideService derives requester identity and exposes request owner/public boundaries", async () => {
  const fixture = createServiceFixture();
  fixture.places.place = {
    id: "place-1",
    name: "Cafe Tribune",
    city: "Tunis",
    houma: "Lac",
    status: "APPROVED",
  };

  const created = await fixture.service.createRequest("requester-1", {
    ...requestCreateInput(),
    destination: { type: "PLACE", placeId: "place-1" },
  });

  assert.equal(created.requesterUserId, "requester-1");
  assert.equal(fixture.requests.createdRequesterUserId, "requester-1");
  assert.deepEqual(fixture.places.resolvedPlaceIds, ["place-1"]);

  fixture.requests.ownerRequest = null;
  await assertRideError(
    () => fixture.service.updateRequest("other-user", "request-1", { pickupAreaLabel: "Lac" }),
    403,
    "RIDE_REQUEST_MANAGE_FORBIDDEN",
  );
  assert.equal(fixture.requests.updateCalls, 0);
});

test("RideService enforces offer owner authorization before mutation and status changes", async () => {
  const fixture = createServiceFixture();
  fixture.offers.ownerOffer = null;

  await assertRideError(
    () => fixture.service.updateOffer("intruder", "offer-1", { originAreaLabel: "Marsa" }),
    403,
    "RIDE_OFFER_MANAGE_FORBIDDEN",
  );
  assert.equal(fixture.offers.updateCalls, 0);

  await assertRideError(
    () => fixture.service.cancelOffer("intruder", "offer-1"),
    403,
    "RIDE_OFFER_MANAGE_FORBIDDEN",
  );
  assert.equal(fixture.offers.updateStatusCalls, 0);
});

test("RideService maps Ride policy failures to stable RideError codes", async () => {
  const fixture = createServiceFixture();
  fixture.participations.requestError = new RidePolicyError(
    "RIDE_DRIVER_CANNOT_PARTICIPATE",
    "Ride driver cannot join their own offer as a passenger",
  );

  await assertRideError(
    () => fixture.service.requestParticipation("driver-1", "offer-1", { seatCount: 1 }),
    409,
    "RIDE_DRIVER_CANNOT_PARTICIPATE",
  );
});

test("RideService sends driver participation responses through owner authorization", async () => {
  const fixture = createServiceFixture();

  const accepted = await fixture.service.acceptParticipation("driver-1", "offer-1", "part-1");
  assert.equal(accepted.status, "ACCEPTED");
  assert.deepEqual(fixture.participations.lastStatusInput, {
    rideOfferId: "offer-1",
    participationId: "part-1",
    actorUserId: "driver-1",
    status: "ACCEPTED",
  });

  fixture.participations.updateResult = null;
  await assertRideError(
    () => fixture.service.acceptParticipation("driver-1", "offer-1", "part-1"),
    409,
    "RIDE_PARTICIPATION_STATUS_NOT_CHANGED",
  );
});

test("RideService restores a passenger participation from actor identity without profile data", async () => {
  const fixture = createServiceFixture();

  const restored = await fixture.service.getMyParticipation("passenger-1", "offer-1");

  assert.equal(restored.id, "part-1");
  assert.equal(restored.status, "ACCEPTED");
  assert.equal("passenger" in (restored as Record<string, unknown>), false);
  assert.equal("passengerPresentation" in (restored as Record<string, unknown>), false);
  assert.deepEqual(fixture.participations.lastPassengerLookup, {
    rideOfferId: "offer-1",
    passengerUserId: "passenger-1",
  });

  fixture.participations.passengerResult = null;
  await assertRideError(
    () => fixture.service.getMyParticipation("outsider", "offer-1"),
    404,
    "RIDE_PARTICIPATION_NOT_FOUND",
  );
});

test("RideService enriches driver owner view through the injected identity reader", async () => {
  const fixture = createServiceFixture();
  fixture.offers.ownerOffer = {
    ...ownerOffer(),
    participations: [participation("REQUESTED")],
  };

  const ownerView = await fixture.service.getMyOffer("driver-1", "offer-1");

  assert.deepEqual(ownerView.participations[0]?.passenger, {
    displayName: "Passenger One",
    username: "passenger_1",
    photoUrl: null,
  });
  assert.deepEqual(fixture.userPresentations.lastUserIds, ["passenger-1"]);
});

test("RideService allows driver/passenger cancellation only through repository authorization", async () => {
  const fixture = createServiceFixture();

  const cancelled = await fixture.service.cancelParticipation("passenger-1", "offer-1", "part-1");
  assert.equal(cancelled.status, "CANCELLED");
  assert.deepEqual(fixture.participations.lastStatusInput, {
    rideOfferId: "offer-1",
    participationId: "part-1",
    actorUserId: "passenger-1",
    status: "CANCELLED",
  });

  fixture.participations.updateResult = null;
  await assertRideError(
    () => fixture.service.cancelParticipation("outsider", "offer-1", "part-1"),
    403,
    "RIDE_PARTICIPATION_CANCEL_FORBIDDEN",
  );
});

test("RideService keeps meeting points private to authorized Ride parties", async () => {
  const fixture = createServiceFixture();

  const saved = await fixture.service.upsertMeetingPoint("driver-1", "offer-1", "part-1", {
    label: "Gate 4",
    latitude: 36.8,
    longitude: 10.18,
  });
  assert.equal(saved.label, "Gate 4");
  assert.deepEqual(fixture.meetingPoints.lastUpsertInput?.meetingPoint, {
    label: "Gate 4",
    latitude: 36.8,
    longitude: 10.18,
  });

  const visible = await fixture.service.getMeetingPoint("passenger-1", "part-1");
  assert.equal(visible.label, "Gate 4");

  fixture.meetingPoints.authorizedResult = null;
  await assertRideError(
    () => fixture.service.getMeetingPoint("outsider", "part-1"),
    403,
    "RIDE_MEETING_POINT_FORBIDDEN",
  );
});

test("RideService normalizes public list limits without hiding repository ownership", async () => {
  const fixture = createServiceFixture();

  await fixture.service.listPublicOffers({ limit: 999 });
  assert.equal(fixture.offers.lastListInput?.limit, 100);

  await fixture.service.listPublicRequests({ limit: 0 });
  assert.equal(fixture.requests.lastListInput?.limit, 1);
});

test("RideService cleans up uploaded vehicle photos when metadata persistence fails", async () => {
  const fixture = createServiceFixture();
  fixture.vehiclePhotos.replaceError = new Error("database unavailable after upload");

  await assertRideError(
    () =>
      fixture.service.replaceOfferVehiclePhoto("driver-1", "offer-1", {
        contentType: "image/png",
        body: Uint8Array.of(1, 2, 3),
      }),
    503,
    "RIDE_VEHICLE_PHOTO_UPLOAD_FAILED",
  );

  assert.equal(fixture.storage.putKeys.length, 1);
  assert.match(fixture.storage.putKeys[0] ?? "", /^ride-offer-vehicles\/offer-1\//);
  assert.deepEqual(fixture.storage.removedKeys, fixture.storage.putKeys);
  assert.deepEqual(fixture.vehiclePhotos.scheduledDeletions, []);

  const scheduledFixture = createServiceFixture();
  scheduledFixture.vehiclePhotos.replaceError = new Error("database unavailable after upload");
  scheduledFixture.storage.failRemove = true;

  await assertRideError(
    () =>
      scheduledFixture.service.replaceOfferVehiclePhoto("driver-1", "offer-1", {
        contentType: "image/webp",
        body: Uint8Array.of(4, 5, 6),
      }),
    503,
    "RIDE_VEHICLE_PHOTO_UPLOAD_FAILED",
  );

  assert.deepEqual(scheduledFixture.storage.removedKeys, []);
  assert.equal(scheduledFixture.vehiclePhotos.scheduledDeletions.length, 1);
  assert.equal(
    scheduledFixture.vehiclePhotos.scheduledDeletions[0]?.objectKey,
    scheduledFixture.storage.putKeys[0],
  );
  assert.equal(
    scheduledFixture.vehiclePhotos.scheduledDeletions[0]?.reason,
    "ORPHANED_AFTER_METADATA_FAILURE",
  );
});

function createServiceFixture() {
  const offers = new FakeRideOfferRepository();
  const requests = new FakeRideRequestRepository();
  const participations = new FakeRideParticipationRepository();
  const meetingPoints = new FakeRideMeetingPointRepository();
  const events = new FakeRideEventReferenceReader();
  const places = new FakeRidePlaceReferenceReader();
  const communityMemberships = new FakeRideCommunityMembershipReader();
  const userPresentations = new FakeUserPresentationReader();
  const vehiclePhotos = new FakeRideVehiclePhotoRepository();
  const storage = new FakeObjectStorage();
  const service = new RideService(
    offers,
    requests,
    participations,
    meetingPoints,
    events,
    places,
    communityMemberships,
    userPresentations,
    vehiclePhotos,
    storage,
  );
  return {
    service,
    offers,
    requests,
    participations,
    meetingPoints,
    events,
    places,
    communityMemberships,
    userPresentations,
    vehiclePhotos,
    storage,
  };
}

class FakeRideOfferRepository implements RideOfferRepository {
  public ownerOffer: RideOfferForOwnerRecord | null = ownerOffer();
  public publicOffer: PublicRideOffer | null = publicOffer();
  public createdDriverUserId: string | null = null;
  public createCalls = 0;
  public updateCalls = 0;
  public updateStatusCalls = 0;
  public lastListInput: RideOfferListInput | null = null;

  async listPublic(input: RideOfferListInput) {
    this.lastListInput = input;
    return { items: this.publicOffer ? [this.publicOffer] : [], nextCursor: null };
  }

  async listForDriver() {
    const offer: RideMineOffer | null = this.ownerOffer
      ? { ...this.ownerOffer, participationCount: this.ownerOffer.participations.length }
      : null;
    return { items: offer ? [offer] : [], nextCursor: null };
  }

  async getPublic() {
    return this.publicOffer;
  }

  async getForOwner() {
    return this.ownerOffer;
  }

  async create(driverUserId: string) {
    this.createCalls += 1;
    this.createdDriverUserId = driverUserId;
    return { ...ownerOffer(), driverUserId };
  }

  async update() {
    this.updateCalls += 1;
    return this.ownerOffer;
  }

  async updateStatus(_rideOfferId: string, _driverUserId: string, status: RideOfferStatus) {
    this.updateStatusCalls += 1;
    return this.ownerOffer ? { ...this.ownerOffer, status } : null;
  }
}

class FakeRideRequestRepository implements RideRequestRepository {
  public ownerRequest: RideRequestForOwner | null = ownerRequest();
  public publicRequest: PublicRideRequest | null = publicRequest();
  public createdRequesterUserId: string | null = null;
  public createCalls = 0;
  public updateCalls = 0;
  public lastListInput: RideRequestListInput | null = null;

  async listPublic(input: RideRequestListInput) {
    this.lastListInput = input;
    return { items: this.publicRequest ? [this.publicRequest] : [], nextCursor: null };
  }

  async listForRequester() {
    return { items: this.ownerRequest ? [this.ownerRequest] : [], nextCursor: null };
  }

  async listForCommunity() {
    return {
      items: this.publicRequest
        ? [{ ...this.publicRequest, href: `/rides/requests/${this.publicRequest.id}/manage` }]
        : [],
      nextCursor: null,
    };
  }

  async getPublic() {
    return this.publicRequest;
  }

  async getForRequester() {
    return this.ownerRequest;
  }

  async create(requesterUserId: string) {
    this.createCalls += 1;
    this.createdRequesterUserId = requesterUserId;
    return { ...ownerRequest(), requesterUserId };
  }

  async update() {
    this.updateCalls += 1;
    return this.ownerRequest;
  }

  async updateStatus(_rideRequestId: string, _requesterUserId: string, status: RideRequestStatus) {
    return this.ownerRequest ? { ...this.ownerRequest, status } : null;
  }
}

class FakeRideParticipationRepository implements RideParticipationRepository {
  public requestResult: RideParticipation | null = participation("REQUESTED");
  public updateResult: RideParticipation | null = participation("ACCEPTED");
  public passengerResult: RideParticipation | null = participation("ACCEPTED");
  public requestError: Error | null = null;
  public lastPassengerLookup: {
    readonly rideOfferId: string;
    readonly passengerUserId: string;
  } | null = null;
  public lastStatusInput: {
    readonly rideOfferId: string;
    readonly participationId: string;
    readonly actorUserId: string;
    readonly status: RideParticipationStatus;
  } | null = null;

  async listForPassenger() {
    return { items: [], nextCursor: null };
  }

  async getForPassenger(rideOfferId: string, passengerUserId: string) {
    this.lastPassengerLookup = { rideOfferId, passengerUserId };
    return this.passengerResult;
  }

  async requestParticipation() {
    if (this.requestError) throw this.requestError;
    return this.requestResult;
  }

  async updateParticipationStatus(input: {
    readonly rideOfferId: string;
    readonly participationId: string;
    readonly actorUserId: string;
    readonly status: RideParticipationStatus;
  }) {
    this.lastStatusInput = input;
    return this.updateResult ? { ...this.updateResult, status: input.status } : null;
  }
}

class FakeRideMeetingPointRepository implements RideMeetingPointRepository {
  public upsertResult: RideMeetingPoint | null = meetingPoint();
  public authorizedResult: RideMeetingPoint | null = meetingPoint();
  public lastUpsertInput: {
    readonly rideOfferId: string;
    readonly participationId: string;
    readonly driverUserId: string;
    readonly meetingPoint: RideMeetingPointInput;
  } | null = null;

  async upsertForParticipation(input: {
    readonly rideOfferId: string;
    readonly participationId: string;
    readonly driverUserId: string;
    readonly meetingPoint: RideMeetingPointInput;
  }) {
    this.lastUpsertInput = input;
    return this.upsertResult ? { ...this.upsertResult, ...input.meetingPoint } : null;
  }

  async getForAuthorizedViewer() {
    return this.authorizedResult;
  }
}

class FakeRideCommunityMembershipReader implements RideCommunityMembershipReader {
  public communities: RideCommunitySummary[] = [];
  public activeCommunityIds = new Set<string>();

  async listActiveMembershipCommunities() {
    return this.communities;
  }

  async isActiveMemberOfCommunity(_userId: string, communityId: string) {
    return this.activeCommunityIds.has(communityId);
  }
}

class FakeUserPresentationReader implements UserPresentationReader {
  public presentations = new Map<string, UserPresentationSummary>([
    [
      "passenger-1",
      {
        userId: "passenger-1",
        displayName: "Passenger One",
        username: "passenger_1",
        photoUrl: null,
      },
    ],
  ]);
  public lastUserIds: readonly string[] = [];

  async findByUserIds(userIds: readonly string[]) {
    this.lastUserIds = userIds;
    return userIds.flatMap((userId) => {
      const presentation = this.presentations.get(userId);
      return presentation ? [presentation] : [];
    });
  }
}

class FakeRideVehiclePhotoRepository implements RideVehiclePhotoRepository {
  public replaceError: Error | null = null;
  public scheduledDeletions: Array<{
    readonly objectKey: string;
    readonly reason: "REPLACED" | "DELETED" | "ORPHANED_AFTER_METADATA_FAILURE";
  }> = [];

  async getForOffer(): Promise<RideVehiclePhotoRecord | null> {
    return null;
  }

  async replaceForOwner(input: {
    readonly rideOfferId: string;
    readonly photo: {
      readonly id: string;
      readonly objectKey: string;
      readonly contentType: string;
      readonly sizeBytes: number;
    };
  }) {
    if (this.replaceError) throw this.replaceError;
    return {
      current: {
        id: input.photo.id,
        rideOfferId: input.rideOfferId,
        objectKey: input.photo.objectKey,
        contentType: input.photo.contentType,
        sizeBytes: input.photo.sizeBytes,
        createdAt: now,
        updatedAt: now,
      },
      previousObjectKey: null,
    };
  }

  async deleteForOwner(): Promise<RideVehiclePhotoRecord | null> {
    return null;
  }

  async scheduleObjectDeletion(input: {
    readonly objectKey: string;
    readonly reason: "REPLACED" | "DELETED" | "ORPHANED_AFTER_METADATA_FAILURE";
  }): Promise<void> {
    this.scheduledDeletions.push(input);
  }
}

class FakeObjectStorage implements ObjectStorage {
  public putKeys: string[] = [];
  public removedKeys: string[] = [];
  public failRemove = false;

  async put(key: string, body: Uint8Array, contentType: string): Promise<StoredObjectDescriptor> {
    this.putKeys.push(key);
    return { key, contentType, sizeBytes: body.byteLength };
  }

  async get(key: string): Promise<StoredObject> {
    return { key, contentType: "image/png", sizeBytes: 1, body: Uint8Array.of(1) };
  }

  async remove(key: string): Promise<void> {
    if (this.failRemove) throw new Error("expected cleanup failure");
    this.removedKeys.push(key);
  }
}

class FakeRideEventReferenceReader implements RideEventReferenceReader {
  public event: RideDestinationEventReference | null = null;
  public resolvedEventIds: string[] = [];

  async resolveRideDestinationEvent(eventId: string) {
    this.resolvedEventIds.push(eventId);
    return this.event;
  }
}

class FakeRidePlaceReferenceReader implements RidePlaceReferenceReader {
  public place: RideDestinationPlaceReference | null = null;
  public resolvedPlaceIds: string[] = [];

  async resolveRideDestinationPlace(placeId: string) {
    this.resolvedPlaceIds.push(placeId);
    return this.place;
  }
}

async function assertRideError(
  operation: () => Promise<unknown>,
  statusCode: number,
  code: string,
): Promise<void> {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof RideError);
    assert.equal(rideStatus(error.code), statusCode);
    assert.equal(error.code, code);
    return true;
  });
}

function rideStatus(code: RideErrorCode): number {
  switch (code) {
    case "RIDE_DESTINATION_REQUIRED":
    case "RIDE_DESTINATION_STRATEGY_CONFLICT":
    case "RIDE_VEHICLE_PHOTO_REQUIRED":
      return 400;
    case "RIDE_VEHICLE_PHOTO_TOO_LARGE":
      return 413;
    case "RIDE_VEHICLE_PHOTO_TYPE_INVALID":
      return 415;
    case "RIDE_OFFER_NOT_FOUND":
    case "RIDE_REQUEST_NOT_FOUND":
    case "RIDE_PARTICIPATION_NOT_FOUND":
    case "RIDE_DESTINATION_EVENT_NOT_FOUND":
    case "RIDE_DESTINATION_PLACE_NOT_FOUND":
    case "RIDE_VEHICLE_PHOTO_NOT_FOUND":
      return 404;
    case "RIDE_PARTICIPATION_CANCEL_FORBIDDEN":
    case "RIDE_MEETING_POINT_FORBIDDEN":
    case "RIDE_OFFER_MANAGE_FORBIDDEN":
    case "RIDE_REQUEST_MANAGE_FORBIDDEN":
    case "RIDE_REQUEST_COMMUNITY_TARGET_FORBIDDEN":
    case "RIDE_REQUEST_COMMUNITY_FEED_FORBIDDEN":
      return 403;
    case "RIDE_VEHICLE_PHOTO_STORAGE_NOT_CONFIGURED":
    case "RIDE_VEHICLE_PHOTO_UPLOAD_FAILED":
    case "RIDE_VEHICLE_PHOTO_UNAVAILABLE":
      return 503;
    default:
      return 409;
  }
}

function offerCreateInput(): RideOfferCreateInput {
  return {
    destination: customDestination(),
    originAreaLabel: "Lac 2",
    departureAt: now,
    totalSeats: 2,
    vehicleMake: null,
    vehicleModel: null,
    vehicleColor: null,
    note: null,
    waypoints: [],
  };
}

function requestCreateInput(): RideRequestCreateInput {
  return {
    destination: customDestination(),
    pickupAreaLabel: "Ariana",
    desiredDepartureAt: now,
    passengerCount: 1,
    note: null,
    expiresAt: now,
  };
}

function customDestination(): RideDestinationInput {
  return { type: "CUSTOM", customDestinationLabel: "Stade Olympique de Rades" };
}

function publicOffer(): PublicRideOffer {
  return {
    id: "offer-1",
    status: "OPEN",
    destination: { type: "CUSTOM", label: "Stade Olympique de Rades" },
    originAreaLabel: "Lac 2",
    departureAt: now,
    totalSeats: 2,
    availableSeats: 2,
    vehicleMake: null,
    vehicleModel: null,
    vehicleColor: null,
    note: null,
    hasVehiclePhoto: false,
    waypoints: [],
    createdAt: now,
    updatedAt: now,
  };
}

function ownerOffer(): RideOfferForOwnerRecord {
  return { ...publicOffer(), driverUserId: "driver-1", participations: [] };
}

function publicRequest(): PublicRideRequest {
  return {
    id: "request-1",
    status: "OPEN",
    destination: { type: "CUSTOM", label: "Stade Olympique de Rades" },
    pickupAreaLabel: "Ariana",
    desiredDepartureAt: now,
    passengerCount: 1,
    note: null,
    expiresAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function ownerRequest(): RideRequestForOwner {
  return { ...publicRequest(), requesterUserId: "requester-1" };
}

function participation(status: RideParticipationStatus): RideParticipation {
  return {
    id: "part-1",
    rideOfferId: "offer-1",
    passengerUserId: "passenger-1",
    seatCount: 1,
    status,
    requestedAt: now,
    respondedAt: null,
    cancelledAt: null,
    completedAt: null,
  };
}

function meetingPoint(): RideMeetingPoint {
  return {
    id: "meeting-1",
    participationId: "part-1",
    label: "Gate 4",
    latitude: 36.8,
    longitude: 10.18,
    createdAt: now,
    updatedAt: now,
  };
}
