import { Prisma, type PrismaClient } from "@hooma/database";
import { cashCurrencySchema } from "@hooma/contracts/money";
import type {
  PublicRideOffer,
  PublicRideOfferList,
  PublicRideRequest,
  PublicRideRequestList,
  RideDestinationSummary,
  RideMeetingPoint,
  RideMeetingPointInput,
  RideOfferCreateInput,
  RideOfferStatus,
  RideOfferUpdateInput,
  RideParticipation,
  RideParticipationRequestInput,
  RideParticipationStatus,
  RideRequestCreateInput,
  RideRequestForOwner,
  RideRequestStatus,
  RideRequestUpdateInput,
  RideWaypoint,
} from "@hooma/contracts/rides";
import type {
  RideMeetingPointRepository,
  RideOfferListInput,
  RideOfferForOwnerRecord,
  RideOfferRepository,
  RideParticipationRepository,
} from "../application/ride-offer.repository.js";
import type {
  RideRequestListInput,
  RideRequestRepository,
} from "../application/ride-request.repository.js";
import {
  assertDriverCanReceivePassenger,
  assertRideOfferStatusTransition,
  assertRideParticipationStatusTransition,
  assertRideRequestStatusTransition,
  canViewRideMeetingPoint,
} from "../domain/ride-policy.js";

const publicRideOfferSelect = Prisma.validator<Prisma.RideOfferSelect>()({
  id: true,
  context: true,
  status: true,
  eventId: true,
  destinationPlaceId: true,
  customDestinationLabel: true,
  originAreaLabel: true,
  departureAt: true,
  totalSeats: true,
  compensationType: true,
  compensationAmountMinor: true,
  compensationCurrency: true,
  compensationBasis: true,
  vehicleMake: true,
  vehicleModel: true,
  vehicleColor: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  destinationEvent: { select: { id: true, title: true, startsAt: true } },
  destinationPlace: { select: { id: true, name: true, city: true, houma: true } },
  waypoints: {
    orderBy: [{ sequence: "asc" }, { id: "asc" }],
    select: { id: true, sequence: true, placeId: true, areaLabel: true },
  },
  vehiclePhoto: { select: { id: true } },
  participations: {
    where: { status: "ACCEPTED" },
    select: { seatCount: true },
  },
});

const ownerRideOfferSelect = Prisma.validator<Prisma.RideOfferSelect>()({
  ...publicRideOfferSelect,
  driverUserId: true,
  participations: {
    orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      rideOfferId: true,
      passengerUserId: true,
      seatCount: true,
      status: true,
      requestedAt: true,
      respondedAt: true,
      cancelledAt: true,
      completedAt: true,
    },
  },
});

const publicRideRequestSelect = Prisma.validator<Prisma.RideRequestSelect>()({
  id: true,
  context: true,
  status: true,
  eventId: true,
  destinationPlaceId: true,
  customDestinationLabel: true,
  pickupAreaLabel: true,
  desiredDepartureAt: true,
  passengerCount: true,
  compensationType: true,
  compensationAmountMinor: true,
  compensationCurrency: true,
  compensationBasis: true,
  note: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  destinationEvent: { select: { id: true, title: true, startsAt: true } },
  destinationPlace: { select: { id: true, name: true, city: true, houma: true } },
});

const ownerRideRequestSelect = Prisma.validator<Prisma.RideRequestSelect>()({
  ...publicRideRequestSelect,
  requesterUserId: true,
});

const rideParticipationSelect = Prisma.validator<Prisma.RideParticipationSelect>()({
  id: true,
  rideOfferId: true,
  passengerUserId: true,
  seatCount: true,
  status: true,
  requestedAt: true,
  respondedAt: true,
  cancelledAt: true,
  completedAt: true,
});

const rideMeetingPointSelect = Prisma.validator<Prisma.RideMeetingPointSelect>()({
  id: true,
  participationId: true,
  label: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  updatedAt: true,
});

type PublicRideOfferRow = Prisma.RideOfferGetPayload<{
  select: typeof publicRideOfferSelect;
}>;
type OwnerRideOfferRow = Prisma.RideOfferGetPayload<{
  select: typeof ownerRideOfferSelect;
}>;
type PublicRideRequestRow = Prisma.RideRequestGetPayload<{
  select: typeof publicRideRequestSelect;
}>;
type OwnerRideRequestRow = Prisma.RideRequestGetPayload<{
  select: typeof ownerRideRequestSelect;
}>;
type RideParticipationRow = Prisma.RideParticipationGetPayload<{
  select: typeof rideParticipationSelect;
}>;
type RideMeetingPointRow = Prisma.RideMeetingPointGetPayload<{
  select: typeof rideMeetingPointSelect;
}>;

