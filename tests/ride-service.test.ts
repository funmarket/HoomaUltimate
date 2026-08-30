import assert from "node:assert/strict";
import test from "node:test";
import type {
  PublicRideOffer,
  PublicRideRequest,
  RideDestinationInput,
  RideMeetingPoint,
  RideMeetingPointInput,
  RideOfferCreateInput,
  RideOfferForOwner,
  RideOfferStatus,
  RideParticipation,
  RideParticipationStatus,
  RideRequestCreateInput,
  RideRequestForOwner,
  RideRequestStatus,
} from "@hooma/contracts/rides";
import type {
  RideMeetingPointRepository,
  RideOfferListInput,
  RideOfferRepository,
  RideParticipationRepository,
} from "../apps/api/src/modules/rides/application/ride-offer.repository.js";
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

function createServiceFixture() {
  const offers = new FakeRideOfferRepository();
  const requests = new FakeRideRequestRepository();
  const participations = new FakeRideParticipationRepository();
  const meetingPoints = new FakeRideMeetingPointRepository();
  const events = new FakeRideEventReferenceReader();
  const places = new FakeRidePlaceReferenceReader();
  const service = new RideService(offers, requests, participations, meetingPoints, events, places);
  return { service, offers, requests, participations, meetingPoints, events, places };
}

class FakeRideOfferRepository implements RideOfferRepository {
  public ownerOffer: RideOfferForOwner | null = ownerOffer();
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
  public requestError: Error | null = null;
  public lastStatusInput: {
    readonly rideOfferId: string;
    readonly participationId: string;
    readonly actorUserId: string;
    readonly status: RideParticipationStatus;
  } | null = null;

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
      return 400;
    case "RIDE_OFFER_NOT_FOUND":
    case "RIDE_REQUEST_NOT_FOUND":
    case "RIDE_DESTINATION_EVENT_NOT_FOUND":
    case "RIDE_DESTINATION_PLACE_NOT_FOUND":
      return 404;
    case "RIDE_PARTICIPATION_CANCEL_FORBIDDEN":
    case "RIDE_MEETING_POINT_FORBIDDEN":
    case "RIDE_OFFER_MANAGE_FORBIDDEN":
    case "RIDE_REQUEST_MANAGE_FORBIDDEN":
      return 403;
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

function ownerOffer(): RideOfferForOwner {
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
