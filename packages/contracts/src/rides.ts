import { z } from "zod";
import { cashCurrencySchema } from "./money.js";

const idSchema = z.string().trim().min(1);
const areaLabelSchema = z.string().trim().min(1).max(160);
const noteSchema = z.string().trim().max(1200).optional().nullable();
const vehicleFieldSchema = z.string().trim().max(80).optional().nullable();

export const rideContextSchema = z.enum(["MATCHDAY", "GENERAL"]);

export const rideCompensationBasisSchema = z.enum(["PER_SEAT", "TOTAL"]);

const rideFreeCompensationTermsSchema = z
  .object({
    type: z.literal("FREE"),
  })
  .strict();

const rideCashCompensationTermsBaseSchema = z
  .object({
    type: z.literal("CASH"),
    amountMinor: z.number().int().positive(),
    currency: cashCurrencySchema,
  })
  .strict();

export const rideOfferCompensationTermsSchema = z.discriminatedUnion("type", [
  rideFreeCompensationTermsSchema,
  rideCashCompensationTermsBaseSchema.extend({
    basis: rideCompensationBasisSchema,
  }),
]);

export const rideRequestCompensationTermsSchema = z.discriminatedUnion("type", [
  rideFreeCompensationTermsSchema,
  rideCashCompensationTermsBaseSchema,
]);

export const rideCompensationTermsSchema = z.union([
  rideOfferCompensationTermsSchema,
  rideRequestCompensationTermsSchema,
]);

export const rideOfferStatusSchema = z.enum(["OPEN", "FULL", "DEPARTED", "CANCELLED", "COMPLETED"]);

export const rideRequestStatusSchema = z.enum([
  "OPEN",
  "MATCHED",
  "CANCELLED",
  "EXPIRED",
  "COMPLETED",
]);

export const rideParticipationStatusSchema = z.enum([
  "REQUESTED",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
]);

export const rideDestinationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("EVENT"),
    eventId: idSchema,
  }),
  z.object({
    type: z.literal("PLACE"),
    placeId: idSchema,
  }),
  z.object({
    type: z.literal("CUSTOM"),
    customDestinationLabel: areaLabelSchema,
  }),
]);

export const rideDestinationColumnsSchema = z
  .object({
    eventId: idSchema.optional().nullable(),
    destinationPlaceId: idSchema.optional().nullable(),
    customDestinationLabel: areaLabelSchema.optional().nullable(),
  })
  .superRefine((input, context) => {
    const strategyCount = [
      input.eventId,
      input.destinationPlaceId,
      input.customDestinationLabel,
    ].filter((value) => value !== undefined && value !== null).length;
    if (strategyCount !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ride destination must use exactly one Event, Place, or custom destination",
      });
    }
  });

export const rideWaypointInputSchema = z.object({
  sequence: z.number().int().min(0).max(100),
  placeId: idSchema.optional().nullable(),
  areaLabel: areaLabelSchema,
});

export const rideOfferCreateSchema = z.object({
  context: rideContextSchema.default("MATCHDAY"),
  destination: rideDestinationSchema,
  originAreaLabel: areaLabelSchema,
  departureAt: z.string().datetime(),
  totalSeats: z.number().int().positive(),
  compensationTerms: rideOfferCompensationTermsSchema.default({ type: "FREE" }),
  vehicleMake: vehicleFieldSchema,
  vehicleModel: vehicleFieldSchema,
  vehicleColor: vehicleFieldSchema,
  note: noteSchema,
  waypoints: z.array(rideWaypointInputSchema).max(20).optional().default([]),
});

export const rideOfferUpdateSchema = rideOfferCreateSchema.partial();

export const rideRequestCreateSchema = z.object({
  context: rideContextSchema.default("MATCHDAY"),
  destination: rideDestinationSchema,
  pickupAreaLabel: areaLabelSchema,
  desiredDepartureAt: z.string().datetime(),
  passengerCount: z.number().int().positive(),
  compensationTerms: rideRequestCompensationTermsSchema.default({ type: "FREE" }),
  note: noteSchema,
  expiresAt: z.string().datetime(),
});

export const rideRequestUpdateSchema = rideRequestCreateSchema.partial();

export const rideParticipationRequestSchema = z.object({
  seatCount: z.number().int().positive(),
});

export const rideMeetingPointInputSchema = z.object({
  label: z.string().trim().min(1).max(240),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export const rideDestinationSummarySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("EVENT"),
    eventId: idSchema,
    title: z.string().min(1),
    startsAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal("PLACE"),
    placeId: idSchema,
    name: z.string().min(1),
    city: z.string().nullable(),
    houma: z.string().nullable(),
  }),
  z.object({
    type: z.literal("CUSTOM"),
    label: z.string().min(1),
  }),
]);

export const rideWaypointSchema = z.object({
  id: idSchema,
  sequence: z.number().int().min(0),
  placeId: idSchema.nullable(),
  areaLabel: z.string().min(1),
});