export class PrismaRideOfferRepository
  implements RideOfferRepository, RideParticipationRepository, RideMeetingPointRepository
{
  constructor(private readonly db: PrismaClient) {}

  async listPublic(input: RideOfferListInput): Promise<PublicRideOfferList> {
    const rows = await this.db.rideOffer.findMany({
      where: {
        status: { in: ["OPEN", "FULL"] },
        ...(input.context ? { context: input.context } : {}),
        ...(input.from ? { departureAt: { gte: input.from } } : {}),
        ...(input.eventId ? { eventId: input.eventId } : {}),
        ...(input.destinationPlaceId ? { destinationPlaceId: input.destinationPlaceId } : {}),
      },
      orderBy: [{ departureAt: "asc" }, { id: "asc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: publicRideOfferSelect,
    });

    return {
      items: rows.slice(0, input.limit).map(serializePublicRideOffer),
      nextCursor: rows.length > input.limit ? (rows[input.limit - 1]?.id ?? null) : null,
    };
  }

  async getPublic(rideOfferId: string): Promise<PublicRideOffer | null> {
    const row = await this.db.rideOffer.findFirst({
      where: { id: rideOfferId, status: { in: ["OPEN", "FULL", "DEPARTED"] } },
      select: publicRideOfferSelect,
    });

    return row ? serializePublicRideOffer(row) : null;
  }

  async getForOwner(
    rideOfferId: string,
    driverUserId: string,
  ): Promise<RideOfferForOwnerRecord | null> {
    const row = await this.db.rideOffer.findFirst({
      where: { id: rideOfferId, driverUserId },
      select: ownerRideOfferSelect,
    });

    return row ? serializeOwnerRideOffer(row) : null;
  }

  async create(
    driverUserId: string,
    input: RideOfferCreateInput,
  ): Promise<RideOfferForOwnerRecord> {
    const created = await this.db.rideOffer.create({
      data: {
        driverUserId,
        context: input.context ?? "MATCHDAY",
        ...rideDestinationData(input.destination),
        originAreaLabel: input.originAreaLabel,
        departureAt: new Date(input.departureAt),
        totalSeats: input.totalSeats,
        ...offerCompensationData(input.compensationTerms ?? { type: "FREE" }),
        vehicleMake: input.vehicleMake ?? null,
        vehicleModel: input.vehicleModel ?? null,
        vehicleColor: input.vehicleColor ?? null,
        note: input.note ?? null,
        waypoints: { create: waypointCreateData(input.waypoints ?? []) },
      },
      select: ownerRideOfferSelect,
    });

    return serializeOwnerRideOffer(created);
  }

  async update(
    rideOfferId: string,
    driverUserId: string,
    input: RideOfferUpdateInput,
  ): Promise<RideOfferForOwnerRecord | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await lockRideOffer(tx, rideOfferId);
      if (!existing || existing.driverUserId !== driverUserId || isTerminalOffer(existing.status)) {
        return null;
      }

      if (input.totalSeats !== undefined) {
        const acceptedSeats = await acceptedSeatCount(tx, rideOfferId);
        if (input.totalSeats < acceptedSeats) return null;
      }

      if (input.waypoints !== undefined) {
        await tx.rideOfferWaypoint.deleteMany({ where: { rideOfferId } });
      }

      const updated = await tx.rideOffer.update({
        where: { id: rideOfferId },
        data: {
          ...(input.destination ? rideDestinationData(input.destination) : {}),
          ...(input.originAreaLabel !== undefined
            ? { originAreaLabel: input.originAreaLabel }
            : {}),
          ...(input.departureAt !== undefined ? { departureAt: new Date(input.departureAt) } : {}),
          ...(input.totalSeats !== undefined ? { totalSeats: input.totalSeats } : {}),
          ...(input.context !== undefined ? { context: input.context } : {}),
          ...(input.compensationTerms !== undefined
            ? offerCompensationData(input.compensationTerms)
            : {}),
          ...(input.vehicleMake !== undefined ? { vehicleMake: input.vehicleMake } : {}),
          ...(input.vehicleModel !== undefined ? { vehicleModel: input.vehicleModel } : {}),
          ...(input.vehicleColor !== undefined ? { vehicleColor: input.vehicleColor } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
          ...(input.waypoints !== undefined
            ? { waypoints: { create: waypointCreateData(input.waypoints) } }
            : {}),
        },
        select: ownerRideOfferSelect,
      });

      if (input.totalSeats !== undefined) {
        await refreshRideOfferCapacityStatus(tx, rideOfferId);
      }

      return serializeOwnerRideOffer(updated);
    });
  }

  async updateStatus(
    rideOfferId: string,
    driverUserId: string,
    status: RideOfferStatus,
  ): Promise<RideOfferForOwnerRecord | null> {
    return this.db.$transaction(async (tx) => {
      const current = await lockRideOffer(tx, rideOfferId);
      if (!current || current.driverUserId !== driverUserId) return null;

      assertRideOfferStatusTransition(current.status, status);

      const updated = await tx.rideOffer.update({
        where: { id: rideOfferId },
        data: { status },
        select: ownerRideOfferSelect,
      });

      return serializeOwnerRideOffer(updated);
    });
  }

  async requestParticipation(
    rideOfferId: string,
    passengerUserId: string,
    input: RideParticipationRequestInput,
  ): Promise<RideParticipation | null> {
    return this.db.$transaction(async (tx) => {
      const offer = await lockRideOffer(tx, rideOfferId);
      if (!offer || offer.status !== "OPEN") return null;

      assertDriverCanReceivePassenger(offer.driverUserId, passengerUserId);

      const existing = await tx.rideParticipation.findUnique({
        where: { rideOfferId_passengerUserId: { rideOfferId, passengerUserId } },
        select: rideParticipationSelect,
      });
      if (existing) return serializeRideParticipation(existing);

      const participation = await tx.rideParticipation.create({
        data: {
          rideOfferId,
          passengerUserId,
          seatCount: input.seatCount,
        },
        select: rideParticipationSelect,
      });

      return serializeRideParticipation(participation);
    });
  }

  async getForPassenger(
    rideOfferId: string,
    passengerUserId: string,
  ): Promise<RideParticipation | null> {
    const row = await this.db.rideParticipation.findUnique({
      where: { rideOfferId_passengerUserId: { rideOfferId, passengerUserId } },
      select: rideParticipationSelect,
    });

    return row ? serializeRideParticipation(row) : null;
  }

  async updateParticipationStatus(input: {
    readonly rideOfferId: string;
    readonly participationId: string;
    readonly actorUserId: string;
    readonly status: RideParticipationStatus;
  }): Promise<RideParticipation | null> {
    return this.db.$transaction(async (tx) => {
      const offer = await lockRideOffer(tx, input.rideOfferId);
      if (!offer) return null;

      const participation = await tx.rideParticipation.findFirst({
        where: { id: input.participationId, rideOfferId: input.rideOfferId },
        select: rideParticipationSelect,
      });
      if (!participation) return null;

      const actorIsDriver = offer.driverUserId === input.actorUserId;
      const actorIsPassenger = participation.passengerUserId === input.actorUserId;
      if (!canActorUpdateParticipation(input.status, actorIsDriver, actorIsPassenger)) return null;

      assertRideParticipationStatusTransition(participation.status, input.status);

      if (input.status === "ACCEPTED") {
        const acceptedSeats = await acceptedSeatCount(tx, input.rideOfferId, participation.id);
        if (acceptedSeats + participation.seatCount > offer.totalSeats) return null;
      }

      const now = new Date();
      const updated = await tx.rideParticipation.update({
        where: { id: participation.id },
        data: participationStatusData(input.status, now),
        select: rideParticipationSelect,
      });

      if (input.status === "ACCEPTED" || input.status === "CANCELLED") {
        await refreshRideOfferCapacityStatus(tx, input.rideOfferId);
      }

      return serializeRideParticipation(updated);
    });
  }

  async upsertForParticipation(input: {
    readonly rideOfferId: string;
    readonly participationId: string;
    readonly driverUserId: string;
    readonly meetingPoint: RideMeetingPointInput;
  }): Promise<RideMeetingPoint | null> {
    return this.db.$transaction(async (tx) => {
      const participation = await tx.rideParticipation.findFirst({
        where: {
          id: input.participationId,
          rideOfferId: input.rideOfferId,
          status: "ACCEPTED",
          rideOffer: { driverUserId: input.driverUserId },
        },
        select: { id: true },
      });
      if (!participation) return null;

      const meetingPoint = await tx.rideMeetingPoint.upsert({
        where: { participationId: input.participationId },
        create: {
          participationId: input.participationId,
          label: input.meetingPoint.label,
          latitude: input.meetingPoint.latitude ?? null,
          longitude: input.meetingPoint.longitude ?? null,
        },
        update: {
          label: input.meetingPoint.label,
          latitude: input.meetingPoint.latitude ?? null,
          longitude: input.meetingPoint.longitude ?? null,
        },
        select: rideMeetingPointSelect,
      });

      return serializeRideMeetingPoint(meetingPoint);
    });
  }

  async getForAuthorizedViewer(input: {
    readonly participationId: string;
    readonly viewerUserId: string;
  }): Promise<RideMeetingPoint | null> {
    const row = await this.db.rideMeetingPoint.findUnique({
      where: { participationId: input.participationId },
      select: {
        ...rideMeetingPointSelect,
        participation: {
          select: {
            status: true,
            passengerUserId: true,
            rideOffer: { select: { driverUserId: true } },
          },
        },
      },
    });
    if (!row || row.participation.status !== "ACCEPTED") return null;

    const allowed = canViewRideMeetingPoint({
      viewerUserId: input.viewerUserId,
      driverUserId: row.participation.rideOffer.driverUserId,
      acceptedPassengerUserId: row.participation.passengerUserId,
    });

    return allowed ? serializeRideMeetingPoint(row) : null;
  }
}