export const publicRideOfferSchema = z.object({
  id: idSchema,
  context: rideContextSchema,
  status: rideOfferStatusSchema,
  destination: rideDestinationSummarySchema,
  originAreaLabel: z.string().min(1),
  departureAt: z.string().datetime(),
  totalSeats: z.number().int().positive(),
  availableSeats: z.number().int().min(0),
  compensationTerms: rideOfferCompensationTermsSchema,
  vehicleMake: z.string().nullable(),
  vehicleModel: z.string().nullable(),
  vehicleColor: z.string().nullable(),
  note: z.string().nullable(),
  hasVehiclePhoto: z.boolean(),
  waypoints: z.array(rideWaypointSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const rideParticipationSchema = z.object({
  id: idSchema,
  rideOfferId: idSchema,
  passengerUserId: idSchema,
  seatCount: z.number().int().positive(),
  status: rideParticipationStatusSchema,
  requestedAt: z.string().datetime(),
  respondedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});

export const ridePassengerPresentationSchema = z.object({
  displayName: z.string().min(1),
  username: z.string().min(1),
  photoUrl: z.string().nullable(),
});

export const rideParticipationForDriverSchema = rideParticipationSchema.extend({
  passenger: ridePassengerPresentationSchema.nullable(),
});

export const rideMeetingPointSchema = z.object({
  id: idSchema,
  participationId: idSchema,
  label: z.string().min(1),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const rideOfferForOwnerSchema = publicRideOfferSchema.extend({
  driverUserId: idSchema,
  participations: z.array(rideParticipationForDriverSchema),
});

export const publicRideRequestSchema = z.object({
  id: idSchema,
  context: rideContextSchema,
  status: rideRequestStatusSchema,
  destination: rideDestinationSummarySchema,
  pickupAreaLabel: z.string().min(1),
  desiredDepartureAt: z.string().datetime(),
  passengerCount: z.number().int().positive(),
  compensationTerms: rideRequestCompensationTermsSchema,
  note: z.string().nullable(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const rideRequestForOwnerSchema = publicRideRequestSchema.extend({
  requesterUserId: idSchema,
});

export const publicRideOfferListSchema = z.object({
  items: z.array(publicRideOfferSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const publicRideRequestListSchema = z.object({
  items: z.array(publicRideRequestSchema),
  nextCursor: z.string().min(1).nullable(),
});

export type RideOfferStatus = z.infer<typeof rideOfferStatusSchema>;
export type RideRequestStatus = z.infer<typeof rideRequestStatusSchema>;
export type RideParticipationStatus = z.infer<typeof rideParticipationStatusSchema>;
export type RideContext = z.infer<typeof rideContextSchema>;
export type RideCompensationBasis = z.infer<typeof rideCompensationBasisSchema>;
export type RideOfferCompensationTerms = z.infer<typeof rideOfferCompensationTermsSchema>;
export type RideRequestCompensationTerms = z.infer<typeof rideRequestCompensationTermsSchema>;
export type RideCompensationTerms = z.infer<typeof rideCompensationTermsSchema>;
export type RideDestinationInput = z.infer<typeof rideDestinationSchema>;
export type RideDestinationColumns = z.infer<typeof rideDestinationColumnsSchema>;
export type RideWaypointInput = z.infer<typeof rideWaypointInputSchema>;
export type RideOfferCreateInput = z.input<typeof rideOfferCreateSchema>;
export type RideOfferUpdateInput = z.input<typeof rideOfferUpdateSchema>;
export type RideRequestCreateInput = z.input<typeof rideRequestCreateSchema>;
export type RideRequestUpdateInput = z.input<typeof rideRequestUpdateSchema>;
export type RideParticipationRequestInput = z.infer<typeof rideParticipationRequestSchema>;
export type RideMeetingPointInput = z.infer<typeof rideMeetingPointInputSchema>;
export type RideDestinationSummary = z.infer<typeof rideDestinationSummarySchema>;
export type RideWaypoint = z.infer<typeof rideWaypointSchema>;
export type PublicRideOffer = z.infer<typeof publicRideOfferSchema>;
export type RideParticipation = z.infer<typeof rideParticipationSchema>;
export type RidePassengerPresentation = z.infer<typeof ridePassengerPresentationSchema>;
export type RideParticipationForDriver = z.infer<typeof rideParticipationForDriverSchema>;
export type RideMeetingPoint = z.infer<typeof rideMeetingPointSchema>;
export type RideOfferForOwner = z.infer<typeof rideOfferForOwnerSchema>;
export type PublicRideRequest = z.infer<typeof publicRideRequestSchema>;
export type RideRequestForOwner = z.infer<typeof rideRequestForOwnerSchema>;
export type PublicRideOfferList = z.infer<typeof publicRideOfferListSchema>;
export type PublicRideRequestList = z.infer<typeof publicRideRequestListSchema>;