export class PrismaRideRequestRepository implements RideRequestRepository {
  constructor(private readonly db: PrismaClient) {}

  async listPublic(input: RideRequestListInput): Promise<PublicRideRequestList> {
    const rows = await this.db.rideRequest.findMany({
      where: {
        status: "OPEN",
        ...(input.context ? { context: input.context } : {}),
        expiresAt: { gt: new Date() },
        ...(input.from ? { desiredDepartureAt: { gte: input.from } } : {}),
        ...(input.eventId ? { eventId: input.eventId } : {}),
        ...(input.destinationPlaceId ? { destinationPlaceId: input.destinationPlaceId } : {}),
      },
      orderBy: [{ desiredDepartureAt: "asc" }, { id: "asc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: publicRideRequestSelect,
    });

    return {
      items: rows.slice(0, input.limit).map(serializePublicRideRequest),
      nextCursor: rows.length > input.limit ? (rows[input.limit - 1]?.id ?? null) : null,
    };
  }

  async getPublic(rideRequestId: string): Promise<PublicRideRequest | null> {
    const row = await this.db.rideRequest.findFirst({
      where: {
        id: rideRequestId,
        status: { in: ["OPEN", "MATCHED"] },
        expiresAt: { gt: new Date() },
      },
      select: publicRideRequestSelect,
    });

    return row ? serializePublicRideRequest(row) : null;
  }

  async getForRequester(
    rideRequestId: string,
    requesterUserId: string,
  ): Promise<RideRequestForOwner | null> {
    const row = await this.db.rideRequest.findFirst({
      where: { id: rideRequestId, requesterUserId },
      select: ownerRideRequestSelect,
    });

    return row ? serializeOwnerRideRequest(row) : null;
  }

  async create(
    requesterUserId: string,
    input: RideRequestCreateInput,
  ): Promise<RideRequestForOwner> {
    const created = await this.db.rideRequest.create({
      data: {
        requesterUserId,
        context: input.context ?? "MATCHDAY",
        ...rideDestinationData(input.destination),
        pickupAreaLabel: input.pickupAreaLabel,
        desiredDepartureAt: new Date(input.desiredDepartureAt),
        passengerCount: input.passengerCount,
        ...requestCompensationData(input.compensationTerms ?? { type: "FREE" }),
        note: input.note ?? null,
        expiresAt: new Date(input.expiresAt),
      },
      select: ownerRideRequestSelect,
    });

    return serializeOwnerRideRequest(created);
  }

  async update(
    rideRequestId: string,
    requesterUserId: string,
    input: RideRequestUpdateInput,
  ): Promise<RideRequestForOwner | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.rideRequest.findFirst({
        where: { id: rideRequestId, requesterUserId },
        select: { id: true, status: true },
      });
      if (!existing || isTerminalRequest(existing.status)) return null;

      const updated = await tx.rideRequest.update({
        where: { id: rideRequestId },
        data: {
          ...(input.destination ? rideDestinationData(input.destination) : {}),
          ...(input.pickupAreaLabel !== undefined
            ? { pickupAreaLabel: input.pickupAreaLabel }
            : {}),
          ...(input.desiredDepartureAt !== undefined
            ? { desiredDepartureAt: new Date(input.desiredDepartureAt) }
            : {}),
          ...(input.passengerCount !== undefined ? { passengerCount: input.passengerCount } : {}),
          ...(input.context !== undefined ? { context: input.context } : {}),
          ...(input.compensationTerms !== undefined
            ? requestCompensationData(input.compensationTerms)
            : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
          ...(input.expiresAt !== undefined ? { expiresAt: new Date(input.expiresAt) } : {}),
        },
        select: ownerRideRequestSelect,
      });

      return serializeOwnerRideRequest(updated);
    });
  }

  async updateStatus(
    rideRequestId: string,
    requesterUserId: string,
    status: RideRequestStatus,
  ): Promise<RideRequestForOwner | null> {
    return this.db.$transaction(async (tx) => {
      const current = await tx.rideRequest.findFirst({
        where: { id: rideRequestId, requesterUserId },
        select: { status: true },
      });
      if (!current) return null;

      assertRideRequestStatusTransition(current.status, status);

      const updated = await tx.rideRequest.update({
        where: { id: rideRequestId },
        data: { status },
        select: ownerRideRequestSelect,
      });

      return serializeOwnerRideRequest(updated);
    });
  }
}

function rideDestinationData(
  destination: RideOfferCreateInput["destination"] | RideRequestCreateInput["destination"],
): {
  readonly eventId: string | null;
  readonly destinationPlaceId: string | null;
  readonly customDestinationLabel: string | null;
} {
  return {
    eventId: destination.type === "EVENT" ? destination.eventId : null,
    destinationPlaceId: destination.type === "PLACE" ? destination.placeId : null,
    customDestinationLabel:
      destination.type === "CUSTOM" ? destination.customDestinationLabel : null,
  };
}

function offerCompensationData(input: NonNullable<RideOfferCreateInput["compensationTerms"]>): {
  readonly compensationType: "FREE" | "CASH";
  readonly compensationAmountMinor: number | null;
  readonly compensationCurrency: string | null;
  readonly compensationBasis: "PER_SEAT" | "TOTAL" | null;
} {
  if (input.type === "FREE") {
    return {
      compensationType: "FREE",
      compensationAmountMinor: null,
      compensationCurrency: null,
      compensationBasis: null,
    };
  }
  return {
    compensationType: "CASH",
    compensationAmountMinor: input.amountMinor,
    compensationCurrency: input.currency,
    compensationBasis: input.basis,
  };
}

function requestCompensationData(input: NonNullable<RideRequestCreateInput["compensationTerms"]>): {
  readonly compensationType: "FREE" | "CASH";
  readonly compensationAmountMinor: number | null;
  readonly compensationCurrency: string | null;
  readonly compensationBasis: null;
} {
  if (input.type === "FREE") {
    return {
      compensationType: "FREE",
      compensationAmountMinor: null,
      compensationCurrency: null,
      compensationBasis: null,
    };
  }
  return {
    compensationType: "CASH",
    compensationAmountMinor: input.amountMinor,
    compensationCurrency: input.currency,
    compensationBasis: null,
  };
}

function waypointCreateData(waypoints: NonNullable<RideOfferCreateInput["waypoints"]>): Array<{
  readonly sequence: number;
  readonly placeId: string | null;
  readonly areaLabel: string;
}> {
  return waypoints.map((waypoint) => ({
    sequence: waypoint.sequence,
    placeId: waypoint.placeId ?? null,
    areaLabel: waypoint.areaLabel,
  }));
}

function serializePublicRideOffer(row: PublicRideOfferRow): PublicRideOffer {
  return {
    id: row.id,
    context: row.context,
    status: row.status,
    destination: rideDestinationSummary(row),
    originAreaLabel: row.originAreaLabel,
    departureAt: row.departureAt.toISOString(),
    totalSeats: row.totalSeats,
    availableSeats: availableSeats(row.totalSeats, row.participations),
    compensationTerms: serializeOfferCompensation(row),
    vehicleMake: row.vehicleMake,
    vehicleModel: row.vehicleModel,
    vehicleColor: row.vehicleColor,
    note: row.note,
    hasVehiclePhoto: row.vehiclePhoto !== null,
    waypoints: row.waypoints.map(serializeRideWaypoint),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeOwnerRideOffer(row: OwnerRideOfferRow): RideOfferForOwnerRecord {
  return {
    ...serializePublicRideOffer(row),
    driverUserId: row.driverUserId,
    participations: row.participations.map(serializeRideParticipation),
  };
}

function serializePublicRideRequest(row: PublicRideRequestRow): PublicRideRequest {
  return {
    id: row.id,
    context: row.context,
    status: row.status,
    destination: rideRequestDestinationSummary(row),
    pickupAreaLabel: row.pickupAreaLabel,
    desiredDepartureAt: row.desiredDepartureAt.toISOString(),
    passengerCount: row.passengerCount,
    compensationTerms: serializeRequestCompensation(row),
    note: row.note,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeOwnerRideRequest(row: OwnerRideRequestRow): RideRequestForOwner {
  return {
    ...serializePublicRideRequest(row),
    requesterUserId: row.requesterUserId,
  };
}

function serializeRideParticipation(row: RideParticipationRow): RideParticipation {
  return {
    id: row.id,
    rideOfferId: row.rideOfferId,
    passengerUserId: row.passengerUserId,
    seatCount: row.seatCount,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function serializeOfferCompensation(row: {
  readonly compensationType: "FREE" | "CASH";
  readonly compensationAmountMinor: number | null;
  readonly compensationCurrency: string | null;
  readonly compensationBasis: "PER_SEAT" | "TOTAL" | null;
}): PublicRideOffer["compensationTerms"] {
  if (row.compensationType === "FREE") return { type: "FREE" };
  if (
    row.compensationAmountMinor === null ||
    row.compensationCurrency === null ||
    row.compensationBasis === null
  ) {
    throw new Error("RIDE_OFFER_COMPENSATION_MISSING");
  }
  return {
    type: "CASH",
    amountMinor: row.compensationAmountMinor,
    currency: cashCurrencySchema.parse(row.compensationCurrency),
    basis: row.compensationBasis,
  };
}

function serializeRequestCompensation(row: {
  readonly compensationType: "FREE" | "CASH";
  readonly compensationAmountMinor: number | null;
  readonly compensationCurrency: string | null;
}): PublicRideRequest["compensationTerms"] {
  if (row.compensationType === "FREE") return { type: "FREE" };
  if (row.compensationAmountMinor === null || row.compensationCurrency === null) {
    throw new Error("RIDE_REQUEST_COMPENSATION_MISSING");
  }
  return {
    type: "CASH",
    amountMinor: row.compensationAmountMinor,
    currency: cashCurrencySchema.parse(row.compensationCurrency),
  };
}

function serializeRideMeetingPoint(row: RideMeetingPointRow): RideMeetingPoint {
  return {
    id: row.id,
    participationId: row.participationId,
    label: row.label,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRideWaypoint(row: RideWaypoint): RideWaypoint {
  return {
    id: row.id,
    sequence: row.sequence,
    placeId: row.placeId,
    areaLabel: row.areaLabel,
  };
}

function rideDestinationSummary(row: PublicRideOfferRow): RideDestinationSummary {
  if (row.eventId) {
    if (!row.destinationEvent) throw new Error("RIDE_DESTINATION_EVENT_MISSING");

    return {
      type: "EVENT",
      eventId: row.destinationEvent.id,
      title: row.destinationEvent.title,
      startsAt: row.destinationEvent.startsAt.toISOString(),
    };
  }

  if (row.destinationPlaceId) {
    if (!row.destinationPlace) throw new Error("RIDE_DESTINATION_PLACE_MISSING");

    return {
      type: "PLACE",
      placeId: row.destinationPlace.id,
      name: row.destinationPlace.name,
      city: row.destinationPlace.city,
      houma: row.destinationPlace.houma,
    };
  }

  if (!row.customDestinationLabel) throw new Error("RIDE_DESTINATION_CUSTOM_MISSING");
  return { type: "CUSTOM", label: row.customDestinationLabel };
}

function rideRequestDestinationSummary(row: PublicRideRequestRow): RideDestinationSummary {
  if (row.eventId) {
    if (!row.destinationEvent) throw new Error("RIDE_DESTINATION_EVENT_MISSING");

    return {
      type: "EVENT",
      eventId: row.destinationEvent.id,
      title: row.destinationEvent.title,
      startsAt: row.destinationEvent.startsAt.toISOString(),
    };
  }

  if (row.destinationPlaceId) {
    if (!row.destinationPlace) throw new Error("RIDE_DESTINATION_PLACE_MISSING");

    return {
      type: "PLACE",
      placeId: row.destinationPlace.id,
      name: row.destinationPlace.name,
      city: row.destinationPlace.city,
      houma: row.destinationPlace.houma,
    };
  }

  if (!row.customDestinationLabel) throw new Error("RIDE_DESTINATION_CUSTOM_MISSING");
  return { type: "CUSTOM", label: row.customDestinationLabel };
}

function availableSeats(
  totalSeats: number,
  participations: readonly { readonly seatCount: number }[],
): number {
  const acceptedSeats = participations.reduce(
    (sum, participation) => sum + participation.seatCount,
    0,
  );
  return Math.max(totalSeats - acceptedSeats, 0);
}

async function lockRideOffer(
  tx: Prisma.TransactionClient,
  rideOfferId: string,
): Promise<{
  readonly id: string;
  readonly driverUserId: string;
  readonly status: RideOfferStatus;
  readonly totalSeats: number;
} | null> {
  const rows = await tx.$queryRaw<
    Array<{ id: string; driverUserId: string; status: RideOfferStatus; totalSeats: number }>
  >(
    Prisma.sql`SELECT id, "driverUserId" AS "driverUserId", status, "totalSeats" AS "totalSeats" FROM "RideOffer" WHERE id = ${rideOfferId} FOR UPDATE`,
  );

  return rows[0] ?? null;
}

async function acceptedSeatCount(
  tx: Prisma.TransactionClient,
  rideOfferId: string,
  excludingParticipationId?: string,
): Promise<number> {
  const aggregate = await tx.rideParticipation.aggregate({
    where: {
      rideOfferId,
      status: "ACCEPTED",
      ...(excludingParticipationId ? { id: { not: excludingParticipationId } } : {}),
    },
    _sum: { seatCount: true },
  });

  return aggregate._sum.seatCount ?? 0;
}

async function refreshRideOfferCapacityStatus(
  tx: Prisma.TransactionClient,
  rideOfferId: string,
): Promise<void> {
  const offer = await tx.rideOffer.findUniqueOrThrow({
    where: { id: rideOfferId },
    select: { status: true, totalSeats: true },
  });
  if (!["OPEN", "FULL"].includes(offer.status)) return;

  const acceptedSeats = await acceptedSeatCount(tx, rideOfferId);
  const status: RideOfferStatus = acceptedSeats >= offer.totalSeats ? "FULL" : "OPEN";
  if (status !== offer.status) {
    await tx.rideOffer.update({ where: { id: rideOfferId }, data: { status } });
  }
}

function canActorUpdateParticipation(
  status: RideParticipationStatus,
  actorIsDriver: boolean,
  actorIsPassenger: boolean,
): boolean {
  if (status === "ACCEPTED" || status === "REJECTED" || status === "COMPLETED") {
    return actorIsDriver;
  }

  if (status === "CANCELLED") return actorIsDriver || actorIsPassenger;

  return false;
}

function participationStatusData(status: RideParticipationStatus, now: Date) {
  if (status === "ACCEPTED") {
    return { status, respondedAt: now, cancelledAt: null, completedAt: null };
  }

  if (status === "REJECTED") return { status, respondedAt: now };

  if (status === "CANCELLED") return { status, cancelledAt: now };

  if (status === "COMPLETED") return { status, completedAt: now };

  return { status };
}

function isTerminalOffer(status: RideOfferStatus): boolean {
  return status === "CANCELLED" || status === "COMPLETED";
}

function isTerminalRequest(status: RideRequestStatus): boolean {
  return status === "CANCELLED" || status === "EXPIRED" || status === "COMPLETED";
}
